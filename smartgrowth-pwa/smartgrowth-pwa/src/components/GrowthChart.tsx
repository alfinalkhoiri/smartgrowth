import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Scale, TrendingUp } from 'lucide-react';

// Deliberately narrow (not the full GrowthRecord/PublicGrowthRecord shape)
// so this also works for the public no-login dashboard's slimmer payload —
// any record-like shape with these three fields satisfies it structurally.
interface Props {
  records: { ageMonths: number; heightCm: number; weightKg: number }[];
  metric?: 'height' | 'weight';
}

const metricConfig = {
  height: {
    dataKey: 'heightCm' as const,
    title: 'Grafik Tinggi Badan',
    metricLabel: 'Tinggi',
    unit: 'cm',
    color: '#119ad4',
    icon: TrendingUp
  },
  weight: {
    dataKey: 'weightKg' as const,
    title: 'Grafik Berat Badan',
    metricLabel: 'Berat',
    unit: 'kg',
    color: '#259d65',
    icon: Scale
  }
};

// "label" is reserved by recharts (it injects the x-axis value under that
// name when cloning this into the Tooltip) — metricLabel avoids the clash.
function ChartTooltip({
  active,
  payload,
  metricLabel,
  unit
}: {
  active?: boolean;
  payload?: { value: number }[];
  metricLabel: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-lg shadow-sm px-3 py-2 text-sm">
      <p className="text-gray-500">{metricLabel}</p>
      <p className="font-medium text-primary">
        {payload[0].value} {unit}
      </p>
    </div>
  );
}

export function GrowthChart({ records, metric = 'height' }: Props) {
  const config = metricConfig[metric];
  const data = records
    .slice()
    .sort((a, b) => a.ageMonths - b.ageMonths)
    .map((r) => ({ ageMonths: r.ageMonths, heightCm: r.heightCm, weightKg: r.weightKg }));

  return (
    <div className="card p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
        <config.icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {config.title}
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
            <Tooltip content={<ChartTooltip metricLabel={config.metricLabel} unit={config.unit} />} />
            <Line
              type="monotone"
              dataKey={config.dataKey}
              stroke={config.color}
              strokeWidth={2.5}
              dot={{ r: 4, fill: config.color, strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              name={`${config.metricLabel} (${config.unit})`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
