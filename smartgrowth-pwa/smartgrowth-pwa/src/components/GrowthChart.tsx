import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { GrowthRecord } from '@/types';

interface Props {
  records: GrowthRecord[];
}

export function GrowthChart({ records }: Props) {
  const data = records
    .slice()
    .sort((a, b) => a.ageMonths - b.ageMonths)
    .map((r) => ({ ageMonths: r.ageMonths, heightCm: r.heightCm, weightKg: r.weightKg }));

  return (
    <div className="w-full h-64 bg-white rounded-2xl shadow-sm p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="ageMonths" label={{ value: 'Usia (bulan)', position: 'insideBottom', offset: -5 }} />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="heightCm" stroke="#0f766e" strokeWidth={2} name="Tinggi (cm)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
