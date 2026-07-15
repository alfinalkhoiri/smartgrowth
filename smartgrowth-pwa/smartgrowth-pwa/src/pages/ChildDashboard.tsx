import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { growthApi } from '@/api/growth';
import { firstErrorMessage } from '@/api/errors';
import { authApi } from '@/api/auth';
import { useGrowthStore } from '@/features/growth/store';
import { GrowthChart } from '@/components/GrowthChart';
import { RiskBadge } from '@/components/RiskBadge';
import { riskDescription } from '@/features/growth/zscore';
import type { Child, GrowthRecord } from '@/types';

function monthsBetween(birthDate: string, measuredAt: string): number {
  const birth = new Date(birthDate);
  const measured = new Date(measuredAt);
  let months = (measured.getFullYear() - birth.getFullYear()) * 12 + (measured.getMonth() - birth.getMonth());
  if (measured.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

const emptyForm = { measuredAt: '', weightKg: '', heightCm: '', officerName: '', location: '' };
const today = new Date().toISOString().slice(0, 10);

export default function ChildDashboard() {
  const { childId } = useParams<{ childId: string }>();
  const records = useGrowthStore((s) => s.records[childId ?? ''] ?? []);
  const setRecords = useGrowthStore((s) => s.setRecords);
  const addRecord = useGrowthStore((s) => s.addRecord);
  const updateRecord = useGrowthStore((s) => s.updateRecord);
  const removeRecord = useGrowthStore((s) => s.removeRecord);

  const [child, setChild] = useState<Child | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resultRecord, setResultRecord] = useState<GrowthRecord | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const canCreate = authApi.canCreate();
  const canEditDelete = authApi.canEditDelete();

  useEffect(() => {
    if (!childId) return;
    growthApi.getChild(childId).then((res) => setChild(res.data));
    // NetworkFirst caching (configured in vite.config.ts) means this still
    // resolves from cache when offline, then syncs when back online.
    growthApi.listRecords(childId).then((res) => setRecords(childId, res.data));
  }, [childId, setRecords]);

  const latest = records[records.length - 1];

  const openResult = (record: GrowthRecord) => {
    setResultRecord(record);
    setNoteDraft(record.notes ?? '');
  };

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (record: GrowthRecord) => {
    setEditingId(record.id);
    setForm({
      measuredAt: record.measuredAt,
      weightKg: String(record.weightKg),
      heightCm: String(record.heightCm),
      officerName: record.officerName ?? '',
      location: record.location ?? ''
    });
    setShowForm(true);
  };

  const handleDelete = async (record: GrowthRecord) => {
    if (!childId) return;
    if (!window.confirm(`Hapus pengukuran tanggal ${record.measuredAt}?`)) return;
    try {
      await growthApi.deleteRecord(record.id);
      removeRecord(childId, record.id);
    } catch (err) {
      const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
      setError(message ?? 'Gagal menghapus pengukuran.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!childId || !child) return;
    setError('');

    if (form.measuredAt > today) {
      setError('Tanggal pengukuran tidak boleh di masa depan.');
      return;
    }
    if (form.measuredAt < child.birthDate) {
      setError('Tanggal pengukuran tidak boleh sebelum tanggal lahir anak.');
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
      ageMonths: monthsBetween(child.birthDate, form.measuredAt),
      officerName: form.officerName,
      location: form.location
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
    } catch (err) {
      const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
      setError(message ?? 'Gagal menyimpan pengukuran. Periksa kembali data yang diisi.');
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
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            aria-label="Kembali ke Daftar Balita"
            className="text-gray-400 hover:text-gray-600 text-xl leading-none -ml-1 p-1"
          >
            &larr;
          </Link>
          <h1 className="text-xl font-semibold">{child?.name ?? 'Grafik Pertumbuhan'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {latest?.riskStatus && <RiskBadge status={latest.riskStatus} />}
          {canCreate && (
            <button
              onClick={() => (showForm ? setShowForm(false) : startAdd())}
              className="bg-teal-700 text-white text-sm font-medium px-3 py-2 rounded-lg"
            >
              {showForm ? 'Batal' : '+ Pengukuran'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (editingId ? canEditDelete : canCreate) && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Tanggal Pengukuran</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2"
              value={form.measuredAt}
              onChange={(e) => setForm({ ...form, measuredAt: e.target.value })}
              min={child?.birthDate}
              max={today}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Berat (kg)</label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded-lg px-3 py-2"
                value={form.weightKg}
                onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Tinggi (cm)</label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded-lg px-3 py-2"
                value={form.heightCm}
                onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nama Petugas</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Mis. Bidan Sari"
                value={form.officerName}
                onChange={(e) => setForm({ ...form, officerName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Lokasi Pengukuran</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Mis. Posyandu Melati"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-teal-700 text-white rounded-lg py-2 font-medium disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan'}
          </button>
        </form>
      )}

      <GrowthChart records={records} />
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Berat Terakhir</p>
          <p className="text-2xl font-semibold">{latest?.weightKg ?? '-'} kg</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm text-gray-500">Tinggi Terakhir</p>
          <p className="text-2xl font-semibold">{latest?.heightCm ?? '-'} cm</p>
        </div>
      </div>

      {sortedRecords.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm divide-y">
          {sortedRecords.map((record) => (
            <div key={record.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{record.measuredAt}</p>
                <p className="text-sm text-gray-500">
                  {record.weightKg} kg &middot; {record.heightCm} cm &middot; {record.ageMonths} bln
                </p>
                {(record.officerName || record.location) && (
                  <p className="text-xs text-gray-400">
                    {[record.officerName, record.location].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => openResult(record)} className="text-sm text-gray-500 font-medium">
                  Info
                </button>
                {canEditDelete && (
                  <>
                    <button onClick={() => startEdit(record)} className="text-sm text-teal-700 font-medium">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(record)} className="text-sm text-red-600 font-medium">
                      Hapus
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {resultRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 print:static print:bg-white print:p-0">
          <div className="print-area bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold">Hasil Pengukuran</h2>
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
            </div>
            {resultRecord.riskStatus && (
              <p className="text-sm text-gray-700">{riskDescription(resultRecord.riskStatus)}</p>
            )}
            {canEditDelete ? (
              <div className="space-y-2">
                <label className="block text-sm text-gray-600">Catatan</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Mis. anak rewel saat diukur, sudah dirujuk ke puskesmas, dll."
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || noteDraft === (resultRecord.notes ?? '')}
                  className="w-full bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium disabled:opacity-50"
                >
                  {savingNote ? 'Menyimpan catatan...' : 'Simpan Catatan'}
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
                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium"
                >
                  Cetak
                </button>
              )}
              <button
                onClick={() => setResultRecord(null)}
                className="flex-1 bg-teal-700 text-white rounded-lg py-2 font-medium"
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
