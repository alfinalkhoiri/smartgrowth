import { AlertTriangle, CheckCircle2, AlertCircle, OctagonAlert } from 'lucide-react';
import type { RiskStatus } from '@/types';
import { riskLabel } from '@/features/growth/zscore';

// Color is never the only signal — each status also gets its own icon, so
// the badge still reads correctly for colorblind users or in grayscale print.
// 4 tingkat: stunting (kronis) dan malnutrisi (akut parah) sengaja dipisah
// warnanya (oranye vs merah) karena urgensi rujukannya beda.
const styles: Record<RiskStatus, string> = {
  normal: 'bg-green-100 text-green-700',
  berisiko: 'bg-amber-100 text-amber-700',
  stunting: 'bg-orange-100 text-orange-700',
  malnutrisi: 'bg-red-100 text-red-700'
};

const icons: Record<RiskStatus, typeof CheckCircle2> = {
  normal: CheckCircle2,
  berisiko: AlertCircle,
  stunting: AlertTriangle,
  malnutrisi: OctagonAlert
};

export function RiskBadge({ status }: { status: RiskStatus }) {
  const Icon = icons[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {riskLabel(status)}
    </span>
  );
}
