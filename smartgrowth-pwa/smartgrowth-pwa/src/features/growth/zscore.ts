import type { RiskStatus } from '@/types';

export function riskLabel(status: RiskStatus): string {
  switch (status) {
    case 'risk':
      return 'Berisiko Stunting';
    case 'watch':
      return 'Perlu Pemantauan';
    case 'normal':
      return 'Normal';
  }
}

export function riskDescription(status: RiskStatus): string {
  switch (status) {
    case 'risk':
      return 'Hasil pengukuran menunjukkan risiko tinggi (stunting dan/atau wasting). Segera rujuk ke tenaga kesehatan (nakes) untuk pemeriksaan lebih lanjut.';
    case 'watch':
      return 'Hasil pengukuran perlu dipantau. Disarankan pengukuran ulang secara rutin dan konsultasi ke kader/nakes.';
    case 'normal':
      return 'Hasil pengukuran dalam batas normal. Tetap pantau pertumbuhan anak secara rutin.';
  }
}
