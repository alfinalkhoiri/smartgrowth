import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Loader2 } from 'lucide-react';
import { growthApi } from '@/api/growth';
import { RiskBadge } from '@/components/RiskBadge';
import type { Child, GrowthRecord, RiskStatus } from '@/types';

export default function Riwayat() {
  const [children, setChildren] = useState<Child[]>([]);
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [childFilter, setChildFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<RiskStatus | ''>('');

  useEffect(() => {
    Promise.all([growthApi.listChildren(), growthApi.listAllRecords()])
      .then(([childrenRes, recordsRes]) => {
        setChildren(childrenRes.data);
        setRecords(recordsRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const childNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of children) map[c.id] = c.name;
    return map;
  }, [children]);

  const filtered = records
    .filter((r) => !childFilter || r.childId === childFilter)
    .filter((r) => !statusFilter || r.riskStatus === statusFilter)
    .slice()
    .sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1));

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="flex items-center gap-2 font-display font-extrabold text-2xl text-gray-900">
          <BarChart3 className="h-6 w-6 text-primary" aria-hidden="true" />
          Riwayat Skrining
        </h1>
        <p className="text-sm text-primary font-medium">{records.length} total pemeriksaan</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="riwayat-child-filter" className="field-label">
            Filter Anak
          </label>
          <select
            id="riwayat-child-filter"
            className="field-input"
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
          >
            <option value="">Semua Anak</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="riwayat-status-filter" className="field-label">
            Filter Status
          </label>
          <select
            id="riwayat-status-filter"
            className="field-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RiskStatus | '')}
          >
            <option value="">Semua Status</option>
            <option value="normal">Normal</option>
            <option value="berisiko">Berisiko</option>
            <option value="stunting">Stunting</option>
            <option value="malnutrisi">Malnutrisi</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-10">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat data...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-sm text-gray-500">Belum ada riwayat skrining.</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {filtered.map((record) => (
            <Link
              key={record.id}
              to={`/child/${record.childId}`}
              className="flex items-center justify-between gap-3 p-4 active:opacity-70"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {childNameById[record.childId] ?? 'Anak tidak ditemukan'}
                </p>
                <p className="text-sm text-gray-500">
                  {record.measuredAt} &middot; {record.weightKg} kg &middot; {record.heightCm} cm
                </p>
              </div>
              {record.riskStatus && <RiskBadge status={record.riskStatus} />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
