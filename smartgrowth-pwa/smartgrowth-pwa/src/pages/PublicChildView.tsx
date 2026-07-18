import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Loader2, Ruler, Scale, ShieldAlert } from 'lucide-react';
import { publicApi } from '@/api/public';
import { firstErrorMessage } from '@/api/errors';
import { DetailTabs, type DetailTab } from '@/components/DetailTabs';
import { EducationTips } from '@/components/EducationTips';
import { GrowthChart } from '@/components/GrowthChart';
import { RecommendationsPanel } from '@/components/RecommendationsPanel';
import { RiskBadge } from '@/components/RiskBadge';
import type { PublicChildDashboard } from '@/types';

const riskDotStyles: Record<string, string> = {
  normal: 'bg-green-500',
  berisiko: 'bg-amber-500',
  stunting: 'bg-orange-500',
  malnutrisi: 'bg-red-500'
};

function ageFromBirthDate(birthDate: string): string {
  const birth = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${remMonths} bulan`;
  return remMonths === 0 ? `${years} tahun` : `${years} tahun ${remMonths} bulan`;
}

export default function PublicChildView() {
  const { token } = useParams<{ token: string }>();
  const [dashboard, setDashboard] = useState<PublicChildDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('hasil');

  useEffect(() => {
    if (!token) return;
    publicApi
      .getChildDashboard(token)
      .then((res) => setDashboard(res.data))
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          setError('Link tidak valid atau sudah tidak berlaku. Minta link terbaru ke kader/nakes posyandu.');
          return;
        }
        const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
        setError(message ?? 'Gagal memuat data. Periksa koneksi internet Anda.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const records = dashboard?.records ?? [];
  const latest = records[records.length - 1];
  const sortedRecords = records.slice().sort((a, b) => b.ageMonths - a.ageMonths);

  return (
    <div className="min-h-screen bg-primary-light/60 font-sans">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-primary-light shadow-sm">
        <div className="flex items-center gap-1.5 px-4 py-3 max-w-2xl mx-auto">
          <span className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-primary shadow-soft shrink-0">
            <Activity className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block font-display font-semibold text-primary">SmartGrowth</span>
            <span className="block text-[11px] text-gray-400">Dashboard Orang Tua</span>
          </span>
        </div>
      </div>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-16">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Memuat data...
          </div>
        ) : error || !dashboard ? (
          <div className="card p-6 text-center space-y-2">
            <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" aria-hidden="true" />
            <p className="text-sm text-gray-600">{error || 'Data tidak ditemukan.'}</p>
          </div>
        ) : (
          <>
            <div>
              <h1 className="font-display font-extrabold text-2xl text-gray-900">{dashboard.name}</h1>
              <p className="text-sm text-gray-500">{ageFromBirthDate(dashboard.birthDate)}</p>
            </div>

            {dashboard.growthAlert === '2T' && (
              <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Berat badan tidak naik 2x pengukuran berturut-turut (2T) — segera kunjungi Puskesmas terdekat.
              </p>
            )}

            <DetailTabs active={activeTab} onChange={setActiveTab} />

            {activeTab === 'hasil' && (
              <div className="space-y-4">
                {latest ? (
                  <div className="card p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-gray-500">Hasil Terakhir &middot; {latest.measuredAt}</p>
                      {latest.riskStatus && <RiskBadge status={latest.riskStatus} />}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-light text-primary shrink-0">
                          <Scale className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span>
                          <p className="text-xs text-gray-500">Berat</p>
                          <p className="text-lg font-semibold text-gray-900">{latest.weightKg} kg</p>
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-light text-primary shrink-0">
                          <Ruler className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span>
                          <p className="text-xs text-gray-500">Tinggi</p>
                          <p className="text-lg font-semibold text-gray-900">{latest.heightCm} cm</p>
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                    <p className="text-sm text-gray-500">Belum ada data pengukuran untuk balita ini.</p>
                  </div>
                )}

                {records.length > 0 && (
                  <>
                    <GrowthChart records={records} metric="height" />
                    <GrowthChart records={records} metric="weight" />
                  </>
                )}

                {sortedRecords.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-display font-bold text-gray-900">Riwayat Pengukuran</p>
                    <div className="card divide-y divide-gray-100">
                      {sortedRecords.map((record, i) => (
                        <div key={i} className="flex items-center gap-3 p-4">
                          {record.riskStatus && (
                            <span
                              className={`h-2.5 w-2.5 rounded-full shrink-0 ${riskDotStyles[record.riskStatus]}`}
                              aria-hidden="true"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="flex items-center gap-1.5 font-medium text-gray-900">
                              {record.measuredAt}
                              {record.weightTrend === 'naik' && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-xs font-medium text-green-700"
                                  title="Berat naik dari pengukuran sebelumnya"
                                >
                                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                                  Naik
                                </span>
                              )}
                              {record.weightTrend === 'tetap_turun' && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-700"
                                  title="Berat tetap/turun dari pengukuran sebelumnya"
                                >
                                  <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                                  Tetap/Turun
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-gray-500">
                              {record.weightKg} kg &middot; {record.heightCm} cm &middot; {record.ageMonths} bln
                            </p>
                          </div>
                          {record.riskStatus && <RiskBadge status={record.riskStatus} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'rekomendasi' && (
              <RecommendationsPanel
                riskStatus={latest?.riskStatus}
                recommendations={latest?.recommendations}
                notes={latest?.notes}
                measuredAt={latest?.measuredAt}
                ageMonths={latest?.ageMonths}
                weightKg={latest?.weightKg}
                heightCm={latest?.heightCm}
                headCircumferenceCm={latest?.headCircumferenceCm}
                heightForAgeZ={latest?.heightForAgeZ}
                weightForHeightZ={latest?.weightForHeightZ}
                weightForAgeZ={latest?.weightForAgeZ}
                headCircumferenceZ={latest?.headCircumferenceZ}
              />
            )}

            {activeTab === 'edukasi' && <EducationTips riskStatus={latest?.riskStatus} />}
          </>
        )}
      </main>

      <footer className="border-t border-primary-light bg-white mt-10">
        <div className="max-w-2xl mx-auto px-4 py-4 text-xs text-gray-500 flex items-start gap-1.5">
          <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold text-gray-700">Disclaimer:</span> Aplikasi ini adalah alat skrining awal
            berbasis standar WHO dan AI sederhana. Tidak menggantikan diagnosis dokter atau ahli gizi. Selalu
            konsultasikan hasil ke tenaga kesehatan.
          </span>
        </div>
      </footer>
    </div>
  );
}
