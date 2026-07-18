# SmartGrowth Backend (Django REST Framework)

## Cara penggunaan sistem (alur pengguna)

1. **Daftar / Masuk** — buka frontend, daftar akun baru lewat halaman
   Register (peran **Orang Tua**, bebas daftar; atau **Kader/Nakes**, butuh
   kode posyandu — lihat "Peran & tautan orang tua" di bawah), atau masuk
   lewat halaman Login kalau sudah punya akun. Admin tidak bisa daftar
   sendiri — dibuat lewat `createsuperuser`.
2. **Tambah data balita** — kader/nakes menambahkan balita baru (nama,
   tanggal lahir, jenis kelamin, opsional nama/pekerjaan orang tua, lokasi
   posyandu/klinik, berat & panjang lahir, usia kehamilan, status ASI
   eksklusif). Setiap balita otomatis dapat `link_code` 6-digit yang kader
   berikan ke orang tua supaya akun orang tua bisa melihat data anak
   tersebut. Orang tua hanya bisa melihat balita yang sudah ditautkan.
3. **Input pengukuran pertumbuhan** — buka dashboard salah satu balita, lalu
   catat pengukuran baru: tanggal ukur, berat (kg), tinggi (cm), opsional
   lingkar kepala (cm). Usia dalam bulan dihitung otomatis dari tanggal lahir
   balita.
4. **Sistem menghitung status risiko secara otomatis** — begitu pengukuran
   disimpan, backend langsung menghitung Z-score WHO dan menampilkan status
   **Normal**, **Berisiko**, **Stunting**, atau **Malnutrisi** sebagai badge
   di dashboard (lihat "Alur sistem" di bawah untuk detail perhitungannya).
5. **Lihat riwayat & grafik** — dashboard menampilkan grafik tinggi terhadap
   usia serta daftar seluruh riwayat pengukuran balita tersebut.
6. **Koreksi data (kader/nakes)** — kader/nakes bisa mengedit atau menghapus
   data balita/pengukuran yang salah input; orang tua read-only (lihat
   matriks permission di bawah).

## Alur sistem: dari input pengukuran sampai hasil Normal/Risiko

Begini persisnya perjalanan satu data pengukuran dari diinput sampai jadi
status risiko yang tampil di layar:

```
Kader/Nakes input: tanggal ukur, berat (kg), tinggi (cm)
di ChildDashboard.tsx (frontend)
            │
            ▼
POST/PUT /api/growth-records/  (childId, measuredAt, weightKg, heightCm, ageMonths)
            │
            ▼
GrowthRecordViewSet.perform_create() / perform_update()   (views.py)
            │
            ├──► calculate_haz(height_cm, age_months, sex)
            │        └─► who_reference.lms_for_age()
            │                 └─► baca tabel HFA WHO resmi (hfa_boys.csv / hfa_girls.csv)
            │                     + interpolasi ke usia persis anak
            │                 └─► rumus LMS: Z = (((tinggi/M)^L)-1)/(L·S)
            │                 = height_for_age_z (HAZ, indikator STUNTING)
            │
            ├──► calculate_whz(weight_kg, height_cm, age_months, sex)
            │        └─► who_reference.lms_for_weight()
            │                 └─► pilih tabel WFL (usia <24bln) atau WFH (≥24bln)
            │                     + interpolasi ke tinggi persis anak
            │                 └─► rumus LMS yang sama
            │                 = weight_for_height_z (WHZ, indikator WASTING)
            │
            ├──► calculate_waz(weight_kg, age_months, sex)
            │        └─► who_reference.lms_for_weight_age()
            │                 └─► baca tabel WFA WHO resmi (wfa_boys.csv / wfa_girls.csv)
            │                     + interpolasi ke usia persis anak
            │                 └─► rumus LMS yang sama
            │                 = weight_for_age_z (WAZ, indikator BERAT BADAN KURANG)
            │
            ├──► calculate_hcz(head_circumference_cm, age_months, sex)  [opsional]
            │        └─► who_reference.lms_for_head_circumference()
            │                 └─► baca tabel HCA WHO resmi (hca_boys.csv / hca_girls.csv)
            │                 = head_circumference_z (HCZ, indikator MIKROSEFALI)
            │
            ▼
score_risk(haz, whz, waz, hcz)
    - skor tertimbang 0-100: HAZ<-3:+50/<-2:+30/<-1:+12; WHZ<-3:+45/<-2:+25/
      >3:+25/>2:+12; WAZ<-3:+25/<-2:+15; HCZ<-2:+15 (kalau ada)
    - status: skor>=45 → malnutrisi · HAZ<-2 → stunting (dipaksa walau
      skor totalnya <45) · skor>=20 → berisiko · lainnya → normal
            │
            ▼
Simpan ke GrowthRecord: height_for_age_z, weight_for_height_z, weight_for_age_z,
head_circumference_z, risk_status
            │
            ▼
Response JSON (camelCase) balik ke frontend
            │
            ▼
<RiskBadge> di ChildDashboard.tsx menampilkan:
    "normal"     → hijau  "Normal"
    "berisiko"   → kuning "Berisiko"
    "stunting"   → oranye "Stunting"
    "malnutrisi" → merah  "Malnutrisi"
```

