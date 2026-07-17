import {
  Baby,
  BookOpen,
  Bug,
  CalendarClock,
  ChevronDown,
  Droplets,
  HeartHandshake,
  Moon,
  ShieldAlert,
  Soup,
  Sparkles,
  Stethoscope,
  Users
} from 'lucide-react';

// Materi konsisten dengan indikator/rekomendasi yang sudah dipakai di
// risk_engine.py (questionnaire_recommendations, score_risk, has_2t_alert)
// — bukan klaim medis baru. Bukan pengganti konsultasi tenaga kesehatan.

const dailyTips = [
  {
    icon: CalendarClock,
    title: 'Rutin ke Posyandu',
    body: 'Setiap bulan timbang BB, ukur TB & lingkar kepala. Pantau di KMS.'
  },
  {
    icon: Users,
    title: 'Libatkan Ayah',
    body: 'Pengasuhan adalah tanggung jawab bersama. Ayah aktif = anak tumbuh optimal.'
  },
  {
    icon: Stethoscope,
    title: 'Konsultasi Bidan',
    body: 'Jangan ragu bertanya pada bidan/kader bila ada keraguan tumbuh kembang.'
  },
  {
    icon: Soup,
    title: 'Variasi Menu',
    body: 'Ganti-ganti bahan pangan lokal: telur, ikan, lele, tempe, daun kelor.'
  }
];

const topics = [
  {
    icon: HeartHandshake,
    title: 'ASI & MPASI untuk Ibu',
    points: [
      'ASI eksklusif 0-6 bulan tanpa makanan/minuman tambahan, termasuk air putih.',
      'Mulai MPASI tepat 6 bulan dengan tekstur kental bertahap (puree -> lumat -> cincang).',
      'Beri makan responsif: kenali tanda lapar & kenyang, jangan dipaksa.',
      'Lanjutkan ASI hingga usia 2 tahun bersamaan dengan MPASI.',
      'Cuci tangan & alat makan sebelum menyiapkan makanan bayi.'
    ]
  },
  {
    icon: Soup,
    title: 'Gizi Seimbang Balita (Isi Piringku)',
    points: [
      'Penuhi 4 bintang setiap makan: karbohidrat, protein hewani, sayur/buah, lemak sehat.',
      'Protein hewani (telur, ikan, ayam, hati, susu) WAJIB setiap hari — sangat penting cegah stunting.',
      'Beri 3x makan utama + 2x camilan sehat (buah, ubi rebus, kacang hijau).',
      'Batasi gula, garam, MSG, dan makanan ultra-proses (snack kemasan, minuman manis).',
      'Sajikan menu beragam dan menarik agar tidak bosan.'
    ]
  },
  {
    icon: Sparkles,
    title: 'Stimulasi Tumbuh Kembang',
    points: [
      'Ajak bicara, baca buku, dan bernyanyi minimal 15 menit setiap hari.',
      'Beri kesempatan merangkak, berjalan, memanjat & bermain aktif di luar rumah.',
      'Pantau milestone: tengkurap (4 bln), duduk (6 bln), jalan (12 bln), bicara 2 kata (24 bln).',
      'Batasi screen time: 0 untuk usia < 2 tahun, maks 1 jam/hari untuk usia 2-5 tahun.',
      'Berikan kasih sayang & rutinitas yang konsisten untuk rasa aman anak.'
    ]
  },
  {
    icon: Bug,
    title: 'Pencegahan Penyakit & Imunisasi',
    points: [
      'Lengkapi imunisasi dasar sesuai jadwal IDAI (Hepatitis B, BCG, Polio, DPT, Campak, MR).',
      'Cuci tangan pakai sabun sebelum makan & setelah dari toilet.',
      'Berikan kapsul Vitamin A setiap Februari & Agustus di Posyandu.',
      'Berikan obat cacing tiap 6 bulan mulai usia 1 tahun.',
      'Segera bawa ke faskes bila demam tinggi, diare berulang, atau anak lemas.'
    ]
  },
  {
    icon: Droplets,
    title: 'Sanitasi & Kebersihan Lingkungan',
    points: [
      'Gunakan air bersih untuk masak, minum, dan mandi.',
      'Jamban sehat — jangan BAB sembarangan, cegah infeksi cacing & diare.',
      'Jaga rumah bebas asap rokok — paparan rokok hambat pertumbuhan anak.',
      'Bersihkan mainan dan area bermain anak secara rutin.',
      'Pisahkan tempat penyimpanan makanan mentah dan matang.'
    ]
  },
  {
    icon: Moon,
    title: 'Pola Tidur & Aktivitas Fisik',
    points: [
      'Tidur cukup: bayi 14-17 jam, balita 1-2 thn 11-14 jam, 3-5 thn 10-13 jam.',
      'Tidur berkualitas memicu hormon pertumbuhan (GH) yang optimal.',
      'Aktivitas fisik min. 180 menit/hari (bermain aktif) untuk balita.',
      'Rutin berjemur pagi 10-15 menit untuk vitamin D & tulang kuat.'
    ]
  },
  {
    icon: Baby,
    title: '1.000 Hari Pertama Kehidupan (HPK)',
    points: [
      'Periode emas: 270 hari kehamilan + 730 hari (2 tahun) pertama.',
      'Ibu hamil konsumsi Tablet Tambah Darah (TTD) minimal 90 tablet.',
      'Pemeriksaan kehamilan (ANC) minimal 6x di faskes.',
      'Inisiasi Menyusu Dini (IMD) segera setelah lahir.',
      'Kerusakan akibat stunting di periode ini sulit diperbaiki setelah usia 2 tahun.'
    ]
  },
  {
    icon: ShieldAlert,
    title: 'Tanda Bahaya — Segera ke Faskes',
    points: [
      'Berat badan tidak naik 2 bulan berturut-turut (BB tetap/turun).',
      'Anak terlihat sangat kurus, lemas, atau bengkak di kaki.',
      'Tidak mau makan/minum, muntah terus-menerus.',
      'Diare > 3 hari, demam tinggi > 3 hari, atau kejang.',
      'Keterlambatan perkembangan motorik/bicara jauh dari teman seusianya.'
    ]
  }
];

