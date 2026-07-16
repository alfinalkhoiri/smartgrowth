# SmartGrowth Backend (Django REST Framework)

## Cara penggunaan sistem (alur pengguna)

1. **Daftar / Masuk** — buka frontend, daftar akun baru (peran kader/nakes/
   viewer) lewat halaman Register, atau masuk lewat halaman Login kalau sudah
   punya akun. Admin tidak bisa daftar sendiri — dibuat lewat `createsuperuser`.
2. **Tambah data balita** — di halaman "Daftar Balita", kader/nakes/admin bisa
   menambahkan balita baru (nama, tanggal lahir, jenis kelamin, opsional berat
   lahir & status ASI eksklusif). Viewer hanya bisa melihat daftar yang sudah ada.
3. **Input pengukuran pertumbuhan** — buka dashboard salah satu balita, lalu
   catat pengukuran baru: tanggal ukur, berat (kg), tinggi (cm). Usia dalam
   bulan dihitung otomatis dari tanggal lahir balita.
4. **Sistem menghitung status risiko secara otomatis** — begitu pengukuran
   disimpan, backend langsung menghitung Z-score WHO dan menampilkan status
   **Normal**, **Perlu Pemantauan**, atau **Berisiko Stunting** sebagai badge
   di dashboard (lihat "Alur sistem" di bawah untuk detail perhitungannya).
5. **Lihat riwayat & grafik** — dashboard menampilkan grafik tinggi terhadap
   usia serta daftar seluruh riwayat pengukuran balita tersebut.
6. **Koreksi data (nakes/admin)** — nakes atau admin bisa mengedit atau
   menghapus data balita/pengukuran yang salah input; kader hanya bisa
   menambah data baru (tidak bisa edit/hapus), sesuai matriks permission di
   bawah.

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
            ▼
classify_growth_record(haz, whz)
    - classify_from_haz(haz):  Z<-3 → risk · Z<-2 → watch · lainnya → normal
    - classify_from_whz(whz):  Z<-3 → risk · Z<-2 → watch · lainnya → normal
    - ambil status yang PALING PARAH dari keduanya
            │
            ▼
Simpan ke GrowthRecord: height_for_age_z, weight_for_height_z, risk_status
            │
            ▼
Response JSON (camelCase) balik ke frontend
            │
            ▼
<RiskBadge> di ChildDashboard.tsx menampilkan:
    "normal" → hijau "Normal"
    "watch"  → kuning "Perlu Pemantauan"
    "risk"   → merah  "Berisiko Stunting"
```

Poin penting dari alur ini:

- Perhitungan **selalu** memakai data resmi WHO (tabel CSV di
  `apps/growth/services/data/`), bukan rumus perkiraan — lihat bagian
  "Klasifikasi risiko" di bawah untuk sumber datanya.
- Status yang tampil bisa dipicu oleh **stunting (HAZ) maupun wasting (WHZ)**
  secara independen — anak dengan tinggi normal tapi berat sangat kurang tetap
  akan tampil "Berisiko" karena wasting, bukan cuma dilihat dari tinggi badan.
- `GET /api/risk-assessment/<child_id>/` melakukan hal serupa tapi
  berdasarkan pengukuran **terakhir** yang tersimpan, dan menambahkan faktor
  risiko lain (status ASI eksklusif) — dipakai kalau butuh penilaian ulang
  tanpa menambah data pengukuran baru.

## Struktur

```
config/              # settings, root urls, wsgi
apps/accounts/        # custom User model dengan field role (admin/kader/nakes/viewer)
apps/growth/
  models.py           # Child, GrowthRecord, RiskAssessment
  serializers.py
  views.py            # ChildViewSet, GrowthRecordViewSet, RiskAssessmentView
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

## Klasifikasi risiko (WHO Height-for-Age + Weight-for-Length/Height Z-score)

- **Sumber data**: tabel LMS resmi WHO Child Growth Standards — Length/Height-for-Age
  (stunting, resolusi harian day 0–1856 / ≈0–60.97 bulan) dan Weight-for-Length
  0–2th / Weight-for-Height 2–5th (wasting, resolusi 0.1cm) — untuk laki-laki
  dan perempuan, diunduh dari https://www.who.int/tools/child-growth-standards
  dan disimpan sebagai CSV di `apps/growth/services/data/`.
