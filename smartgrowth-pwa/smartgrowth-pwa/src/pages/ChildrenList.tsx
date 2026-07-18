import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, Baby, Info, Loader2, MapPin, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import { growthApi } from '@/api/growth';
import { firstErrorMessage, parseFieldErrors } from '@/api/errors';
import { authApi } from '@/api/auth';
import { useGrowthStore } from '@/features/growth/store';
import { FieldError } from '@/components/FieldError';
import { RiskBadge } from '@/components/RiskBadge';
import { Toggle } from '@/components/Toggle';
import type { Child, GrowthRecord } from '@/types';

const emptyForm = {
  name: '',
  birthDate: '',
  sex: 'male' as Child['sex'],
  parentName: '',
  parentOccupation: '',
  posyanduLocation: '',
  exclusiveBreastfeeding: false,
  birthWeightKg: '',
  birthLengthCm: '',
  gestationalAgeWeeks: ''
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
  const navigate = useNavigate();
  const children = useGrowthStore((s) => s.children);
  const setChildren = useGrowthStore((s) => s.setChildren);
  const addChild = useGrowthStore((s) => s.addChild);
  const updateChild = useGrowthStore((s) => s.updateChild);
  const removeChild = useGrowthStore((s) => s.removeChild);

  const [loadingChildren, setLoadingChildren] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [infoChild, setInfoChild] = useState<Child | null>(null);
  const [latestRecord, setLatestRecord] = useState<GrowthRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const canCreate = authApi.canCreate();
  const canEditDelete = authApi.canEditDelete();
  const inputClass = (field: string) => `field-input${fieldErrors[field] ? ' field-input-error' : ''}`;

  const locationOptions = Array.from(
    new Set(children.map((c) => c.posyanduLocation).filter((v): v is string => !!v?.trim()))
  ).sort((a, b) => a.localeCompare(b));

  const filteredChildren = locationFilter
    ? children.filter((c) => c.posyanduLocation === locationFilter)
    : children;

  useEffect(() => {
    growthApi.listChildren()
      .then((res) => setChildren(res.data))
      .finally(() => setLoadingChildren(false));
  }, [setChildren]);

  const openInfo = async (child: Child) => {
    setInfoChild(child);
    setLatestRecord(null);
    setLoadingRecord(true);
    try {
      const res = await growthApi.listRecords(child.id);
      setLatestRecord(res.data[res.data.length - 1] ?? null);
    } finally {
      setLoadingRecord(false);
    }
  };

  const startEdit = (child: Child) => {
    setEditingId(child.id);
    setFieldErrors({});
    setForm({
      name: child.name,
      birthDate: child.birthDate,
      sex: child.sex,
      parentName: child.parentName ?? '',
      parentOccupation: child.parentOccupation ?? '',
      posyanduLocation: child.posyanduLocation ?? '',
      exclusiveBreastfeeding: child.exclusiveBreastfeeding ?? false,
      birthWeightKg: child.birthWeightKg != null ? String(child.birthWeightKg) : '',
      birthLengthCm: child.birthLengthCm != null ? String(child.birthLengthCm) : '',
      gestationalAgeWeeks: child.gestationalAgeWeeks != null ? String(child.gestationalAgeWeeks) : ''
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
    setFieldErrors({});

    if (form.birthDate > today) {
      setFieldErrors({ birthDate: 'Tanggal lahir tidak boleh di masa depan.' });
      setError('Periksa kembali data yang ditandai merah di bawah.');
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name,
      birthDate: form.birthDate,
      sex: form.sex,
      parentName: form.parentName,
      parentOccupation: form.parentOccupation,
      posyanduLocation: form.posyanduLocation,
      exclusiveBreastfeeding: form.exclusiveBreastfeeding,
      birthWeightKg: form.birthWeightKg ? Number(form.birthWeightKg) : undefined,
      birthLengthCm: form.birthLengthCm ? Number(form.birthLengthCm) : undefined,
      gestationalAgeWeeks: form.gestationalAgeWeeks ? Number(form.gestationalAgeWeeks) : undefined
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
      if (axios.isAxiosError(err) && err.response?.data) {
        const fields = parseFieldErrors(err.response.data);
        setFieldErrors(fields);
        setError(
          Object.keys(fields).length > 0
            ? 'Periksa kembali data yang ditandai merah di bawah.'
            : firstErrorMessage(err.response.data) ?? 'Gagal menyimpan balita. Periksa kembali data yang diisi.'
        );
      } else {
        setError('Gagal menyimpan balita. Periksa kembali data yang diisi.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-3 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display font-extrabold text-2xl text-gray-900">
            <Baby className="h-6 w-6 text-primary" aria-hidden="true" />
            Data Balita
          </h1>
          <p className="text-sm text-primary font-medium">
            {locationFilter
              ? `${filteredChildren.length} dari ${children.length} balita terdaftar`
              : `${children.length} balita terdaftar`}
          </p>
        </div>
        {canCreate && (
          <button onClick={() => (showForm ? setShowForm(false) : navigate('/skrining'))} className="btn-primary">
            {showForm ? (
              <>
                <X className="h-4 w-4" aria-hidden="true" />
                Batal
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Tambah Balita
              </>
            )}
          </button>
        )}
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

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {showForm && (editingId ? canEditDelete : canCreate) && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3">
          <div>
            <label htmlFor="child-name" className="field-label">
              Nama
            </label>
            <input
              id="child-name"
              className="field-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="parent-name" className="field-label">
                Nama Orang Tua (opsional)
              </label>
              <input
                id="parent-name"
                className="field-input"
                value={form.parentName}
                onChange={(e) => setForm({ ...form, parentName: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="parent-occupation" className="field-label">
                Pekerjaan Orang Tua (opsional)
              </label>
              <input
                id="parent-occupation"
                className="field-input"
                value={form.parentOccupation}
                onChange={(e) => setForm({ ...form, parentOccupation: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label htmlFor="child-posyandu-location" className="field-label flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
              Lokasi Posyandu/Klinik (opsional)
            </label>
            <input
              id="child-posyandu-location"
              list="child-posyandu-location-options"
              className="field-input"
              placeholder="cth: Posyandu Melati"
              value={form.posyanduLocation}
              onChange={(e) => setForm({ ...form, posyanduLocation: e.target.value })}
            />
            <datalist id="child-posyandu-location-options">
              {locationOptions.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="child-birthdate" className="field-label">
                Tanggal Lahir
              </label>
              <input
                id="child-birthdate"
                type="date"
                className={inputClass('birthDate')}
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                max={today}
                required
              />
              <FieldError message={fieldErrors.birthDate} />
            </div>
            <div>
              <label htmlFor="child-sex" className="field-label">
                Jenis Kelamin
              </label>
              <select
                id="child-sex"
                className="field-input"
                value={form.sex}
                onChange={(e) => setForm({ ...form, sex: e.target.value as Child['sex'] })}
              >
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="child-birthweight" className="field-label">
                Berat Lahir (kg, opsional)
              </label>
              <input
                id="child-birthweight"
                type="number"
                step="0.01"
                className={inputClass('birthWeightKg')}
                value={form.birthWeightKg}
                onChange={(e) => setForm({ ...form, birthWeightKg: e.target.value })}
              />
              <FieldError message={fieldErrors.birthWeightKg} />
            </div>
            <div>
              <label htmlFor="child-birthlength" className="field-label">
                Panjang Lahir (cm, opsional)
              </label>
              <input
                id="child-birthlength"
                type="number"
                step="0.1"
                className={inputClass('birthLengthCm')}
                value={form.birthLengthCm}
                onChange={(e) => setForm({ ...form, birthLengthCm: e.target.value })}
              />
              <FieldError message={fieldErrors.birthLengthCm} />
            </div>
            <div>
              <label htmlFor="gestational-age" className="field-label">
                Usia Kehamilan (minggu, opsional)
              </label>
              <input
                id="gestational-age"
                type="number"
                className={inputClass('gestationalAgeWeeks')}
                value={form.gestationalAgeWeeks}
                onChange={(e) => setForm({ ...form, gestationalAgeWeeks: e.target.value })}
              />
              <FieldError message={fieldErrors.gestationalAgeWeeks} />
            </div>
          </div>
          <Toggle
            id="child-exclusive-breastfeeding"
            label="ASI Eksklusif 0-6 bulan"
            checked={form.exclusiveBreastfeeding}
            onChange={(checked) => setForm({ ...form, exclusiveBreastfeeding: checked })}
          />
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

      {loadingChildren ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-10">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat data balita...
        </div>
      ) : (
        <>
          {filteredChildren.map((child) => (
            <div key={child.id} className="card p-4 flex items-center gap-3">
              <Link
                to={`/child/${child.id}`}
                className="flex items-center gap-3 flex-1 min-w-0 active:opacity-70 rounded-lg"
              >
                <span className="flex items-center justify-center h-10 w-10 shrink-0 rounded-full bg-primary-light text-primary">
                  <Baby className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <p className="font-medium text-gray-900 truncate">{child.name}</p>
                    {child.growthAlert === '2T' && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 shrink-0"
                        title="Berat badan tidak naik 2x berturut-turut"
                      >
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        2T
                      </span>
                    )}
                  </span>
                  <p className="text-sm text-gray-500">Lahir: {child.birthDate}</p>
                  {child.posyanduLocation && (
                    <p className="flex items-center gap-1 text-xs text-gray-400 truncate">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {child.posyanduLocation}
                    </p>
                  )}
                </span>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openInfo(child)}
                  aria-label={`Info ${child.name}`}
                  className="flex items-center justify-center h-11 w-11 rounded-lg text-gray-500 hover:bg-primary-light hover:text-primary"
                >
                  <Info className="h-5 w-5" aria-hidden="true" />
                </button>
                {canEditDelete && (
                  <>
                    <button
                      onClick={() => startEdit(child)}
                      aria-label={`Edit ${child.name}`}
                      className="flex items-center justify-center h-11 w-11 rounded-lg text-primary hover:bg-primary-light"
                    >
                      <Pencil className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleDelete(child)}
                      aria-label={`Hapus ${child.name}`}
                      className="flex items-center justify-center h-11 w-11 rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {filteredChildren.length === 0 && !showForm && (
            <div className="flex flex-col items-center gap-3 text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Baby className="h-14 w-14 text-gray-300" aria-hidden="true" />
              {children.length === 0 ? (
                <>
                  <p className="text-sm text-gray-500">Belum ada balita terdaftar</p>
                  {canCreate && (
                    <button onClick={() => navigate('/skrining')} className="btn-primary">
                      Tambah Balita Pertama
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500">Tidak ada balita di lokasi &quot;{locationFilter}&quot;</p>
                  <button onClick={() => setLocationFilter('')} className="btn-secondary">
                    Reset Filter
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {infoChild && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 print:static print:bg-white print:p-0">
          <div className="print-area bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">{infoChild.name}</h2>
            {infoChild.growthAlert === '2T' && (
              <p className="flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Berat badan tidak naik 2x pengukuran berturut-turut (2T) — rujuk ke Puskesmas.
              </p>
            )}
            <div className="text-sm text-gray-600 space-y-1">
              <p>Tanggal Lahir: {infoChild.birthDate} ({ageLabel(infoChild.birthDate)})</p>
              <p>Jenis Kelamin: {infoChild.sex === 'male' ? 'Laki-laki' : 'Perempuan'}</p>
              <p>
                ASI Eksklusif:{' '}
                {infoChild.exclusiveBreastfeeding == null ? '-' : infoChild.exclusiveBreastfeeding ? 'Ya' : 'Tidak'}
              </p>
              <p>Berat Lahir: {infoChild.birthWeightKg != null ? `${infoChild.birthWeightKg} kg` : '-'}</p>
            </div>

            <div className="border-t pt-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Hasil Pengukuran Terakhir</p>
                {latestRecord?.riskStatus && <RiskBadge status={latestRecord.riskStatus} />}
              </div>
              {loadingRecord ? (
                <p className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Memuat...
                </p>
              ) : latestRecord ? (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    Tanggal: {latestRecord.measuredAt} &middot; Usia: {latestRecord.ageMonths} bln
                  </p>
                  <p>
                    Berat: {latestRecord.weightKg} kg &middot; Tinggi: {latestRecord.heightCm} cm
                  </p>
                  {latestRecord.notes && (
                    <div className="bg-gray-50 rounded-lg p-3 mt-1">
                      <p className="text-gray-500 mb-1">Catatan:</p>
                      <p className="text-gray-700 whitespace-pre-wrap">{latestRecord.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Belum ada data pengukuran.</p>
              )}
            </div>

            <div className="flex gap-2 print:hidden">
              <button onClick={() => window.print()} className="btn-secondary flex-1">
                <Printer className="h-4 w-4" aria-hidden="true" />
                Cetak
              </button>
              <button
                onClick={() => {
                  setInfoChild(null);
                  setLatestRecord(null);
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
