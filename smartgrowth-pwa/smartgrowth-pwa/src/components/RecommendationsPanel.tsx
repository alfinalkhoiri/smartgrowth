import { ClipboardList, LineChart, StickyNote } from 'lucide-react';
import { RiskBadge } from '@/components/RiskBadge';
import { riskDescription } from '@/features/growth/zscore';
import type { RiskStatus } from '@/types';

interface Props {
  riskStatus?: RiskStatus;
  recommendations?: string[];
  notes?: string;
  measuredAt?: string;
  ageMonths?: number;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  heightForAgeZ?: number;
  weightForHeightZ?: number;
  weightForAgeZ?: number;
  headCircumferenceZ?: number;
}

// Shared between ChildDashboard.tsx and PublicChildView.tsx — always reads
// off the LATEST measurement (not a specific historical one), since this
// tab is meant to answer "what should we do based on where things stand
// now", not "what did we record on date X" (that's what the per-record
// Info popup on ChildDashboard is for). Only fields also present on
// PublicGrowthRecord are accepted (no officerName/location) so this panel
// renders identically for kader/nakes and for the no-login parent view.
export function RecommendationsPanel({
  riskStatus,
  recommendations,
  notes,
  measuredAt,
  ageMonths,
  weightKg,
  heightCm,
  headCircumferenceCm,
  heightForAgeZ,
  weightForHeightZ,
  weightForAgeZ,
  headCircumferenceZ
}: Props) {
  if (!riskStatus) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
        <p className="text-sm text-gray-500">Belum ada data pengukuran untuk ditampilkan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="card p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-gray-500">
            Berdasarkan pengukuran terakhir{measuredAt ? ` · ${measuredAt}` : ''}
          </p>
          <RiskBadge status={riskStatus} />
        </div>
        <p className="text-sm text-gray-700">{riskDescription(riskStatus)}</p>
      </div>

      <div className="card p-4 space-y-2">
        <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
          <LineChart className="h-4 w-4 text-accent" aria-hidden="true" />
          Hasil Pengukuran &amp; Perhitungan Z-score
        </p>
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            Tanggal: {measuredAt ?? '-'} &middot; Usia: {ageMonths ?? '-'} bln
          </p>
          <p>
            Berat: {weightKg ?? '-'} kg &middot; Tinggi: {heightCm ?? '-'} cm
            {headCircumferenceCm != null && <> &middot; Lingkar Kepala: {headCircumferenceCm} cm</>}
          </p>
          <p>Z-score Tinggi/Usia (HAZ): {heightForAgeZ ?? '-'}</p>
          <p>Z-score Berat/Tinggi (WHZ): {weightForHeightZ ?? '-'}</p>
          <p>Z-score Berat/Usia (WAZ): {weightForAgeZ ?? '-'}</p>
          {headCircumferenceZ != null && <p>Z-score Lingkar Kepala/Usia (HCZ): {headCircumferenceZ}</p>}
        </div>
      </div>

      {recommendations && recommendations.length > 0 && (
        <div className="card p-4 space-y-2">
          <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
            <ClipboardList className="h-4 w-4 text-accent" aria-hidden="true" />
            Rekomendasi dari Kuesioner
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            {recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {notes && (
        <div className="card p-4 space-y-2">
          <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
            <StickyNote className="h-4 w-4 text-accent" aria-hidden="true" />
            Catatan Nakes/Kader
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
        </div>
      )}

      {(!recommendations || recommendations.length === 0) && !notes && (
        <p className="text-sm text-gray-400 text-center py-4">Belum ada rekomendasi atau catatan tambahan.</p>
      )}
    </div>
  );
}
