import type { RiskStatus } from '@/types';

export interface NutritionTipGroup {
  title: string;
  tips: string[];
}

// General, non-prescriptive guidance per risk tier — grounded in widely-cited
// WHO/Kemenkes stunting-prevention themes (animal protein + zinc/iron for
// catch-up growth, calorie density via healthy fats, therapeutic feeding
// terms for severe cases), same spirit as risk_engine.questionnaire_
// recommendations() on the backend but written for a parent to read
// directly, not as an instruction to a health worker. Never a diagnosis or
// meal plan — always points to a nakes/Puskesmas for anything specific.
export function nutritionTipsFor(status: RiskStatus | undefined): NutritionTipGroup[] {
  switch (status) {
    case 'stunting':
      return [
        {
          title: 'Makanan Padat Gizi untuk Kejar Tumbuh',
          tips: [
            'Utamakan protein hewani (telur, ikan, hati ayam, daging) di setiap kali makan — sumber zat besi & zink yang penting untuk pertumbuhan tinggi badan.',
            'Tambahkan sumber lemak sehat (minyak, santan, mentega, alpukat) supaya makanan lebih padat kalori tanpa harus memperbesar porsi.',
            'Beri makan lebih sering: 3x makan utama + 2 kali selingan bergizi setiap hari.'
          ]
        },
        {
          title: 'Minuman',
          tips: [
            'Lanjutkan ASI sampai usia 2 tahun bila masih menyusui.',
            'Hindari minuman manis/kemasan yang membuat kenyang tanpa gizi — utamakan air putih dan susu.'
          ]
        },
        {
          title: 'Langkah Selanjutnya',
          tips: [
            'Bawa anak ke Puskesmas untuk evaluasi status gizi lebih lanjut oleh tenaga kesehatan.',
            'Ikuti jadwal pemantauan tumbuh kembang di Posyandu secara rutin.'
          ]
        }
      ];
    case 'malnutrisi':
      return [
        {
          title: 'Butuh Penanganan Segera',
          tips: [
            'Segera bawa anak ke Puskesmas/fasilitas kesehatan terdekat untuk penanganan malnutrisi akut.',
            'Ikuti anjuran pemberian makanan terapeutik (F-75/F-100/RUTF) dari tenaga kesehatan bila diresepkan — jangan memberikannya sendiri tanpa arahan nakes.',
            'Jangan menunda rujukan — malnutrisi akut butuh penanganan cepat dan pemantauan ketat.'
          ]
        },
        {
          title: 'Sambil Menunggu Rujukan',
          tips: [
            'Tetap tawarkan makan sedikit tapi sering, makanan lunak/mudah dicerna.',
            'Lanjutkan ASI bila masih menyusui — jangan dihentikan.'
          ]
        }
      ];
    case 'berisiko':
      return [
        {
          title: 'Tingkatkan Asupan Gizi',
          tips: [
            'Tambahkan porsi protein hewani (telur, ikan, ayam, daging) di setiap kali makan utama.',
            'Beri camilan bergizi 2x sehari di luar 3x makan utama (mis. pisang, telur rebus, bubur kacang hijau).',
            'Pastikan makanan bervariasi setiap hari: karbohidrat, protein, sayur, dan buah.'
          ]
        },
        {
          title: 'Langkah Selanjutnya',
          tips: [
            'Timbang & ukur ulang lebih sering (setiap 2 minggu) untuk melihat perkembangan.',
            'Diskusikan hasil ini dengan kader/nakes posyandu pada kunjungan berikutnya.'
          ]
        }
      ];
    case 'normal':
    default:
      return [
        {
          title: 'Pertahankan Pola Makan Seimbang',
          tips: [
            'Lanjutkan makanan dengan gizi seimbang: karbohidrat, protein hewani & nabati, sayur, dan buah di setiap kali makan.',
            'Pastikan anak tetap mendapat ASI/susu sesuai usia, ditambah camilan sehat di antara waktu makan.'
          ]
        },
        {
          title: 'Stimulasi & Pemantauan',
          tips: [
            'Ajak anak bermain aktif setiap hari untuk mendukung tumbuh kembang optimal.',
            'Tetap pantau berat & tinggi badan secara rutin ke Posyandu setiap bulan — pertumbuhan normal tetap perlu dipantau.'
          ]
        }
      ];
  }
}