Poin penting dari alur ini:

- Perhitungan **selalu** memakai data resmi WHO (tabel CSV di
  `apps/growth/services/data/`), bukan rumus perkiraan — lihat bagian
  "Klasifikasi risiko" di bawah untuk sumber datanya.
- Status 4-tier (bukan 3) karena "stunting" (kronis, HAZ) dan "malnutrisi"
  (akut parah) punya urgensi rujukan yang beda — digabung jadi satu label
  menghilangkan informasi klinis penting.
- `score_risk()` **menjumlahkan** kontribusi tiap indikator, bukan cuma
  mengambil yang paling parah — defisit sedang di beberapa indikator
  sekaligus (mis. HAZ mendekati ambang + WAZ kurang) bisa jadi "berisiko"
  meski tidak ada satu pun yang sendirian melewati ambang beratnya.
- `score_risk()` dipakai di **dua tempat** (bukan dua rumus berbeda):
  `GrowthRecordViewSet._score()` (status per pengukuran) dan
  `assess_child_risk()`/`GET /api/risk-assessment/<child_id>/` (penilaian
  ulang berdasarkan pengukuran **terakhir**, ditambah faktor risiko lain
  seperti status ASI eksklusif) — supaya keduanya selalu konsisten.

## Struktur

```
config/              # settings, root urls, wsgi
apps/accounts/        # custom User model dengan field role (admin/kader_nakes/orangtua)
apps/growth/
  models.py           # Child, GrowthRecord, RiskAssessment, PosyanduSchedule
  serializers.py
  views.py            # ChildViewSet, GrowthRecordViewSet, RiskAssessmentView, GrowthReferenceView, PosyanduScheduleViewSet
  permissions.py       # RoleBasedGrowthPermission (matriks akses per role)
  urls.py
  tests.py            # validasi calculate_haz()/calculate_whz() vs tabel resmi WHO
  services/
    risk_engine.py     # Stage 1: HAZ + WHZ (Z-score) rule-based classification
    who_reference.py   # loader + interpolasi tabel LMS WHO (multi-indikator)
    data/
      hfa_boys.csv      # WHO Length/Height-for-Age LMS, laki-laki, day 0-1856
      hfa_girls.csv     # WHO Length/Height-for-Age LMS, perempuan, day 0-1856
      wfl_boys.csv      # WHO Weight-for-Length LMS (0-2th), laki-laki, 45-110cm
      wfl_girls.csv     # WHO Weight-for-Length LMS (0-2th), perempuan, 45-110cm
      wfh_boys.csv      # WHO Weight-for-Height LMS (2-5th), laki-laki, 65-120cm
      wfh_girls.csv     # WHO Weight-for-Height LMS (2-5th), perempuan, 65-120cm
      wfa_boys.csv      # WHO Weight-for-Age LMS, laki-laki, day 0-1856
      wfa_girls.csv     # WHO Weight-for-Age LMS, perempuan, day 0-1856
      hca_boys.csv      # WHO Head-Circumference-for-Age LMS, laki-laki, day 0-1856
      hca_girls.csv     # WHO Head-Circumference-for-Age LMS, perempuan, day 0-1856

apps/accounts/
  serializers.py        # RegisterSerializer (registrasi publik, role terbatas)
  views.py              # RegisterView
```

