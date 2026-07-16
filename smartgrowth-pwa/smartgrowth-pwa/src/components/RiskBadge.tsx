import { AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import type { RiskStatus } from '@/types';
import { riskLabel } from '@/features/growth/zscore';

// Color is never the only signal — each status also gets its own icon, so
// the badge still reads correctly for colorblind users or in grayscale print.
const styles: Record<RiskStatus, string> = {
  normal: 'bg-green-100 text-green-700',
  watch: 'bg-amber-100 text-amber-700',
  risk: 'bg-red-100 text-red-700'
};

const icons: Record<RiskStatus, typeof CheckCircle2> = {
  normal: CheckCircle2,
  watch: AlertCircle,
  risk: AlertTriangle
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
