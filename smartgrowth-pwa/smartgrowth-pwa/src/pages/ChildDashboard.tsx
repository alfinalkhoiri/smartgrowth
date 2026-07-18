import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Droplets,
  Info,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Ruler,
  Scale,
  Syringe,
  Thermometer,
  Trash2,
  X
} from 'lucide-react';
import { growthApi } from '@/api/growth';
import { firstErrorMessage, parseFieldErrors } from '@/api/errors';
import { authApi } from '@/api/auth';
import { useGrowthStore } from '@/features/growth/store';
import { FieldError } from '@/components/FieldError';
import { GrowthChart } from '@/components/GrowthChart';
import { ParentDashboardQr } from '@/components/ParentDashboardQr';
import { RiskBadge } from '@/components/RiskBadge';
import { riskDescription } from '@/features/growth/zscore';
import { monthsBetween } from '@/lib/dates';
import type { Child, GrowthRecord, GrowthReference } from '@/types';

type TriState = '' | 'yes' | 'no';

function toTriState(value: boolean | null | undefined): TriState {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return '';
}

function fromTriState(value: TriState): boolean | null {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null;
}

const riskDotStyles: Record<string, string> = {
  normal: 'bg-green-500',
  berisiko: 'bg-amber-500',
  stunting: 'bg-orange-500',
  malnutrisi: 'bg-red-500'
};

const emptyForm = {
  measuredAt: '',
  weightKg: '',
  heightCm: '',
  headCircumferenceCm: '',
  officerName: '',
  location: '',
  cleanWaterAccess: '' as TriState,
  recurrentIllness: '' as TriState,
  immunizationComplete: '' as TriState
};
const today = new Date().toISOString().slice(0, 10);

