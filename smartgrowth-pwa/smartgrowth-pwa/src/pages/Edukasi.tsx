import { Baby, HeartHandshake, ShieldAlert, Soup, Stethoscope } from 'lucide-react';

// Materi singkat, konsisten dengan faktor risiko & indikator yang sudah
// dipakai di risk_engine.py (questionnaire_recommendations, score_risk) —
// bukan klaim medis baru. Bukan pengganti konsultasi tenaga kesehatan.
const topics = [
  {
    icon: HeartHandshake,
    title: 'ASI Eksklusif (0–6 bulan)',
    body:
      'Berikan ASI saja tanpa makanan/minuman tambahan lain selama 6 bulan pertama. ASI eksklusif adalah salah ' +
      'satu faktor pelindung utama terhadap risiko stunting yang dipakai dalam kuesioner skrining di aplikasi ini.'
  },
  {
    icon: Soup,
    title: 'MPASI Bergizi Seimbang (setelah 6 bulan)',
    body:
      'Setelah 6 bulan, lanjutkan ASI sambil memperkenalkan Makanan Pendamping ASI (MPASI) yang bergizi seimbang ' +
      '— cukup protein hewani, tidak hanya karbohidrat. Kekurangan gizi di periode ini berkontribusi besar pada ' +
      'stunting.'
  },
  {
    icon: Baby,
    title: '1000 Hari Pertama Kehidupan (HPK)',
    body:
      'Periode sejak kehamilan sampai anak berusia 2 tahun adalah "jendela emas" pertumbuhan — kekurangan gizi ' +
      'pada masa ini paling berdampak dan paling sulit "dikejar" setelahnya. Pemantauan berat/tinggi rutin di ' +
      'periode ini sangat penting.'
  },
  {
    icon: ShieldAlert,
    title: 'Tanda yang Perlu Diwaspadai',
    body:
      'Berat badan tidak naik dua kali pengukuran berturut-turut ("2T"), riwayat sakit/diare berulang, akses air ' +
      'bersih & sanitasi yang kurang layak, serta imunisasi yang belum lengkap — semua ini adalah indikator yang ' +
      'juga dipakai sistem skrining di aplikasi ini untuk menandai anak yang perlu perhatian lebih.'
  },
  {
    icon: Stethoscope,
    title: 'Pentingnya Pemantauan Rutin di Posyandu',
    body:
      'Timbang & ukur balita secara rutin setiap bulan di Posyandu memungkinkan masalah pertumbuhan terdeteksi ' +
      'sedini mungkin, sebelum berkembang menjadi stunting atau malnutrisi yang lebih sulit ditangani.'
  }
];

export default function Edukasi() {
  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-display font-semibold text-gray-900">Edukasi</h1>
      <div className="space-y-3">
        {topics.map((topic) => (
          <div key={topic.title} className="card p-4 space-y-2">
            <p className="flex items-center gap-2 font-medium text-gray-900">
              <topic.icon className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
              {topic.title}
            </p>
            <p className="text-sm text-gray-600">{topic.body}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 text-center px-4">
        Materi di halaman ini adalah edukasi umum, bukan pengganti konsultasi dengan tenaga kesehatan (nakes) atau
        ahli gizi.
      </p>
    </div>
  );
}