const followUp = {
  icon: Sparkles,
  title: 'Tindak Lanjut Sesuai Hasil Skrining',
  points: [
    'Normal: kunjungan Posyandu bulanan, pertahankan pola gizi & stimulasi.',
    'Berisiko: pantau 2 minggu sekali, evaluasi pola makan & konsultasi kader.',
    'Stunting: rujuk Puskesmas, ikuti program PMT & suplementasi mikronutrien.',
    'Malnutrisi/Gizi buruk: rujukan segera ke RS untuk tata laksana intensif.'
  ]
};

const isiPiringku = [
  { label: '1/3 Karbohidrat', desc: 'Nasi, kentang, roti' },
  { label: '1/3 Sayur', desc: 'Bayam, wortel, brokoli' },
  { label: '1/6 Buah', desc: 'Pisang, pepaya, jeruk' },
  { label: '1/6 Protein', desc: 'Telur, ikan, ayam, tahu' }
];

const mitosFakta = [
  {
    mitos: 'Anak pendek itu turunan keluarga, jadi wajar saja.',
    fakta: 'Tinggi badan memang dipengaruhi genetik, tetapi stunting adalah kegagalan tumbuh akibat gizi kronis dan infeksi — bisa dicegah dengan gizi dan pola asuh yang baik.'
  },
  {
    mitos: 'Bayi <6 bulan boleh diberi pisang atau bubur biar kenyang.',
    fakta: 'TIDAK BOLEH. Saluran cerna bayi belum siap. ASI eksklusif sudah cukup memenuhi semua kebutuhan gizi 0-6 bulan.'
  },
  {
    mitos: 'Anak gemuk pasti sehat dan tidak stunting.',
    fakta: 'Salah. Anak bisa gemuk tapi pendek (stunting + obesitas) karena kelebihan karbohidrat & gula, tapi kurang protein hewani.'
  },
  {
    mitos: 'Susu kental manis bagus untuk pertumbuhan anak.',
    fakta: 'Tidak. Susu kental manis tinggi gula, rendah protein, dan BUKAN pengganti susu. Berikan susu pertumbuhan atau UHT plain.'
  }
];

