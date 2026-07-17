import type { RiskStatus } from '@/types';

export function riskLabel(status: RiskStatus): string {
  switch (status) {
    case 'malnutrisi':
      return 'Malnutrisi';
    case 'stunting':
      return 'Stunting';
    case 'berisiko':
      return 'Berisiko';
    case 'normal':
      return 'Normal';
  }
}

export function riskDescription(status: RiskStatus): string {
  switch (status) {
    case 'malnutrisi':
      return 'Hasil pengukuran menunjukkan malnutrisi akut yang butuh penanganan cepat. Segera rujuk ke Puskesmas/fasilitas kesehatan.';
    case 'stunting':
      return 'Hasil pengukuran menunjukkan tanda stunting (tinggi kurang sesuai usia). Rujuk ke Puskesmas untuk evaluasi status gizi lebih lanjut.';
    case 'berisiko':
      return 'Hasil pengukuran perlu dipantau. Disarankan pengukuran ulang secara rutin dan konsultasi ke kader/nakes.';
    case 'normal':
      return 'Hasil pengukuran dalam batas normal. Tetap pantau pertumbuhan anak secara rutin.';
  }
}
