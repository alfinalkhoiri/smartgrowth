import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { growthApi } from '@/api/growth';
import { useGrowthStore } from '@/features/growth/store';
import { GrowthChart } from '@/components/GrowthChart';
import { RiskBadge } from '@/components/RiskBadge';
import type { Child, GrowthRecord } from '@/types';

function monthsBetween(birthDate: string, measuredAt: string): number {
  const birth = new Date(birthDate);
  const measured = new Date(measuredAt);
  let months = (measured.getFullYear() - birth.getFullYear()) * 12 + (measured.getMonth() - birth.getMonth());
  if (measured.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

const emptyForm = { measuredAt: '', weightKg: '', heightCm: '' };

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

  useEffect(() => {
    if (!childId) return;
    growthApi.getChild(childId).then((res) => setChild(res.data));
    // NetworkFirst caching (configured in vite.config.ts) means this still
    // resolves from cache when offline, then syncs when back online.
    growthApi.listRecords(childId).then((res) => setRecords(childId, res.data));
  }, [childId, setRecords]);

  const latest = records[records.length - 1];

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
      heightCm: String(record.heightCm)
    });
    setShowForm(true);
  };

  const handleDelete = async (record: GrowthRecord) => {
    if (!childId) return;
    if (!window.confirm(`Hapus pengukuran tanggal ${record.measuredAt}?`)) return;
    await growthApi.deleteRecord(record.id);
    removeRecord(childId, record.id);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!childId || !child) return;
    setError('');
    setSaving(true);
    const payload = {
      childId,
      measuredAt: form.measuredAt,
      weightKg: Number(form.weightKg),
      heightCm: Number(form.heightCm),
      ageMonths: monthsBetween(child.birthDate, form.measuredAt)
    };
    try {
      if (editingId) {
        const res = await growthApi.updateRecord(editingId, payload);
        updateRecord(res.data);
      } else {
        const res = await growthApi.createRecord(payload);
        addRecord(res.data);
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
    } catch {
      setError('Gagal menyimpan pengukuran. Periksa kembali data yang diisi.');
    } finally {
      setSaving(false);
    }
  };

  const sortedRecords = records.slice().sort((a, b) => b.ageMonths - a.ageMonths);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{child?.name ?? 'Grafik Pertumbuhan'}</h1>
        <div className="flex items-center gap-2">
          {latest?.riskStatus && <RiskBadge status={latest.riskStatus} />}
          <button
            onClick={() => (showForm ? setShowForm(false) : startAdd())}
            className="bg-teal-700 text-white text-sm font-medium px-3 py-2 rounded-lg"
          >
            {showForm ? 'Batal' : '+ Pengukuran'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Tanggal Pengukuran</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2"
              value={form.measuredAt}
              onChange={(e) => setForm({ ...form, measuredAt: e.target.value })}
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
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => startEdit(record)} className="text-sm text-teal-700 font-medium">
                  Edit
                </button>
                <button onClick={() => handleDelete(record)} className="text-sm text-red-600 font-medium">
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
