import type { RiskStatus } from '@/types';
import { riskLabel } from '@/features/growth/zscore';

const styles: Record<RiskStatus, string> = {
  normal: 'bg-green-100 text-green-700',
  watch: 'bg-amber-100 text-amber-700',
  risk: 'bg-red-100 text-red-700'
};

export function RiskBadge({ status }: { status: RiskStatus }) {
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
      {riskLabel(status)}
    </span>
  );
}
