import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Loader2, MapPin } from 'lucide-react';
import { growthApi } from '@/api/growth';
import { RiskBadge } from '@/components/RiskBadge';
import type { Child, GrowthRecord, RiskStatus } from '@/types';

export default function Riwayat() {
  const [children, setChildren] = useState<Child[]>([]);
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [childFilter, setChildFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<RiskStatus | ''>('');
  const [locationFilter, setLocationFilter] = useState('');

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

  const childLocationById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of children) if (c.posyanduLocation) map[c.id] = c.posyanduLocation;
    return map;
  }, [children]);

  const locationOptions = useMemo(
    () =>
      Array.from(new Set(children.map((c) => c.posyanduLocation).filter((v): v is string => !!v?.trim()))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [children]
  );

  const filtered = records
    .filter((r) => !childFilter || r.childId === childFilter)
    .filter((r) => !statusFilter || r.riskStatus === statusFilter)
    .filter((r) => !locationFilter || childLocationById[r.childId] === locationFilter)
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

      {locationOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-gray-400 shrink-0" aria-hidden="true" />
          <select
            aria-label="Filter lokasi posyandu/klinik"
            className="field-input"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="">Semua Lokasi</option>
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-10">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat data...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          {records.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada riwayat skrining.</p>
          ) : (
            <>
              <p className="text-sm text-gray-500">Tidak ada riwayat yang cocok dengan filter.</p>
              <button
                onClick={() => {
                  setChildFilter('');
                  setStatusFilter('');
                  setLocationFilter('');
                }}
                className="btn-secondary"
              >
                Reset Filter
              </button>
            </>
          )}
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
