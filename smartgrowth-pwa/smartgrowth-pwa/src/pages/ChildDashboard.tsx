import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Info,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Ruler,
  Scale,
  Trash2
} from 'lucide-react';
import { growthApi } from '@/api/growth';
import { firstErrorMessage } from '@/api/errors';
import { authApi } from '@/api/auth';
import { useGrowthStore } from '@/features/growth/store';
import { DetailTabs, type DetailTab } from '@/components/DetailTabs';
import { EducationTips } from '@/components/EducationTips';
import { GrowthChart } from '@/components/GrowthChart';
import { ParentDashboardQr } from '@/components/ParentDashboardQr';
import { RecommendationsPanel } from '@/components/RecommendationsPanel';
import { RiskBadge } from '@/components/RiskBadge';
import { riskDescription } from '@/features/growth/zscore';
import type { Child, GrowthRecord } from '@/types';

const riskDotStyles: Record<string, string> = {
  normal: 'bg-green-500',
  berisiko: 'bg-amber-500',
  stunting: 'bg-orange-500',
  malnutrisi: 'bg-red-500'
};

export default function ChildDashboard() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const records = useGrowthStore((s) => s.records[childId ?? ''] ?? []);
  const setRecords = useGrowthStore((s) => s.setRecords);
  const removeRecord = useGrowthStore((s) => s.removeRecord);

  const [child, setChild] = useState<Child | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [resultRecord, setResultRecord] = useState<GrowthRecord | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('hasil');
  const canCreate = authApi.canCreate();
  const canEditDelete = authApi.canEditDelete();

  // jspdf/jspdf-autotable are only loaded on demand (not in the main bundle)
  // — most sessions never touch this button, and the PWA precache/initial
  // load shouldn't carry that weight for everyone just in case they do.
  const handleDownloadReport = async () => {
    if (!child) return;
    setGeneratingReport(true);
    try {
      const { generateChildReport } = await import('@/lib/pdf');
      generateChildReport(child, records);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!child) return;
    if (!window.confirm('Yakin ingin membuat QR baru? Link/QR lama yang sudah dibagikan langsung tidak berlaku.')) {
      return;
    }
    const res = await growthApi.regeneratePublicToken(child.id);
    setChild(res.data);
  };

  useEffect(() => {
    if (!childId) return;
    Promise.all([
      growthApi.getChild(childId).then((res) => setChild(res.data)),
      // NetworkFirst caching (configured in vite.config.ts) means this still
      // resolves from cache when offline, then syncs when back online.
      growthApi.listRecords(childId).then((res) => setRecords(childId, res.data))
    ]).finally(() => setLoadingData(false));
  }, [childId, setRecords]);

  const latest = records[records.length - 1];

  const openResult = (record: GrowthRecord) => {
    setError('');
    setResultRecord(record);
  };

  const handleDelete = async (record: GrowthRecord) => {
    if (!childId) return;
    if (!window.confirm(`Hapus pengukuran tanggal ${record.measuredAt}?`)) return;
    try {
      await growthApi.deleteRecord(record.id);
      removeRecord(childId, record.id);
      growthApi.getChild(childId).then((res) => setChild(res.data));
    } catch (err) {
      const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
      setError(message ?? 'Gagal menghapus pengukuran.');
    }
  };

  const sortedRecords = records.slice().sort((a, b) => b.ageMonths - a.ageMonths);

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display font-extrabold text-2xl text-gray-900 truncate">{child?.name ?? 'Grafik Pertumbuhan'}</h1>
        <div className="flex items-center gap-2 shrink-0">
          {latest?.riskStatus && <RiskBadge status={latest.riskStatus} />}
          {canCreate && (
            <button onClick={() => navigate(`/skrining?child=${childId}`)} className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Pengukuran
            </button>
          )}
        </div>
      </div>

      {records.length > 0 && child && (
        <button onClick={handleDownloadReport} disabled={generatingReport} className="btn-ghost">
          {generatingReport ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
          Unduh Laporan PDF
        </button>
      )}

      {child?.publicToken && (
        <ParentDashboardQr
          token={child.publicToken}
          childName={child.name}
          onRegenerate={canEditDelete ? handleRegenerateToken : undefined}
        />
      )}

      {child?.growthAlert === '2T' && (
        <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Berat badan tidak naik 2x pengukuran berturut-turut (2T) — rujuk ke Puskesmas.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {loadingData ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-10">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat data...
        </div>
      ) : (
        <>
          <DetailTabs active={activeTab} onChange={setActiveTab} />

          {activeTab === 'hasil' && (
            <div className="space-y-4">
              <GrowthChart records={records} metric="height" />
              <GrowthChart records={records} metric="weight" />
              <div className="grid grid-cols-2 gap-3">
                <div className="card p-4 flex items-center gap-3">
                  <span className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-light text-primary shrink-0">
                    <Scale className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <p className="text-sm text-gray-500">Berat Terakhir</p>
                    <p className="text-xl font-semibold text-gray-900">{latest?.weightKg ?? '-'} kg</p>
                  </span>
                </div>
                <div className="card p-4 flex items-center gap-3">
                  <span className="flex items-center justify-center h-10 w-10 rounded-full bg-primary-light text-primary shrink-0">
                    <Ruler className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <p className="text-sm text-gray-500">Tinggi Terakhir</p>
                    <p className="text-xl font-semibold text-gray-900">{latest?.heightCm ?? '-'} cm</p>
                  </span>
                </div>
              </div>

              {sortedRecords.length > 0 && (
                <div className="card divide-y divide-gray-100">
                  {sortedRecords.map((record) => (
                    <div key={record.id} className="flex items-center gap-3 p-4">
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
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-700" title="Berat naik dari pengukuran sebelumnya">
                              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                              Naik
                            </span>
                          )}
                          {record.weightTrend === 'tetap_turun' && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-700" title="Berat tetap/turun dari pengukuran sebelumnya">
                              <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                              Tetap/Turun
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {record.weightKg} kg &middot; {record.heightCm} cm &middot; {record.ageMonths} bln
                        </p>
                        {(record.officerName || record.location) && (
                          <p className="text-xs text-gray-400 truncate">
                            {[record.officerName, record.location].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openResult(record)}
                          aria-label={`Info pengukuran ${record.measuredAt}`}
                          className="flex items-center justify-center h-11 w-11 rounded-lg text-gray-500 hover:bg-primary-light hover:text-primary"
                        >
                          <Info className="h-5 w-5" aria-hidden="true" />
                        </button>
                        {canEditDelete && (
                          <>
                            <button
                              onClick={() => navigate(`/skrining?editRecord=${record.id}&child=${childId}`)}
                              aria-label={`Edit pengukuran ${record.measuredAt}`}
                              className="flex items-center justify-center h-11 w-11 rounded-lg text-primary hover:bg-primary-light"
                            >
                              <Pencil className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => handleDelete(record)}
                              aria-label={`Hapus pengukuran ${record.measuredAt}`}
                              className="flex items-center justify-center h-11 w-11 rounded-lg text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-5 w-5" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
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
              officerName={latest?.officerName}
              location={latest?.location}
            />
          )}

          {activeTab === 'edukasi' && <EducationTips riskStatus={latest?.riskStatus} />}
        </>
      )}

      {resultRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 print:static print:bg-white print:p-0">
          <div className="print-area bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Hasil Pengukuran</h2>
            {typeof resultRecord.photo === 'string' && (
              <img
                src={resultRecord.photo}
                alt={`Foto dokumentasi pengukuran ${resultRecord.measuredAt}`}
                className="w-full h-40 object-cover rounded-lg"
              />
            )}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
                {error}
              </p>
            )}
            {resultRecord.riskStatus && <RiskBadge status={resultRecord.riskStatus} />}
            <div className="text-sm text-gray-600 space-y-1">
              <p>Tanggal: {resultRecord.measuredAt} &middot; Usia: {resultRecord.ageMonths} bln</p>
              <p>Berat: {resultRecord.weightKg} kg &middot; Tinggi: {resultRecord.heightCm} cm</p>
              {(resultRecord.officerName || resultRecord.location) && (
                <p>
                  {resultRecord.officerName && <>Petugas: {resultRecord.officerName}</>}
                  {resultRecord.officerName && resultRecord.location && ' · '}
                  {resultRecord.location && <>Lokasi: {resultRecord.location}</>}
                </p>
              )}
              <p>Z-score Tinggi/Usia (HAZ): {resultRecord.heightForAgeZ ?? '-'}</p>
              <p>Z-score Berat/Tinggi (WHZ): {resultRecord.weightForHeightZ ?? '-'}</p>
              <p>Z-score Berat/Usia (WAZ): {resultRecord.weightForAgeZ ?? '-'}</p>
              {resultRecord.headCircumferenceZ != null && (
                <p>Z-score Lingkar Kepala/Usia (HCZ): {resultRecord.headCircumferenceZ}</p>
              )}
            </div>
            {resultRecord.riskStatus && (
              <p className="text-sm text-gray-700">{riskDescription(resultRecord.riskStatus)}</p>
            )}

            {canEditDelete && resultRecord.recommendations && resultRecord.recommendations.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-amber-800">
                  Rekomendasi (sampaikan ke orang tua/pasien)
                </p>
                <ul className="text-sm text-amber-700 list-disc list-inside space-y-0.5">
                  {resultRecord.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {resultRecord.notes && (
              <div className="text-sm bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 mb-1">Catatan:</p>
                <p className="text-gray-700 whitespace-pre-wrap">{resultRecord.notes}</p>
              </div>
            )}
            <div className="flex gap-2 print:hidden">
              {resultRecord.notes && (
                <button onClick={() => window.print()} className="btn-secondary flex-1">
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Cetak
                </button>
              )}
              <button
                onClick={() => {
                  setResultRecord(null);
                  setError('');
                }}
                className="btn-primary flex-1"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