const faqs = [
  {
    q: 'Apa beda stunting dengan pendek biasa?',
    a: 'Stunting adalah kondisi tinggi badan menurut umur di bawah -2SD standar WHO akibat gizi kronis, bukan sekadar variasi tinggi badan normal antar individu/keturunan.'
  },
  {
    q: 'Kapan stunting masih bisa dicegah?',
    a: 'Paling efektif dalam 1.000 Hari Pertama Kehidupan (sejak kehamilan sampai usia 2 tahun). Setelah usia 2 tahun, dampaknya jauh lebih sulit diperbaiki.'
  },
  {
    q: 'Apakah anak saya pasti stunting kalau hasil skrining berisiko?',
    a: 'Belum tentu. Status "berisiko" berarti perlu pemantauan lebih ketat, bukan diagnosis pasti. Konsultasikan ke bidan/nakes untuk evaluasi lebih lanjut.'
  },
  {
    q: 'Berapa kali sebaiknya anak makan dalam sehari?',
    a: '3 kali makan utama ditambah 2 kali camilan sehat, dengan porsi dan tekstur disesuaikan usia anak.'
  },
  {
    q: 'Bagaimana cara mengukur tinggi balita dengan benar?',
    a: 'Anak di bawah 2 tahun diukur berbaring (panjang badan/PB), anak 2 tahun ke atas diukur berdiri (tinggi badan/TB), memakai alat ukur standar dan dilakukan oleh kader/nakes terlatih.'
  },
  {
    q: 'Anak susah makan, apa yang harus dilakukan?',
    a: 'Coba variasikan tekstur & menu, makan bersama keluarga tanpa distraksi gawai, jangan memaksa, dan konsultasikan ke bidan/kader bila berlangsung lama.'
  },
  {
    q: 'Apakah aplikasi ini menggantikan dokter?',
    a: 'Tidak. Aplikasi ini adalah alat skrining awal berbasis standar WHO. Hasilnya membantu deteksi dini, tetapi diagnosis dan penanganan tetap wewenang tenaga kesehatan.'
  }
];

function TopicCard({ icon: Icon, title, points }: { icon: typeof Baby; title: string; points: string[] }) {
  return (
    <div className="card p-5 space-y-2">
      <p className="flex items-center gap-2 font-display font-bold text-gray-900">
        <Icon className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
        {title}
      </p>
      <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
        {points.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </div>
  );
}

export default function Edukasi() {
  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="flex items-center gap-2 font-display font-extrabold text-2xl text-gray-900">
          <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" />
          Edukasi Gizi &amp; Tumbuh Kembang
        </h1>
        <p className="text-sm text-gray-500">
          Panduan lengkap untuk Ayah &amp; Bunda dalam mendampingi pertumbuhan si Kecil — mulai dari kehamilan, ASI,
          MPASI, hingga balita 5 tahun. Cegah stunting bersama dari rumah.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          Tips Harian untuk Ayah &amp; Bunda
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {dailyTips.map((tip) => (
            <div key={tip.title} className="rounded-lg bg-primary-light/60 p-3 space-y-1.5">
              <tip.icon className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-medium text-gray-900">{tip.title}</p>
              <p className="text-xs text-gray-600">{tip.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {topics.map((topic) => (
          <TopicCard key={topic.title} icon={topic.icon} title={topic.title} points={topic.points} />
        ))}
        <div className="sm:col-span-2">
          <TopicCard icon={followUp.icon} title={followUp.title} points={followUp.points} />
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <p className="font-display font-bold text-gray-900">Isi Piringku Balita</p>
        <p className="text-xs text-gray-500">Pedoman Kementerian Kesehatan RI</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {isiPiringku.map((item) => (
            <div key={item.label} className="rounded-lg border border-gray-100 p-3 text-center space-y-1">
              <p className="text-sm font-semibold text-primary">{item.label}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
          <ShieldAlert className="h-4 w-4 text-amber-500" aria-hidden="true" />
          Mitos vs Fakta Seputar Stunting
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {mitosFakta.map((item, i) => (
            <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-600 mb-1">MITOS</p>
                <p className="text-sm text-red-800">{item.mitos}</p>
              </div>
              <div className="bg-green-50 p-3">
                <p className="text-xs font-semibold text-green-700 mb-1">FAKTA</p>
                <p className="text-sm text-green-900">{item.fakta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5 space-y-2">
        <p className="font-display font-bold text-gray-900">Pertanyaan Sering Diajukan Orang Tua</p>
        <div className="divide-y divide-gray-100">
          {faqs.map((item, i) => (
            <details key={i} className="group py-2">
              <summary className="flex items-center justify-between gap-2 cursor-pointer list-none text-sm font-medium text-gray-800">
                {item.q}
                <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 group-open:rotate-180 transition-transform" aria-hidden="true" />
              </summary>
              <p className="text-sm text-gray-600 mt-2">{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-primary-light/60 p-5">
        <p className="flex items-center gap-1.5 font-display font-bold text-gray-900 mb-1">
          <HeartHandshake className="h-4 w-4 text-primary" aria-hidden="true" />
          Pesan untuk Ayah &amp; Bunda
        </p>
        <p className="text-sm text-gray-700">
          Pertumbuhan optimal adalah hasil kerja sama keluarga. Berikan gizi terbaik, kasih sayang, stimulasi, dan
          rutin pantau ke Posyandu. Jangan ragu konsultasi pada bidan/dokter bila menemui keraguan.
        </p>
      </div>
    </div>
  );
}
