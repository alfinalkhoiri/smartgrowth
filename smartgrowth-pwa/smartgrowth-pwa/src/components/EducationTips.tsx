import { Utensils } from 'lucide-react';
import { nutritionTipsFor } from '@/lib/nutritionTips';
import type { RiskStatus } from '@/types';

// Shared between ChildDashboard.tsx and PublicChildView.tsx — pure
// presentational, only needs the latest risk status.
export function EducationTips({ riskStatus }: { riskStatus?: RiskStatus }) {
  const groups = nutritionTipsFor(riskStatus);

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.title} className="card p-4 space-y-2">
          <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
            <Utensils className="h-4 w-4 text-accent" aria-hidden="true" />
            {group.title}
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            {group.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-gray-400">
        Tips umum, bukan resep medis — untuk kebutuhan gizi khusus, konsultasikan ke nakes/Puskesmas terdekat.
      </p>
    </div>
  );
}