export default function ChildDashboard() {
  const { childId } = useParams<{ childId: string }>();
  const records = useGrowthStore((s) => s.records[childId ?? ''] ?? []);
  const setRecords = useGrowthStore((s) => s.setRecords);
  const addRecord = useGrowthStore((s) => s.addRecord);
  const updateRecord = useGrowthStore((s) => s.updateRecord);
  const removeRecord = useGrowthStore((s) => s.removeRecord);

  const [child, setChild] = useState<Child | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resultRecord, setResultRecord] = useState<GrowthRecord | null>(null);
  const [reference, setReference] = useState<GrowthReference | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const canCreate = authApi.canCreate();
  const canEditDelete = authApi.canEditDelete();
  const inputClass = (field: string) => `field-input${fieldErrors[field] ? ' field-input-error' : ''}`;

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

  // Debounced so retyping the height doesn't fire a request per keystroke;
  // only shown while the form is open since it's just an input-time guide.
  useEffect(() => {
    if (!showForm || !child || !form.measuredAt) {
      setReference(null);
      return;
    }
    const ageMonths = monthsBetween(child.birthDate, form.measuredAt);
    const heightCm = Number(form.heightCm);
    const timer = setTimeout(() => {
      growthApi
        .getReference(child.sex, ageMonths, heightCm > 0 ? heightCm : undefined)
        .then((res) => setReference(res.data))
        .catch(() => setReference(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [showForm, child, form.measuredAt, form.heightCm]);

  const openResult = (record: GrowthRecord) => {
    setError('');
    setResultRecord(record);
    setNoteDraft(record.notes ?? '');
  };

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
    setShowForm(true);
  };

  const startEdit = (record: GrowthRecord) => {
    setEditingId(record.id);
    setFieldErrors({});
    setForm({
      measuredAt: record.measuredAt,
      weightKg: String(record.weightKg),
      heightCm: String(record.heightCm),
      headCircumferenceCm: record.headCircumferenceCm != null ? String(record.headCircumferenceCm) : '',
      officerName: record.officerName ?? '',
      location: record.location ?? '',
      cleanWaterAccess: toTriState(record.cleanWaterAccess),
      recurrentIllness: toTriState(record.recurrentIllness),
      immunizationComplete: toTriState(record.immunizationComplete)
    });
    setShowForm(true);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!childId || !child) return;
    setError('');
    setFieldErrors({});

    if (form.measuredAt > today) {
      setFieldErrors({ measuredAt: 'Tanggal pengukuran tidak boleh di masa depan.' });
      setError('Periksa kembali data yang ditandai merah di bawah.');
      return;
    }
    if (form.measuredAt < child.birthDate) {
      setFieldErrors({ measuredAt: 'Tanggal pengukuran tidak boleh sebelum tanggal lahir anak.' });
      setError('Periksa kembali data yang ditandai merah di bawah.');
      return;
    }

    setSaving(true);
    // notes is deliberately left out here — it's only editable from the
    // result popup (after the measurement itself is saved), and omitting it
    // on an update leaves the existing note untouched rather than wiping it.
    const payload = {
      childId,
      measuredAt: form.measuredAt,
      weightKg: Number(form.weightKg),
      heightCm: Number(form.heightCm),
      headCircumferenceCm: form.headCircumferenceCm ? Number(form.headCircumferenceCm) : undefined,
      ageMonths: monthsBetween(child.birthDate, form.measuredAt),
      officerName: form.officerName,
      location: form.location,
      cleanWaterAccess: fromTriState(form.cleanWaterAccess),
      recurrentIllness: fromTriState(form.recurrentIllness),
      immunizationComplete: fromTriState(form.immunizationComplete)
    };
    try {
      let saved: GrowthRecord;
      if (editingId) {
        const res = await growthApi.updateRecord(editingId, payload);
        updateRecord(res.data);
        saved = res.data;
      } else {
        const res = await growthApi.createRecord(payload);
        addRecord(res.data);
        saved = res.data;
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      openResult(saved);
      // growth_alert ('2T') is computed from the child's full history, so a
      // newly added/edited measurement can change it — refetch rather than
      // let the header banner show a stale status.
      growthApi.getChild(childId).then((res) => setChild(res.data));
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const fields = parseFieldErrors(err.response.data);
        setFieldErrors(fields);
        setError(
          Object.keys(fields).length > 0
            ? 'Periksa kembali data yang ditandai merah di bawah.'
            : firstErrorMessage(err.response.data) ?? 'Gagal menyimpan pengukuran. Periksa kembali data yang diisi.'
        );
      } else {
        setError('Gagal menyimpan pengukuran. Periksa kembali data yang diisi.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNote = async () => {
    if (!resultRecord || !childId) return;
    setSavingNote(true);
    try {
      const payload = {
        childId,
        measuredAt: resultRecord.measuredAt,
        weightKg: Number(resultRecord.weightKg),
        heightCm: Number(resultRecord.heightCm),
        ageMonths: resultRecord.ageMonths,
        notes: noteDraft
      };
      const res = await growthApi.updateRecord(resultRecord.id, payload);
      updateRecord(res.data);
      setResultRecord(res.data);
    } catch (err) {
      const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
      setError(message ?? 'Gagal menyimpan catatan.');
    } finally {
      setSavingNote(false);
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
            <button onClick={() => (showForm ? setShowForm(false) : startAdd())} className="btn-primary">
              {showForm ? (
                <>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Batal
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Pengukuran
                </>
              )}
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

      {showForm && (editingId ? canEditDelete : canCreate) && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3">
          <div>
            <label htmlFor="measured-at" className="field-label">
              Tanggal Pengukuran
            </label>
            <input
              id="measured-at"
              type="date"
              className={inputClass('measuredAt')}
              value={form.measuredAt}
              onChange={(e) => setForm({ ...form, measuredAt: e.target.value })}
              min={child?.birthDate}
              max={today}
              required
            />
            <FieldError message={fieldErrors.measuredAt} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="weight-kg" className="field-label">
                Berat (kg)
              </label>
              <input
                id="weight-kg"
                type="number"
                step="0.01"
                className={inputClass('weightKg')}
                value={form.weightKg}
                onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                required
              />
              <FieldError message={fieldErrors.weightKg} />
              {reference?.weightMinKg != null && (
                <p className="text-xs text-gray-400 mt-1">
                  Normal: {reference.weightMinKg}&ndash;{reference.weightMaxKg} kg
                </p>
              )}
            </div>
            <div>
              <label htmlFor="height-cm" className="field-label">
                Tinggi (cm)
              </label>
              <input
                id="height-cm"
                type="number"
                step="0.01"
                className={inputClass('heightCm')}
                value={form.heightCm}
                onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
                required
              />
              <FieldError message={fieldErrors.heightCm} />
              {reference && (
                <p className="text-xs text-gray-400 mt-1">
                  Normal: {reference.heightMinCm}&ndash;{reference.heightMaxCm} cm
                </p>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="head-circumference-cm" className="field-label">
              Lingkar Kepala (cm, opsional)
            </label>
            <input
              id="head-circumference-cm"
              type="number"
              step="0.1"
              className={inputClass('headCircumferenceCm')}
              placeholder="Mis. 42.5"
              value={form.headCircumferenceCm}
              onChange={(e) => setForm({ ...form, headCircumferenceCm: e.target.value })}
            />
            <FieldError message={fieldErrors.headCircumferenceCm} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="officer-name" className="field-label">
                Nama Petugas
              </label>
              <input
                id="officer-name"
                className="field-input"
                placeholder="Mis. Bidan Sari"
                value={form.officerName}
                onChange={(e) => setForm({ ...form, officerName: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="measure-location" className="field-label">
                Lokasi Pengukuran
              </label>
              <input
                id="measure-location"
                className="field-input"
                placeholder="Mis. Posyandu Melati"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-gray-100 pt-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Syringe className="h-4 w-4 text-primary" aria-hidden="true" />
              Kuesioner Faktor Risiko
            </p>
            <div>
              <label htmlFor="clean-water" className="field-label flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                Akses air bersih &amp; sanitasi layak
              </label>
              <select
                id="clean-water"
                className="field-input text-sm"
                value={form.cleanWaterAccess}
                onChange={(e) => setForm({ ...form, cleanWaterAccess: e.target.value as TriState })}
              >
                <option value="">Belum diisi</option>
                <option value="yes">Ya</option>
                <option value="no">Tidak</option>
              </select>
            </div>
            <div>
              <label htmlFor="recurrent-illness" className="field-label flex items-center gap-1.5">
                <Thermometer className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                Riwayat sakit/diare berulang (3 bulan terakhir)
              </label>
              <select
                id="recurrent-illness"
                className="field-input text-sm"
                value={form.recurrentIllness}
                onChange={(e) => setForm({ ...form, recurrentIllness: e.target.value as TriState })}
              >
                <option value="">Belum diisi</option>
                <option value="yes">Ya</option>
                <option value="no">Tidak</option>
              </select>
            </div>
            <div>
              <label htmlFor="immunization" className="field-label flex items-center gap-1.5">
                <Syringe className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                Imunisasi lengkap sesuai usia
              </label>
              <select
                id="immunization"
                className="field-input text-sm"
                value={form.immunizationComplete}
                onChange={(e) => setForm({ ...form, immunizationComplete: e.target.value as TriState })}
              >
                <option value="">Belum diisi</option>
                <option value="yes">Ya</option>
                <option value="no">Tidak</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Menyimpan...
              </>
            ) : editingId ? (
              'Simpan Perubahan'
            ) : (
              'Simpan'
            )}
          </button>
        </form>
      )}

      {loadingData ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-10">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat data...
        </div>
      ) : (
        <>
          <GrowthChart records={records} />
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
                          onClick={() => startEdit(record)}
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

            {canEditDelete ? (
              <div className="space-y-2">
                <label htmlFor="note-draft" className="field-label">
                  Catatan
                </label>
                <textarea
                  id="note-draft"
                  className="field-input text-sm"
                  rows={2}
                  placeholder="Mis. anak rewel saat diukur, sudah dirujuk ke puskesmas, dll."
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || noteDraft === (resultRecord.notes ?? '')}
                  className="btn-secondary w-full"
                >
                  {savingNote ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Menyimpan catatan...
                    </>
                  ) : (
                    'Simpan Catatan'
                  )}
                </button>
              </div>
            ) : (
              resultRecord.notes && (
                <div className="text-sm bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 mb-1">Catatan:</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{resultRecord.notes}</p>
                </div>
              )
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