## Setup

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # isi kredensial DB + SECRET_KEY
python manage.py migrate
python manage.py createsuperuser   # akun admin awal (akun lain bisa lewat /api/auth/register)
python manage.py test apps.growth  # jalankan unit test Z-score vs tabel resmi WHO
python manage.py runserver         # jalan di http://localhost:8000
```

Superuser yang dibuat lewat `createsuperuser` **tidak otomatis** dapat
`role='admin'` (field custom itu tidak diisi oleh perintah bawaan Django) —
tapi permission class di sini menganggap `is_superuser` setara admin, jadi
tetap full access. Kalau mau field `role`-nya konsisten juga, set manual:

```bash
python manage.py shell -c "
from apps.accounts.models import User, Role
u = User.objects.get(username='<username_superuser>')
u.role = Role.ADMIN
u.save()
"
```

## Klasifikasi risiko (WHO HAZ + WHZ + WAZ + HCZ, skor tertimbang 4-tier)

- **Sumber data**: tabel LMS resmi WHO Child Growth Standards — Length/Height-for-Age
  (stunting, resolusi harian day 0–1856 / ≈0–60.97 bulan), Weight-for-Length
  0–2th / Weight-for-Height 2–5th (wasting, resolusi 0.1cm), Weight-for-Age
  (berat badan kurang, resolusi harian day 0–1856), dan Head-Circumference-for-Age
  (lingkar kepala, opsional, resolusi harian day 0–1856) — WFA dan HCA
  bersumber dari `weianthro`/`hcanthro`, tabel di paket macro WHO Anthro yang
  sama dengan WFL/WFH, cross-checked terhadap tabel WFL yang sudah ada (cocok
  sampai 4 desimal, jadi sumber resminya sama) — untuk laki-laki dan
  perempuan, diunduh dari https://www.who.int/tools/child-growth-standards
  dan disimpan sebagai CSV di `apps/growth/services/data/`.
- **`who_reference.lms_for_age()`**, **`lms_for_weight()`** (otomatis pilih
  WFL di bawah 24 bulan / WFH 24 bulan ke atas), **`lms_for_weight_age()`**,
  dan **`lms_for_head_circumference()`** — masing-masing mengembalikan (L, M, S)
  untuk indikatornya. Semuanya interpolasi linear antar baris terdekat; nilai
  di luar rentang tabel di-clamp ke ujung terdekat (tidak melempar error).
- **`risk_engine.calculate_haz()`**, **`calculate_whz()`**, **`calculate_waz()`**,
  **`calculate_hcz()`** — rumus LMS standar WHO: `Z = (((ukuran/M)^L) - 1) / (L*S)`
  (atau `ln(ukuran/M)/S` kalau L=0). Height-for-Age dan Head-Circumference-for-Age
  punya L=1 tetap; Weight-for-Length/Height dan Weight-for-Age punya L yang
  bervariasi (ada skewness), makanya rumus umum tetap dipakai, bukan hanya
  kasus khusus L=1.
- **`risk_engine.score_risk(haz, whz, waz, hcz=None)`** — **satu-satunya**
  sumber kebenaran untuk `risk_status`, dipakai baik oleh
  `GrowthRecordViewSet._score()` (status per pengukuran) maupun
  `assess_child_risk()`/`RiskAssessmentView` (audit trail terpisah), supaya
  keduanya tidak pernah saling kontradiksi. Menjumlahkan kontribusi tiap
  indikator jadi skor 0-100 (bukan cuma ambil yang paling parah): HAZ<-3:+50/
  <-2:+30/<-1:+12; WHZ<-3:+45/<-2:+25/>3:+25/>2:+12; WAZ<-3:+25/<-2:+15;
  HCZ<-2:+15 (kalau lingkar kepala diisi). Status akhir: skor≥45 →
  `malnutrisi`; HAZ<-2 → `stunting` (tetap dipaksa walau skor totalnya belum
  45 — stunting kronis tidak boleh "terdilusi" oleh skor gabungan yang masih
  rendah); skor≥20 → `berisiko`; selebihnya → `normal`. 4-tier
  (`normal`/`berisiko`/`stunting`/`malnutrisi`), bukan 3, mengikuti cara
  Kemenkes menilai status gizi (Permenkes No. 2/2020: TB/U, BB/TB, BB/U
  dinilai masing-masing) — "stunting" (kronis) dan "malnutrisi" (akut parah)
  sengaja dipisah karena urgensi rujukannya beda, bukan cuma "risiko" tunggal.
- **`classify_from_haz`/`classify_from_whz`/`classify_from_waz`/`classify_from_hcz`**
  — label tingkat per-indikator tunggal (dipakai untuk keterbacaan/test, bukan
  penentu `risk_status` gabungan — itu wewenang `score_risk()`).
- **Divalidasi** di `apps/growth/tests.py` (`python manage.py test apps.growth`)
  — test membandingkan hasil terhadap nilai SD/LMS yang benar-benar dikutip
  dari tabel resmi WHO (bukan cuma round-trip internal), untuk laki-laki &
  perempuan di rentang usia/ukuran berbeda, termasuk kombinasi HAZ+WHZ+WAZ+HCZ
  dan kasus skor gabungan (`ScoreRiskTests`).
- **Terpasang otomatis** di `GrowthRecordViewSet.perform_create()` **dan**
  `perform_update()` — tiap kali record dibuat/diedit, `height_for_age_z`,
  `weight_for_height_z`, `weight_for_age_z`, `head_circumference_z` (kalau
  lingkar kepala diisi), dan `risk_status` dihitung ulang dan disimpan.
- **Validasi kewajaran** di `GrowthRecordSerializer.validate()` — HAZ di luar
  [-6, +6], WHZ di luar [-5, +5], WAZ di luar [-6, +5], atau HCZ (kalau diisi)
  di luar [-5, +5] ditolak dengan `400` sebelum sempat tersimpan (ambang batas
  ini persis konvensi "implausible value flag" WHO Anthro/survei SMART, bukan
  angka buatan sendiri) — tanpa ini input yang salah ketik (mis. tinggi 200cm
  untuk bayi 6 bulan) akan lolos dan diklasifikasikan "normal" begitu saja
  alih-alih ditandai sebagai kemungkinan salah input.
- **Migrasi 3-tier → 4-tier**: `risk_status` yang tersimpan sebelumnya
  (`normal`/`watch`/`risk`) dihitung ulang lewat migrasi data
  (`0007_recompute_4tier_risk_status.py`) — `GrowthRecord` dihitung ulang dari
  Z-score asli yang sudah tersimpan (bukan remap string kasar), sedangkan
  `RiskAssessment` (log audit historis) cuma di-remap label
  (`watch→berisiko`, `risk→malnutrisi`) karena itu catatan titik-waktu, bukan
  status live.

### Kuesioner faktor risiko tambahan + rekomendasi (kader input, nakes baca)

- Field opsional di `GrowthRecord`: `clean_water_access`, `recurrent_illness`,
  `immunization_complete` (nullable — `null` berarti belum ditanya, beda dari
  `false` yang berarti sudah ditanya dan jawabannya negatif).
- **`risk_engine.questionnaire_recommendations(child, record)`** — menghasilkan
  daftar rekomendasi teks dari faktor risiko stunting umum yang sudah dikenal
  luas (ASI eksklusif, BBLR dari `Child.birth_weight_kg` < 2.5kg, akses air
  bersih/sanitasi, riwayat sakit/diare berulang, kelengkapan imunisasi) —
  pelengkap Z-score, bukan pengganti, dan tidak pernah membuat diagnosis,
  hanya menyarankan pemantauan/rujukan lebih lanjut.
- Diekspos sebagai field `recommendations` (read-only, dihitung ulang tiap
  request lewat `SerializerMethodField`, bukan disimpan) di
  `GrowthRecordSerializer` — selalu konsisten dengan logic terbaru tanpa perlu
  migrasi data lama.
- Pembagian kerja di frontend: **kader/nakes** mengisi kuesionernya langsung
  di form tambah/edit pengukuran (`ChildDashboard.tsx`) — masuk akal karena
  merekalah yang langsung berhadapan dengan orang tua saat pengukuran di
  lapangan. **kader_nakes** yang melihat `recommendations` di popup "Hasil
  Pengukuran" (`canEditDelete` gate, jadi otomatis tersembunyi dari
  orangtua untuk saat ini) — bahasanya masih ditujukan untuk disampaikan
  petugas ke orang tua saat konsultasi, belum ditulis ulang jadi bahasa
  awam untuk tampil langsung ke orangtua (bagian dari UI orangtua yang
  belum dikerjakan, lihat "Peran & tautan orang tua").
- Lihat bagian "Klasifikasi risiko" di atas untuk ambang batas
  `score_risk()` yang menentukan `risk_status`. Ini murni Tahap 1
  (rule-based) — model ML Tahap 2 nanti menambah lapisan di atasnya, bukan
  menggantikannya sepenuhnya (keputusan klinis, bukan cuma teknis).

### Tren pertumbuhan (2T) — sinyal dari histori, bukan cuma satu titik waktu

Z-score di atas cuma menilai satu momen pengukuran. Stunting sering baru
kelihatan dari **lintasan** pertumbuhan (growth faltering), bukan angka
tunggal — anak bisa saja masih "Normal" di satu pengukuran padahal
pertumbuhannya sedang melambat. Fitur ini memaksimalkan data historis yang
sudah tersimpan tanpa perlu input baru:

- **`risk_engine.classify_weight_trend(previous, current)`** — `'naik'` kalau
  berat naik dari pengukuran sebelumnya, `'tetap_turun'` kalau sama atau
  turun. Ini konvensi N/T Posyandu Indonesia (Buku KIA/KMS, Kemenkes RI),
  bukan ambang batas yang dikarang sendiri.
- **`risk_engine.has_2t_alert(trends)`** — `True` kalau **2 pengukuran
  berturut-turut** terakhir sama-sama `tetap_turun` ("2T") — pemicu rujukan
  standar ke Puskesmas di praktik posyandu, terlepas dari HAZ/WHZ-nya masih
  "normal" atau tidak.
- Diekspos sebagai `weight_trend` (per `GrowthRecord`, dibanding pengukuran
  sebelumnya untuk anak yang sama; `null` untuk pengukuran pertama) dan
  `growth_alert` (per `Child`, `'2T'` atau `null`, butuh minimal 3 pengukuran
  histori) — keduanya `SerializerMethodField`, dihitung ulang tiap request.
- Ditampilkan di frontend sebagai label "Naik"/"Tetap/Turun" di tiap baris
  riwayat (`ChildDashboard.tsx`), badge "2T" di kartu anak (`ChildrenList.tsx`),
  dan banner peringatan di kedua halaman kalau `growth_alert === '2T'`.

### Rentang normal sebagai panduan input — `GET /api/growth-reference/`

Validasi kewajaran ([-6,+6]/[-5,+5] HAZ/WHZ) baru menolak input **setelah**
disubmit. Fitur ini memberi kader/nakes gambaran rentang wajar **sebelum**
submit, langsung di form pengukuran, supaya salah ketik (salah unit, koma
kepindah) kelihatan lebih awal:

- **`who_reference._lms_inverse(z, L, M, S)`** — kebalikan rumus LMS, dipakai
  untuk mengubah ambang Z-score jadi angka ukuran (cm/kg) — persis cara tabel
  SD2neg/SD2 dst. di tabel resmi WHO sendiri dihasilkan.
- **`who_reference.height_range_for_age(age_months, sex)`** dan
  **`weight_range_for_height(height_cm, age_months, sex)`** — rentang -2SD
  s.d. +2SD, **band yang sama** dipakai `classify_from_haz`/`classify_from_whz`
  untuk status "normal" vs tidak. Ini panduan, bukan aturan validasi keras —
  anak nyata tetap bisa berada di luar rentang ini tanpa itu berarti salah
  input.
- Diekspos lewat `GET /api/growth-reference/?sex=male&ageMonths=18&heightCm=80`
  (`heightCm` opsional — kalau diisi, response juga menyertakan rentang berat;
  kalau tidak, hanya rentang tinggi). Endpoint ini `IsAuthenticated` saja,
  tanpa `RoleBasedGrowthPermission`, karena datanya cuma referensi baca,
  berguna untuk semua role.
- Di frontend (`ChildDashboard.tsx`), teks bantuan "Normal: X–Y cm/kg" muncul
  otomatis di bawah input Tinggi/Berat begitu tanggal pengukuran (→ usia) dan,
  untuk berat, tinggi badan yang sedang diisi tersedia — di-debounce 300ms
  supaya tidak memanggil API di tiap ketikan.
- Diuji di `GrowthRangeTests` (`tests.py`) terhadap nilai SD2neg/SD2 resmi WHO
  yang sama seperti dipakai `CalculateHazTests`/`CalculateWhzTests` — bukan
  cuma round-trip terhadap rumus sendiri.

## Permission berbasis role

Dua role publik (plus `admin` untuk superuser/ops):

| Role                                    | Lihat balita                     | Create/Update/Delete |
| --------------------------------------- | --------------------------------- | --------------------- |
| **admin** (superuser atau `role=admin`) | Semua                              | ✅                     |
| **kader_nakes**                         | Semua                              | ✅                     |
| **orangtua**                            | Hanya yang ditautkan (lihat bawah) | ❌ (403)               |

`kader_nakes` menggabungkan role `kader`/`nakes` lama menjadi satu — dulu
dipisah (kader create-only, nakes full CRUD) karena nakes dianggap
"memvalidasi" input kader, tapi di lapangan keduanya sama-sama dipercaya
penuh, jadi pemisahan itu cuma menambah friksi tanpa manfaat nyata. Role
`viewer` lama dihapus (0 akun aktif memakainya saat migrasi ditulis).

`RiskAssessmentView` dan `GrowthReferenceView` tidak dibatasi
`RoleBasedGrowthPermission` tambahan, tapi `RiskAssessmentView` tetap
scoped lewat `visible_children()` (orangtua tidak bisa lihat risk assessment
anak yang bukan miliknya, meski endpoint-nya sendiri tidak role-gated).

Diuji end-to-end di `apps/growth/tests.py`
(`RoleBasedGrowthPermissionAPITests`, `VisibleChildrenScopingTests`): create
sebagai orangtua → 403, GET balita yang belum ditautkan → 404 (bukan 403 —
lihat "Peran & tautan orang tua"), create/update/delete sebagai kader_nakes
→ 201/200/204.

**Frontend juga menyembunyikan/menonaktifkan tombol** sesuai role yang sama
persis (`src/api/auth.ts` → `canCreate()`/`canEditDelete()`), bukan cuma
mengandalkan backend menolak diam-diam. Ini dimungkinkan karena
`RoleTokenObtainPairSerializer` (`apps/accounts/tokens.py`) menyematkan
`role` dan `is_superuser` langsung ke payload JWT saat login/registrasi, jadi
frontend cukup men-decode token yang sudah dipegang tanpa request tambahan.
**Penting**: token yang diterbitkan sebelum perubahan ini tidak punya klaim
tersebut — sesi yang sedang login harus logout lalu login ulang supaya
tombolnya sesuai role.

## Peran & tautan orang tua

Balita hanya boleh dilihat oleh kader/nakes (semua) dan oleh akun orang tua
yang sudah ditautkan ke balita itu secara eksplisit — **tidak ada** scoping
implisit lewat nama/nomor HP yang cocok, supaya tidak ada orang tua yang
kebetulan salah lihat data anak keluarga lain.

- **`Child.link_code`** — kode 6-digit numerik unik, dibuat otomatis
  (`Child.save()`) saat balita didaftarkan. Kader menyampaikan kode ini
  langsung ke orang tua (lisan/tertulis di buku KIA), bukan lewat sistem.
- **`Child.parents`** (M2M ke `User`) — akun orang tua yang sudah tertaut.
  Satu balita bisa punya lebih dari satu orang tua tertaut (ayah & ibu).
- **`POST /api/children/link/`** (`{code}`) — endpoint yang dipanggil akun
  orangtua untuk menautkan dirinya sendiri. Kode salah → `400`; kode benar
  → balita langsung muncul di `GET /api/children/` milik akun itu. Menaut
  ulang dengan kode yang sama itu idempotent (tidak duplikat).
- **`POST /api/children/<id>/regenerate-code/`** (kader_nakes/admin saja) —
  membatalkan kode lama kalau salah disampaikan ke orang yang salah.
- **`visible_children(user)`** (`apps/growth/permissions.py`) — satu-satunya
  tempat logic scoping ditulis, dipakai `ChildViewSet.get_queryset()`,
  `GrowthRecordViewSet.get_queryset()` (lewat `child__in=`), dan
  `RiskAssessmentView`. kader_nakes/admin dapat `Child.objects.all()`;
  orangtua dapat `Child.objects.filter(parents=user)`.
- **`link_code` di response API** hanya tampil untuk kader_nakes/admin, atau
  untuk orang tua yang *sudah* tertaut ke balita itu (supaya bisa
  diteruskan ke pasangannya) — `ChildSerializer.get_link_code()`.
- **Gerbang pendaftaran `kader_nakes`**: role ini bisa lihat data semua
  keluarga, jadi pendaftaran publik ke role ini butuh
  `KADER_NAKES_INVITE_CODE` (env var, dipegang koordinator posyandu) —
  lihat `RegisterSerializer.validate()`. Role `orangtua` bebas daftar tanpa
  kode apa pun (blast radius-nya kecil: akun baru tidak lihat apa-apa
  sampai ditautkan ke balita).

**Belum dikerjakan (frontend)**: UI orang tua (dashboard sederhana per-anak,
form redeem kode, tampilan kode di sisi kader) — perubahan di README ini
baru mencakup fondasi backend + guard minimal di frontend supaya akun
kader_nakes/orangtua yang sudah ada tidak rusak setelah migrasi role.

## Cakupan API

| Method         | Path                               | View                  | Catatan                                                                                                                                |
| -------------- | ---------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| POST           | `/api/auth/login`                  | `RoleTokenObtainPairView` | Mengembalikan `{access, refresh}` dari SimpleJWT, dengan klaim `role`/`is_superuser`/`username` disematkan ke JWT (dipakai frontend untuk show/hide tombol) |
| POST           | `/api/auth/refresh`                | `TokenRefreshView`    |                                                                                                                                        |
| POST           | `/api/auth/register`               | `RegisterView`        | Publik (`AllowAny`); role terbatas ke kader_nakes/orangtua (admin tidak bisa daftar sendiri); kader_nakes butuh `invite_code` yang cocok dengan `KADER_NAKES_INVITE_CODE`; mengembalikan `{access, refresh}` langsung, klaim role juga disematkan |
| GET/POST       | `/api/children/`                   | `ChildViewSet`        | `?search=` berdasarkan nama; response array polos (tanpa pagination); daftar sudah discoping lewat `visible_children()`; POST/PUT/DELETE butuh role kader_nakes/admin |
| GET/PUT/DELETE | `/api/children/<id>/`              | `ChildViewSet`        | GET balita yang belum ditautkan (orangtua) → 404; PUT/DELETE butuh role kader_nakes/admin |
| POST           | `/api/children/link/`              | `LinkChildView`       | `{code}` — orangtua menautkan diri sendiri ke balita lewat `link_code`; kode salah → 400 |
| POST           | `/api/children/<id>/regenerate-code/` | `ChildViewSet`     | Membatalkan `link_code` lama; kader_nakes/admin saja |
| GET/POST       | `/api/growth-records/`             | `GrowthRecordViewSet` | Filter dengan `?child=<uuid>`; daftar sudah discoping lewat `visible_children()`; field `officer_name`/`location`/`notes`/`head_circumference_cm`/`photo` opsional (tidak diikutkan saat update = nilai lama tidak berubah); `photo` butuh `multipart/form-data` (sudah didukung `CamelCaseMultiPartParser`) kalau diisi; `height_for_age_z`/`weight_for_height_z`/`weight_for_age_z`/`head_circumference_z`/`risk_status` dihitung otomatis saat create/update |
| GET/PUT/DELETE | `/api/growth-records/<id>/`        | `GrowthRecordViewSet` | PUT/DELETE butuh role kader_nakes/admin                                                                                               |
| GET            | `/api/risk-assessment/<child_id>/` | `RiskAssessmentView`  | Membuat `RiskAssessment` baru setiap kali dipanggil; scoped lewat `visible_children()` (404 kalau balita bukan milik orangtua yang minta) |
| GET            | `/api/growth-reference/`           | `GrowthReferenceView` | Query params `sex`, `ageMonths` (wajib), `heightCm` (opsional); rentang -2SD..+2SD WHO sebagai panduan input, bukan validasi; `IsAuthenticated` saja, semua role boleh akses |
| GET/POST       | `/api/posyandu-schedules/`         | `PosyanduScheduleViewSet` | Jadwal kunjungan Posyandu, tidak terikat ke anak tertentu (tidak discoping — semua role lihat semua jadwal); permission sama persis `RoleBasedGrowthPermission` (kader_nakes/admin full CRUD, orangtua read-only) |
| GET/PUT/DELETE | `/api/posyandu-schedules/<id>/`    | `PosyanduScheduleViewSet` | PUT/DELETE butuh role kader_nakes/admin |

Semua endpoint mewajibkan autentikasi JWT (`IsAuthenticated`), ditambah
`RoleBasedGrowthPermission` di atas untuk `children`/`growth-records`.
Semua request/response JSON otomatis dikonversi camelCase ⇄ snake_case oleh
`djangorestframework-camel-case`, jadi frontend (yang pakai camelCase di
`src/types/index.ts`) dan backend (yang pakai snake_case di model Django)
tidak perlu saling menyesuaikan penamaan secara manual.

## Foto balita (dokumentasi, bukan AI-vision)

- `GrowthRecord.photo` (opsional, `ImageField`) — dokumentasi pertumbuhan
  saja, **tidak** dipakai untuk estimasi ukuran otomatis dari gambar
  (butuh sensor depth/ToF + dataset besar yang tidak tersedia di sini).
- Perlu `Pillow` (validasi file benar-benar gambar) — sudah di
  `requirements.txt`.
- Disimpan di `MEDIA_ROOT` (`media/`) dan disajikan langsung oleh Django
  lewat `config/urls.py` (bukan lewat nginx) — trafiknya kecil (foto
  dokumentasi kader, bukan skala publik), jadi ini simplifikasi yang
  disengaja, bukan kelalaian konfigurasi produksi.
- Butuh folder `media/` dengan permission `www-data` di VPS setelah
  deploy pertama kali (`mkdir -p media && chown www-data:www-data media`).

## TODO (sisa pekerjaan)

Satu-satunya yang sengaja belum dikerjakan: **Model ML Tahap 2** — menunggu
Tahap 1 rule-based (HAZ+WHZ, sudah selesai) stabil dan tervalidasi dulu di
penggunaan nyata sebelum menambah lapisan prediktif di atasnya.
