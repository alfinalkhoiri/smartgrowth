import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { GrowthRecord } from '@/types';

interface Props {
  records: GrowthRecord[];
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm px-3 py-2 text-sm">
      <p className="text-gray-500">Tinggi</p>
      <p className="font-medium text-primary">{payload[0].value} cm</p>
    </div>
  );
}

export function GrowthChart({ records }: Props) {
  const data = records
    .slice()
    .sort((a, b) => a.ageMonths - b.ageMonths)
    .map((r) => ({ ageMonths: r.ageMonths, heightCm: r.heightCm, weightKg: r.weightKg }));

  return (
    <div className="card p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
        <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
        Grafik Tinggi Badan
      </p>
      <div className="w-full h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="ageMonths"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{ value: 'Usia (bulan)', position: 'insideBottom', offset: -5, fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} width={40} />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="heightCm"
              stroke="#0891b2"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#0891b2', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              name="Tinggi (cm)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