- **`who_reference.lms_for_age(age_months, sex)`** — (L, M, S) Height-for-Age
  untuk usia tertentu. **`who_reference.lms_for_weight(height_cm, age_months, sex)`**
  — (L, M, S) Weight-for-Length/Height, otomatis pilih tabel WFL (di bawah 24
  bulan) atau WFH (24 bulan ke atas) sesuai konvensi resmi WHO. Keduanya
  interpolasi linear antar baris terdekat; nilai di luar rentang tabel
  di-clamp ke ujung terdekat (tidak melempar error).
- **`risk_engine.calculate_haz()`** dan **`calculate_whz()`** — rumus LMS
  standar WHO: `Z = (((ukuran/M)^L) - 1) / (L*S)` (atau `ln(ukuran/M)/S` kalau
  L=0). Height-for-Age punya L=1 tetap; Weight-for-Length/Height punya L
  negatif (ada skewness), makanya rumus umum tetap dipakai, bukan hanya kasus
  khusus L=1.
- **`risk_engine.classify_growth_record(haz, whz)`** — mengambil status yang
  **lebih parah** antara klasifikasi HAZ (stunting, kronis) dan WHZ (wasting,
  akut), karena anak bisa wasting tanpa (belum) stunting atau sebaliknya —
  keduanya sinyal klinis yang berbeda dan sama-sama penting.
- **Divalidasi** di `apps/growth/tests.py` (`python manage.py test apps.growth`)
  — 20 test membandingkan hasil terhadap nilai SD/LMS yang benar-benar dikutip
  dari tabel resmi WHO (bukan cuma round-trip internal), untuk laki-laki &
  perempuan di rentang usia/ukuran berbeda, termasuk kasus kombinasi HAZ+WHZ.
- **Terpasang otomatis** di `GrowthRecordViewSet.perform_create()` **dan**
  `perform_update()` — tiap kali record dibuat/diedit, `height_for_age_z`,
  `weight_for_height_z`, dan `risk_status` (`normal` / `watch` / `risk`)
  dihitung ulang dan disimpan.
- **Validasi kewajaran** di `GrowthRecordSerializer.validate()` — HAZ di luar
  [-6, +6] atau WHZ di luar [-5, +5] ditolak dengan `400` sebelum sempat
  tersimpan (ambang batas ini persis konvensi "implausible value flag" WHO
  Anthro/survei SMART, bukan angka buatan sendiri). `classify_from_haz`/
  `classify_from_whz` cuma mengecek ekor negatif untuk stunting/wasting, jadi
  tanpa ini input yang salah ketik (mis. tinggi 200cm untuk bayi 6 bulan)
  akan lolos dan diklasifikasikan "normal" begitu saja alih-alih ditandai
  sebagai kemungkinan salah input.

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
- Pembagian kerja di frontend: **kader** mengisi kuesionernya langsung di form
  tambah/edit pengukuran (`ChildDashboard.tsx`) — masuk akal karena kader yang
  langsung berhadapan dengan orang tua saat pengukuran di lapangan. Field-nya
  ikut tersimpan lewat `POST`/`PUT` `growth-records` yang sama, jadi tidak
  perlu perluasan permission (kader tetap hanya bisa create, tidak update).
  **Nakes/admin** yang melihat `recommendations` di popup "Hasil Pengukuran"
  (kader/viewer tidak) — dimaksudkan untuk disampaikan langsung ke orang
  tua/pasien saat konsultasi.
- Threshold (`classify_from_haz`/`classify_from_whz`): Z < -3 → `risk` (berat),
  Z < -2 → `watch` (perlu pemantauan), selebihnya → `normal`. Ini murni Tahap 1
  (rule-based) — model ML Tahap 2 nanti menambah lapisan di atasnya, bukan
  menggantikannya sepenuhnya (keputusan klinis, bukan cuma teknis).

## Permission berbasis role

`apps/growth/permissions.py` → `RoleBasedGrowthPermission`, diterapkan di
`ChildViewSet` dan `GrowthRecordViewSet`:

