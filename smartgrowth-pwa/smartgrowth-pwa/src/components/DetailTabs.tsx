import { BookOpen, ClipboardList, Ruler } from 'lucide-react';

export type DetailTab = 'hasil' | 'rekomendasi' | 'edukasi';

const tabs: { key: DetailTab; label: string; icon: typeof Ruler }[] = [
  { key: 'hasil', label: 'Hasil Pengukuran', icon: Ruler },
  { key: 'rekomendasi', label: 'Rekomendasi', icon: ClipboardList },
  { key: 'edukasi', label: 'Edukasi', icon: BookOpen }
];

interface Props {
  active: DetailTab;
  onChange: (tab: DetailTab) => void;
}

// Shared between ChildDashboard.tsx (kader/nakes) and PublicChildView.tsx
// (no-login parent dashboard) — same 3 tabs, same order, on both pages.
export function DetailTabs({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 border-b border-gray-200 overflow-x-auto" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
            active === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <t.icon className="h-4 w-4" aria-hidden="true" />
          {t.label}
        </button>
      ))}
    </div>
  );
}
