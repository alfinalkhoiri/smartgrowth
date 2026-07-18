import { GlassWater, Utensils } from 'lucide-react';
import { foodExamplesFor, nutritionTipsFor } from '@/lib/nutritionTips';
import type { RiskStatus } from '@/types';

// Shared between ChildDashboard.tsx and PublicChildView.tsx — pure
// presentational, only needs the latest risk status.
export function EducationTips({ riskStatus }: { riskStatus?: RiskStatus }) {
  const groups = nutritionTipsFor(riskStatus);
  const examples = foodExamplesFor(riskStatus);

  return (
    <div className="space-y-3">
      <div className="card p-4 space-y-3">
        <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
          <Utensils className="h-4 w-4 text-accent" aria-hidden="true" />
          Contoh Makanan &amp; Minuman
        </p>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
            <Utensils className="h-3 w-3" aria-hidden="true" />
            Makanan
          </p>
          <div className="flex flex-wrap gap-1.5">
            {examples.foods.map((food) => (
              <span key={food} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-light text-primary">
                {food}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
            <GlassWater className="h-3 w-3" aria-hidden="true" />
            Minuman
          </p>
          <div className="flex flex-wrap gap-1.5">
            {examples.drinks.map((drink) => (
              <span key={drink} className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-accent">
                {drink}
              </span>
            ))}
          </div>
        </div>
      </div>

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
