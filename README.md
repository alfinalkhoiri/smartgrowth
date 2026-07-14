# SmartGrowth

Sistem telescreening berbasis AI untuk deteksi dini risiko **stunting** dan
**wasting** pada balita, sekaligus monitoring pertumbuhan rutin. Kolaborasi
Fakultas Ilmu Komputer × Fakultas Kedokteran, President University.

## Fitur utama

- **Klasifikasi risiko berbasis Z-score WHO** — Height-for-Age (stunting) dan
  Weight-for-Length/Height (wasting), dihitung dari tabel referensi resmi WHO
  Child Growth Standards (bukan rumus perkiraan), dengan status akhir yang
  mengambil kondisi **paling parah** dari keduanya.
- **CRUD lengkap** untuk data balita dan riwayat pengukuran pertumbuhan,
  lengkap dengan grafik tinggi terhadap usia.
- **Permission berbasis role** — kader (input data), nakes (validasi & CRUD
  penuh), viewer (read-only), admin (full access).
- **Autentikasi JWT** dengan login & registrasi publik (role kader/nakes/viewer).
- **PWA offline-first** — tetap bisa dibuka dan menampilkan data yang sudah
  di-cache tanpa koneksi internet, ditujukan untuk kader posyandu di area
  dengan konektivitas terbatas.

## Struktur repo

```
smartgrowth/
├── smartgrowth-backend/   # Django REST Framework — API, model, logika Z-score WHO
└── smartgrowth-pwa/       # React + TypeScript + Vite — PWA frontend
```

Dokumentasi setup, arsitektur, dan detail teknis masing-masing ada di README
tiap folder:

- [`smartgrowth-backend/smartgrowth-backend/README.md`](smartgrowth-backend/smartgrowth-backend/README.md) —
  setup Django, cakupan API, alur perhitungan risiko, permission per role.
- [`smartgrowth-pwa/smartgrowth-pwa/README.md`](smartgrowth-pwa/smartgrowth-pwa/README.md) —
  setup Vite/PWA, alasan desain (Capacitor-ready, offline-first), alur auth.

## Menjalankan secara lokal (ringkas)

1. **Backend**: ikuti bagian "Setup" di README backend, jalankan
   `python manage.py runserver` (port 8000).
2. **Frontend**: butuh Node.js 18+, ikuti bagian "Local development" di
   README frontend, jalankan `npm run dev` (port 5173) — proxy `/api/*` ke
   backend sudah dikonfigurasi.
3. Buka `http://localhost:5173`, daftar/masuk, lalu mulai input data balita.

## Deploy ke production

Live di **https://smartgrowth.f-mc.my.id**. Detail infrastruktur deployment
sengaja tidak didokumentasikan di repo publik ini.

## Status

Klasifikasi risiko Tahap 1 (rule-based, WHO Z-score) sudah selesai dan
tervalidasi terhadap data resmi WHO (lihat unit test di
`smartgrowth-backend/smartgrowth-backend/apps/growth/tests.py`). Model
prediktif Tahap 2 (ML) sengaja belum dikerjakan — menunggu Tahap 1 stabil di
penggunaan nyata terlebih dahulu.