| Role                                    | Read | Create   | Update   | Delete   |
| --------------------------------------- | ---- | -------- | -------- | -------- |
| **admin** (superuser atau `role=admin`) | ✅   | ✅       | ✅       | ✅       |
| **nakes**                               | ✅   | ✅       | ✅       | ✅       |
| **kader**                               | ✅   | ✅       | ❌ (403) | ❌ (403) |
| **viewer**                              | ✅   | ❌ (403) | ❌ (403) | ❌ (403) |

Alasannya: kader (kader posyandu) input data di lapangan, tapi koreksi/hapus
data adalah wewenang nakes (tenaga kesehatan) yang memvalidasi. `RiskAssessmentView`
sengaja tidak dibatasi role tambahan — semua role yang sudah login boleh
melihat hasil penilaian risiko.

Sudah diuji end-to-end dengan akun tiap role (create sebagai kader → 201,
update/delete sebagai kader → 403, create sebagai viewer → 403, update/delete
sebagai nakes → 200/204).

**Frontend juga menyembunyikan/menonaktifkan tombol** sesuai role yang sama
persis (`src/api/auth.ts` → `canCreate()`/`canEditDelete()`), bukan cuma
mengandalkan backend menolak diam-diam. Ini dimungkinkan karena
`RoleTokenObtainPairSerializer` (`apps/accounts/tokens.py`) menyematkan
`role` dan `is_superuser` langsung ke payload JWT saat login/registrasi, jadi
frontend cukup men-decode token yang sudah dipegang tanpa request tambahan.
**Penting**: token yang diterbitkan sebelum perubahan ini tidak punya klaim
tersebut — sesi yang sedang login harus logout lalu login ulang supaya
tombolnya sesuai role.

## Cakupan API

| Method         | Path                               | View                  | Catatan                                                                                                                                |
| -------------- | ---------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| POST           | `/api/auth/login`                  | `RoleTokenObtainPairView` | Mengembalikan `{access, refresh}` dari SimpleJWT, dengan klaim `role`/`is_superuser`/`username` disematkan ke JWT (dipakai frontend untuk show/hide tombol) |
| POST           | `/api/auth/refresh`                | `TokenRefreshView`    |                                                                                                                                        |
| POST           | `/api/auth/register`               | `RegisterView`        | Publik (`AllowAny`); role terbatas ke kader/nakes/viewer (admin tidak bisa daftar sendiri); mengembalikan `{access, refresh}` langsung, klaim role juga disematkan |
| GET/POST       | `/api/children/`                   | `ChildViewSet`        | `?search=` berdasarkan nama; response array polos (tanpa pagination); POST butuh role kader/nakes/admin                                |
| GET/PUT/DELETE | `/api/children/<id>/`              | `ChildViewSet`        | PUT/DELETE butuh role nakes/admin                                                                                                      |
| GET/POST       | `/api/growth-records/`             | `GrowthRecordViewSet` | Filter dengan `?child=<uuid>`; field `officer_name`/`location`/`notes` opsional (bebas teks, tidak diikutkan saat update = nilai lama tidak berubah); `height_for_age_z`/`weight_for_height_z`/`risk_status` dihitung otomatis saat create/update |
| GET/PUT/DELETE | `/api/growth-records/<id>/`        | `GrowthRecordViewSet` | PUT/DELETE butuh role nakes/admin                                                                                                      |
| GET            | `/api/risk-assessment/<child_id>/` | `RiskAssessmentView`  | Membuat `RiskAssessment` baru setiap kali dipanggil; semua role boleh akses                                                            |

Semua endpoint mewajibkan autentikasi JWT (`IsAuthenticated`), ditambah
`RoleBasedGrowthPermission` di atas untuk `children`/`growth-records`.
Semua request/response JSON otomatis dikonversi camelCase ⇄ snake_case oleh
`djangorestframework-camel-case`, jadi frontend (yang pakai camelCase di
`src/types/index.ts`) dan backend (yang pakai snake_case di model Django)
tidak perlu saling menyesuaikan penamaan secara manual.

## TODO (sisa pekerjaan)

Satu-satunya yang sengaja belum dikerjakan: **Model ML Tahap 2** — menunggu
Tahap 1 rule-based (HAZ+WHZ, sudah selesai) stabil dan tervalidasi dulu di
penggunaan nyata sebelum menambah lapisan prediktif di atasnya.
