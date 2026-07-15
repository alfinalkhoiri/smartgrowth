import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { growthApi } from '@/api/growth';
import { firstErrorMessage } from '@/api/errors';
import { authApi } from '@/api/auth';
import { useGrowthStore } from '@/features/growth/store';
import type { Child } from '@/types';

const emptyForm = {
  name: '',
  birthDate: '',
  sex: 'male' as Child['sex'],
  exclusiveBreastfeeding: false,
  birthWeightKg: ''
};

const today = new Date().toISOString().slice(0, 10);

function ageLabel(birthDate: string): string {
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

export default function ChildrenList() {
  const children = useGrowthStore((s) => s.children);
  const setChildren = useGrowthStore((s) => s.setChildren);
  const addChild = useGrowthStore((s) => s.addChild);
  const updateChild = useGrowthStore((s) => s.updateChild);
  const removeChild = useGrowthStore((s) => s.removeChild);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [infoChild, setInfoChild] = useState<Child | null>(null);
  const canCreate = authApi.canCreate();
  const canEditDelete = authApi.canEditDelete();

  useEffect(() => {
    growthApi.listChildren().then((res) => setChildren(res.data));
  }, [setChildren]);

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (child: Child) => {
    setEditingId(child.id);
    setForm({
      name: child.name,
      birthDate: child.birthDate,
      sex: child.sex,
      exclusiveBreastfeeding: child.exclusiveBreastfeeding ?? false,
      birthWeightKg: child.birthWeightKg != null ? String(child.birthWeightKg) : ''
    });
    setShowForm(true);
  };

  const handleDelete = async (child: Child) => {
    if (!window.confirm(`Hapus data ${child.name}? Riwayat pengukurannya juga akan terhapus.`)) return;
    try {
      await growthApi.deleteChild(child.id);
      removeChild(child.id);
    } catch (err) {
      const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
      setError(message ?? 'Gagal menghapus balita.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.birthDate > today) {
      setError('Tanggal lahir tidak boleh di masa depan.');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name,
      birthDate: form.birthDate,
      sex: form.sex,
      exclusiveBreastfeeding: form.exclusiveBreastfeeding,
      birthWeightKg: form.birthWeightKg ? Number(form.birthWeightKg) : undefined
    };
    try {
      if (editingId) {
        const res = await growthApi.updateChild(editingId, payload);
        updateChild(res.data);
      } else {
        const res = await growthApi.createChild(payload);
        addChild(res.data);
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
      setError(message ?? 'Gagal menyimpan balita. Periksa kembali data yang diisi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Daftar Balita</h1>
        {canCreate && (
          <button
            onClick={() => (showForm ? setShowForm(false) : startAdd())}
            className="bg-teal-700 text-white text-sm font-medium px-3 py-2 rounded-lg"
          >
            {showForm ? 'Batal' : '+ Tambah Balita'}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (editingId ? canEditDelete : canCreate) && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Nama</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Tanggal Lahir</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                max={today}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Jenis Kelamin</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={form.sex}
                onChange={(e) => setForm({ ...form, sex: e.target.value as Child['sex'] })}
              >
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Berat Lahir (kg, opsional)</label>
            <input
              type="number"
              step="0.01"
              className="w-full border rounded-lg px-3 py-2"
              value={form.birthWeightKg}
              onChange={(e) => setForm({ ...form, birthWeightKg: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={form.exclusiveBreastfeeding}
              onChange={(e) => setForm({ ...form, exclusiveBreastfeeding: e.target.checked })}
            />
            ASI eksklusif
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-teal-700 text-white rounded-lg py-2 font-medium disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan'}
          </button>
        </form>
      )}

      {children.map((child) => (
        <div key={child.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between">
          <Link to={`/child/${child.id}`} className="flex-1 active:opacity-70">
            <p className="font-medium">{child.name}</p>
            <p className="text-sm text-gray-500">Lahir: {child.birthDate}</p>
          </Link>
          <div className="flex items-center gap-3 ml-2">
            <button onClick={() => setInfoChild(child)} className="text-sm text-gray-500 font-medium">
              Info
            </button>
            {canEditDelete && (
              <>
                <button onClick={() => startEdit(child)} className="text-sm text-teal-700 font-medium">
                  Edit
                </button>
                <button onClick={() => handleDelete(child)} className="text-sm text-red-600 font-medium">
                  Hapus
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {children.length === 0 && !showForm && (
        <p className="text-gray-400 text-sm">Belum ada data. Tambahkan balita baru.</p>
      )}

      {infoChild && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 print:static print:bg-white print:p-0">
          <div className="print-area bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-3">
            <h2 className="text-lg font-semibold">{infoChild.name}</h2>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Tanggal Lahir: {infoChild.birthDate} ({ageLabel(infoChild.birthDate)})</p>
              <p>Jenis Kelamin: {infoChild.sex === 'male' ? 'Laki-laki' : 'Perempuan'}</p>
              <p>
                ASI Eksklusif:{' '}
                {infoChild.exclusiveBreastfeeding == null ? '-' : infoChild.exclusiveBreastfeeding ? 'Ya' : 'Tidak'}
              </p>
              <p>Berat Lahir: {infoChild.birthWeightKg != null ? `${infoChild.birthWeightKg} kg` : '-'}</p>
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium"
              >
                Cetak
              </button>
              <button
                onClick={() => setInfoChild(null)}
                className="flex-1 bg-teal-700 text-white rounded-lg py-2 text-sm font-medium"
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
