import type { RiskStatus } from '@/types';

/**
 * Stage 1 risk classification: rule-based, using WHO Height-for-Age Z-score (HAZ)
 * thresholds. This is the clinically-grounded baseline that should ship first;
 * the ML/predictive layer (Stage 2) sits on top of this, not instead of it.
 *
 * NOTE: This is a placeholder threshold mapper. Actual HAZ calculation needs
 * the WHO Child Growth Standards LMS reference tables (by age in months + sex),
 * which should be loaded from a lookup table/service, not hardcoded here.
 */
export function classifyRiskFromHAZ(haz: number): RiskStatus {
  if (haz < -3) return 'risk';       // Severely stunted
  if (haz < -2) return 'watch';      // Stunted — needs monitoring
  return 'normal';
}

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
