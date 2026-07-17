import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Baby, CalendarClock, Loader2, Users } from 'lucide-react';
import { growthApi } from '@/api/growth';
import { scheduleApi } from '@/api/schedule';
import { RiskBadge } from '@/components/RiskBadge';
import type { Child, GrowthRecord, PosyanduSchedule, RiskStatus } from '@/types';

function latestRiskStatus(records: GrowthRecord[]): RiskStatus | undefined {
  return records[records.length - 1]?.riskStatus;
}

export default function Dashboard() {
  const [children, setChildren] = useState<Child[]>([]);
  const [latestByChild, setLatestByChild] = useState<Record<string, GrowthRecord[]>>({});
  const [schedules, setSchedules] = useState<PosyanduSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([growthApi.listChildren(), growthApi.listAllRecords(), scheduleApi.listSchedules()])
      .then(([childrenRes, recordsRes, schedulesRes]) => {
        setChildren(childrenRes.data);
        const grouped: Record<string, GrowthRecord[]> = {};
        for (const record of recordsRes.data) {
          (grouped[record.childId] ??= []).push(record);
        }
        setLatestByChild(grouped);
        setSchedules(schedulesRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const attentionChildren = children.filter((c) => {
    const status = latestRiskStatus(latestByChild[c.id] ?? []);
    return status && status !== 'normal';
  });
  const alertCount = children.filter((c) => c.growthAlert === '2T').length;
  const upcomingSchedules = schedules
    .filter((s) => new Date(s.scheduledAt) >= new Date())
    .slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-16">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Memuat data...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-display font-semibold text-gray-900">Beranda</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <span className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-light text-primary shrink-0">
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <p className="text-sm text-gray-500">Total Balita</p>
            <p className="text-xl font-semibold text-gray-900">{children.length}</p>
          </span>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <span className="flex items-center justify-center h-10 w-10 rounded-full bg-red-50 text-red-600 shrink-0">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <p className="text-sm text-gray-500">Alert 2T Aktif</p>
            <p className="text-xl font-semibold text-gray-900">{alertCount}</p>
          </span>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Baby className="h-4 w-4 text-primary" aria-hidden="true" />
          Balita Perlu Perhatian
        </p>
        {attentionChildren.length === 0 ? (
          <p className="text-sm text-gray-400">Tidak ada balita dengan status berisiko saat ini.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {attentionChildren.map((child) => {
              const status = latestRiskStatus(latestByChild[child.id] ?? []);
              return (
                <Link
                  key={child.id}
                  to={`/child/${child.id}`}
                  className="flex items-center justify-between gap-2 py-2 active:opacity-70"
                >
                  <span className="text-sm font-medium text-gray-900">{child.name}</span>
                  {status && <RiskBadge status={status} />}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
          Jadwal Posyandu Terdekat
        </p>
        {upcomingSchedules.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada jadwal mendatang.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {upcomingSchedules.map((s) => (
              <div key={s.id} className="py-2">
                <p className="text-sm font-medium text-gray-900">{s.location}</p>
                <p className="text-xs text-gray-500">
                  {new Date(s.scheduledAt).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
        <Link to="/jadwal" className="text-sm text-primary font-medium hover:underline">
          Lihat semua jadwal &rarr;
        </Link>
      </div>
    </div>
  );
}
