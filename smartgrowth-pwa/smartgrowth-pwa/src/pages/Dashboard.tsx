import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  BrainCircuit,
  CalendarClock,
  FilePlus2,
  HeartPulse,
  Loader2,
  Ruler,
  Sparkles,
  TrendingUp,
  Users
} from 'lucide-react';
import { growthApi } from '@/api/growth';
import { scheduleApi } from '@/api/schedule';
import { RiskBadge } from '@/components/RiskBadge';
import type { Child, GrowthRecord, PosyanduSchedule, RiskStatus } from '@/types';

function latestRiskStatus(records: GrowthRecord[]): RiskStatus | undefined {
  return records[records.length - 1]?.riskStatus;
}

export default function Dashboard() {
  const [children, setChildren] = useState<Child[]>([]);
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [schedules, setSchedules] = useState<PosyanduSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([growthApi.listChildren(), growthApi.listAllRecords(), scheduleApi.listSchedules()])
      .then(([childrenRes, recordsRes, schedulesRes]) => {
        setChildren(childrenRes.data);
        setRecords(recordsRes.data);
        setSchedules(schedulesRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const latestByChild = useMemo(() => {
    const grouped: Record<string, GrowthRecord[]> = {};
    for (const record of records) (grouped[record.childId] ??= []).push(record);
    return grouped;
  }, [records]);

  const childNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of children) map[c.id] = c.name;
    return map;
  }, [children]);

  const latestStatuses = children.map((c) => latestRiskStatus(latestByChild[c.id] ?? []));
  const berisikoCount = latestStatuses.filter((s) => s === 'berisiko').length;
  const stuntingMalnutrisiCount = latestStatuses.filter((s) => s === 'stunting' || s === 'malnutrisi').length;

  const recentRecords = records
    .slice()
    .sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1))
    .slice(0, 5);

  const upcomingSchedules = schedules.filter((s) => new Date(s.scheduledAt) >= new Date()).slice(0, 3);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-16">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Memuat data...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="bg-gradient-hero rounded-3xl p-6 sm:p-8 shadow-elegant grid sm:grid-cols-[1.3fr_1fr] gap-6 items-center">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Antropometri Digital Berbasis AI
          </span>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-white">SmartGrowth</h1>
          <p className="text-white/90 text-sm">
            Pengembangan Sistem Tele-Screening Berbasis Artificial Intelligence untuk Deteksi Dini Risiko Stunting
            dan Pemantauan Pertumbuhan Balita.
          </p>
          <p className="text-white/90 text-sm">
            Bantu kader Posyandu, bidan, dan orang tua memantau pertumbuhan balita dengan kalkulator WHO otomatis dan
            AI Screening Engine.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/skrining" className="btn-primary bg-white text-primary hover:bg-white/90">
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              Mulai Skrining
            </Link>
            <Link
              to="/edukasi"
              className="btn-primary bg-white/10 text-white border border-white/40 hover:bg-white/20"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Edukasi Gizi
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Ruler, label: 'Ukur TB/PB' },
            { icon: HeartPulse, label: 'Status Gizi' },
            { icon: BrainCircuit, label: 'AI Screening' },
            { icon: TrendingUp, label: 'Grafik WHO' }
          ].map((f) => (
            <div key={f.label} className="bg-white/15 rounded-xl p-4 text-white space-y-2">
              <f.icon className="h-5 w-5" aria-hidden="true" />
              <p className="text-sm font-medium">{f.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 space-y-2">
          <span className="flex items-center justify-center h-9 w-9 rounded-full bg-blue-50 text-blue-600">
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-xl font-bold text-gray-900">{children.length}</p>
          <p className="text-xs text-gray-500">Balita Terdaftar</p>
        </div>
        <div className="card p-4 space-y-2">
          <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary-light text-primary">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-xl font-bold text-gray-900">{records.length}</p>
          <p className="text-xs text-gray-500">Total Skrining</p>
        </div>
        <div className="card p-4 space-y-2">
          <span className="flex items-center justify-center h-9 w-9 rounded-full bg-amber-50 text-amber-600">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-xl font-bold text-gray-900">{berisikoCount}</p>
          <p className="text-xs text-gray-500">Berisiko</p>
        </div>
        <div className="card p-4 space-y-2">
          <span className="flex items-center justify-center h-9 w-9 rounded-full bg-red-50 text-red-600">
            <HeartPulse className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-xl font-bold text-gray-900">{stuntingMalnutrisiCount}</p>
          <p className="text-xs text-gray-500">Stunting / Malnutrisi</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-[1.4fr_1fr] gap-3">
        <div className="rounded-xl p-5 space-y-3 bg-primary-light/60">
          <h2 className="font-display font-bold text-lg text-gray-900">Apa itu Stunting?</h2>
          <p className="text-sm text-gray-600">
            Stunting masih menjadi salah satu permasalahan kesehatan masyarakat yang penting di Indonesia karena
            berdampak terhadap kualitas sumber daya manusia di masa depan. Menurut World Health Organization (WHO),
            stunting merupakan kondisi gagal tumbuh akibat kekurangan gizi kronis yang ditandai dengan tinggi badan
            menurut umur berada di bawah standar pertumbuhan yang seharusnya.
          </p>
          <ul className="text-sm text-gray-700 grid sm:grid-cols-2 gap-x-4 gap-y-1 list-disc list-inside">
            <li>Prevalensi nasional turun dari 21,5% (2023) ke 19,8% (SSGI 2024)</li>
            <li>Target nasional 14,2% pada tahun 2029</li>
            <li>Masih di atas target, perlu upaya inovatif</li>
            <li>Deteksi dini mencegah dampak permanen</li>
          </ul>
        </div>
        <div className="card p-5 space-y-3">
          <span className="flex items-center justify-center h-9 w-9 rounded-full bg-primary-light text-primary">
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="font-display font-bold text-lg text-gray-900">Mengapa Penting?</h2>
          <p className="text-sm text-gray-600">
            Stunting berdampak pada perkembangan otak, kemampuan belajar, dan produktivitas saat dewasa. Pemantauan
            rutin di Posyandu setiap bulan memungkinkan intervensi cepat.
          </p>
          <Link to="/edukasi" className="btn-secondary w-full">
            Pelajari Lebih
          </Link>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
            <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
            Skrining Terbaru
          </p>
          <Link to="/riwayat" className="text-sm text-primary font-medium hover:underline">
            Lihat semua
          </Link>
        </div>
        {recentRecords.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl py-8 text-center">
            <p className="text-sm text-gray-400">
              Belum ada data skrining.{' '}
              <Link to="/skrining" className="text-primary font-medium hover:underline">
                Mulai sekarang &rarr;
              </Link>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentRecords.map((record) => (
              <Link
                key={record.id}
                to={`/child/${record.childId}`}
                className="flex items-center justify-between gap-2 py-2 active:opacity-70"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900 truncate">
                    {childNameById[record.childId] ?? 'Anak tidak ditemukan'}
                  </span>
                  <span className="block text-xs text-gray-500">{record.measuredAt}</span>
                </span>
                {record.riskStatus && <RiskBadge status={record.riskStatus} />}
              </Link>
            ))}
          </div>
        )}
      </div>

      {upcomingSchedules.length > 0 && (
        <div className="card p-4 space-y-3">
          <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
            <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
            Jadwal Posyandu Terdekat
          </p>
          <div className="divide-y divide-gray-100">
            {upcomingSchedules.map((s) => (
              <div key={s.id} className="py-2">
                <p className="text-sm font-medium text-gray-900">{s.location}</p>
                <p className="text-xs text-gray-500">
                  {new Date(s.scheduledAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            ))}
          </div>
          <Link to="/jadwal" className="text-sm text-primary font-medium hover:underline">
            Lihat semua jadwal &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
