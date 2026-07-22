import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Camera,
  Droplets,
  Loader2,
  MapPin,
  Pencil,
  Ruler,
  Smile,
  Sparkles,
  Syringe,
  Thermometer,
  UserPlus
} from 'lucide-react';
import { growthApi } from '@/api/growth';
import { scheduleApi } from '@/api/schedule';
import { firstErrorMessage, parseFieldErrors } from '@/api/errors';
import { authApi } from '@/api/auth';
import { FieldError } from '@/components/FieldError';
import { Toggle } from '@/components/Toggle';
import { monthsBetween } from '@/lib/dates';
import type { Child } from '@/types';

const today = new Date().toISOString().slice(0, 10);

type TriState = '' | 'yes' | 'no';

function fromTriState(value: TriState): boolean | null {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null;
}

function toTriState(value: boolean | null | undefined): TriState {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return '';
}

const emptyChildForm = {
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

const emptyMeasurementForm = {
  measuredAt: today,
  weightKg: '',
  heightCm: '',
  headCircumferenceCm: '',
  officerName: '',
  location: '',
  cleanWaterAccess: '' as TriState,
  recurrentIllness: '' as TriState,
  immunizationComplete: '' as TriState,
  notes: ''
};

export default function Skrining() {
  const navigate = useNavigate();
  const canCreate = authApi.canCreate();
  const [searchParams] = useSearchParams();
  // Three ways to land here:
  //  - plain /skrining (or ?child=<id> from "+ Pengukuran"): create a new
  //    child+measurement, or a new measurement for an existing child.
  //  - ?editChild=<id> (from Data Balita's Edit button): update that
  //    child's own info — reuses the "Balita Baru" fields, prefilled.
  //  - ?editRecord=<id>&child=<id> (from ChildDashboard's Edit button):
  //    update that one measurement's Data Antropometri + Kuesioner only.
  const preselectedChildId = searchParams.get('child') ?? '';
  const editChildId = searchParams.get('editChild');
  const editRecordId = searchParams.get('editRecord');
  const pageMode: 'create' | 'editChild' | 'editRecord' = editRecordId
    ? 'editRecord'
    : editChildId
      ? 'editChild'
      : 'create';

  const [mode, setMode] = useState<'existing' | 'new'>(
    preselectedChildId && pageMode === 'create' ? 'existing' : 'new'
  );
  const [children, setChildren] = useState<Child[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [selectedChildId, setSelectedChildId] = useState(pageMode === 'create' ? preselectedChildId : '');
  const [childForm, setChildForm] = useState(emptyChildForm);
  const [measurementForm, setMeasurementForm] = useState(emptyMeasurementForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingPrefill, setLoadingPrefill] = useState(pageMode !== 'create');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editRecordChildName, setEditRecordChildName] = useState('');
  const [editRecordChildBirthDate, setEditRecordChildBirthDate] = useState('');
  const inputClass = (field: string) => `field-input${fieldErrors[field] ? ' field-input-error' : ''}`;

  useEffect(() => {
    if (pageMode !== 'create') return;
    // Saran lokasi diambil dari posyandu balita lain + jadwal posyandu yang
    // sudah ada, supaya penulisan nama lokasi konsisten (mis. tidak ada yang
    // menulis "Posyandu Melati" dan "posyandu melati" sebagai dua tempat beda).
    Promise.all([growthApi.listChildren(), scheduleApi.listSchedules()])
      .then(([childrenRes, schedulesRes]) => {
        setChildren(childrenRes.data);
        const names = [
          ...childrenRes.data.map((c) => c.posyanduLocation),
          ...schedulesRes.data.map((s) => s.location)
        ].filter((v): v is string => !!v?.trim());
        setLocationOptions(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {});
  }, [pageMode]);

  useEffect(() => {
    if (pageMode !== 'editChild' || !editChildId) return;
    growthApi
      .getChild(editChildId)
      .then((res) => {
        const c = res.data;
        setChildForm({
          name: c.name,
          birthDate: c.birthDate,
          sex: c.sex,
          parentName: c.parentName ?? '',
          parentOccupation: c.parentOccupation ?? '',
          posyanduLocation: c.posyanduLocation ?? '',
          exclusiveBreastfeeding: c.exclusiveBreastfeeding ?? false,
          // Stored in kg — this field is labeled/edited in grams (cth: 3200).
          birthWeightKg: c.birthWeightKg != null ? String(Number(c.birthWeightKg) * 1000) : '',
          birthLengthCm: c.birthLengthCm != null ? String(c.birthLengthCm) : '',
          gestationalAgeWeeks: c.gestationalAgeWeeks != null ? String(c.gestationalAgeWeeks) : ''
        });
      })
      .finally(() => setLoadingPrefill(false));
  }, [pageMode, editChildId]);

  useEffect(() => {
    if (pageMode !== 'editRecord' || !editRecordId || !preselectedChildId) return;
    Promise.all([growthApi.getChild(preselectedChildId), growthApi.getRecord(editRecordId)])
      .then(([childRes, recordRes]) => {
        setEditRecordChildName(childRes.data.name);
        setEditRecordChildBirthDate(childRes.data.birthDate);
        const r = recordRes.data;
        setMeasurementForm({
          measuredAt: r.measuredAt,
          weightKg: String(r.weightKg),
          heightCm: String(r.heightCm),
          headCircumferenceCm: r.headCircumferenceCm != null ? String(r.headCircumferenceCm) : '',
          officerName: r.officerName ?? '',
          location: r.location ?? '',
          cleanWaterAccess: toTriState(r.cleanWaterAccess),
          recurrentIllness: toTriState(r.recurrentIllness),
          immunizationComplete: toTriState(r.immunizationComplete),
          notes: r.notes ?? ''
        });
      })
      .finally(() => setLoadingPrefill(false));
  }, [pageMode, editRecordId, preselectedChildId]);

  if (!canCreate) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <p className="text-sm text-gray-500">Peran Anda tidak memiliki akses untuk halaman ini.</p>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (pageMode === 'editChild' && editChildId) {
      if (childForm.birthDate > today) {
        setFieldErrors({ birthDate: 'Tanggal lahir tidak boleh di masa depan.' });
        setError('Periksa kembali data yang ditandai merah di bawah.');
        return;
      }
      setSaving(true);
      try {
        await growthApi.updateChild(editChildId, {
          name: childForm.name,
          birthDate: childForm.birthDate,
          sex: childForm.sex,
          parentName: childForm.parentName,
          parentOccupation: childForm.parentOccupation,
          posyanduLocation: childForm.posyanduLocation,
          exclusiveBreastfeeding: childForm.exclusiveBreastfeeding,
          birthWeightKg: childForm.birthWeightKg ? Number(childForm.birthWeightKg) / 1000 : undefined,
          birthLengthCm: childForm.birthLengthCm ? Number(childForm.birthLengthCm) : undefined,
          gestationalAgeWeeks: childForm.gestationalAgeWeeks ? Number(childForm.gestationalAgeWeeks) : undefined
        });
        navigate('/balita');
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.data) {
          const fields = parseFieldErrors(err.response.data);
          setFieldErrors(fields);
          setError(
            Object.keys(fields).length > 0
              ? 'Periksa kembali data yang ditandai merah di bawah.'
              : firstErrorMessage(err.response.data) ?? 'Gagal menyimpan perubahan.'
          );
        } else {
          setError('Gagal menyimpan perubahan.');
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    if (pageMode === 'editRecord' && editRecordId) {
      if (measurementForm.measuredAt > today) {
        setFieldErrors({ measuredAt: 'Tanggal pengukuran tidak boleh di masa depan.' });
        setError('Periksa kembali data yang ditandai merah di bawah.');
        return;
      }
      if (editRecordChildBirthDate && measurementForm.measuredAt < editRecordChildBirthDate) {
        setFieldErrors({ measuredAt: 'Tanggal pengukuran tidak boleh sebelum tanggal lahir anak.' });
        setError('Periksa kembali data yang ditandai merah di bawah.');
        return;
      }
      setSaving(true);
      try {
        await growthApi.updateRecord(editRecordId, {
          childId: preselectedChildId,
          measuredAt: measurementForm.measuredAt,
          weightKg: Number(measurementForm.weightKg),
          heightCm: Number(measurementForm.heightCm),
          headCircumferenceCm: measurementForm.headCircumferenceCm
            ? Number(measurementForm.headCircumferenceCm)
            : undefined,
          ageMonths: monthsBetween(editRecordChildBirthDate, measurementForm.measuredAt),
          officerName: measurementForm.officerName,
          location: measurementForm.location,
          photo: photo ?? undefined,
          cleanWaterAccess: fromTriState(measurementForm.cleanWaterAccess),
          recurrentIllness: fromTriState(measurementForm.recurrentIllness),
          immunizationComplete: fromTriState(measurementForm.immunizationComplete),
          notes: measurementForm.notes
        });
        navigate(`/child/${preselectedChildId}`);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.data) {
          const fields = parseFieldErrors(err.response.data);
          setFieldErrors(fields);
          setError(
            Object.keys(fields).length > 0
              ? 'Periksa kembali data yang ditandai merah di bawah.'
              : firstErrorMessage(err.response.data) ?? 'Gagal menyimpan pengukuran.'
          );
        } else {
          setError('Gagal menyimpan pengukuran.');
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    if (mode === 'existing' && !selectedChildId) {
      setError('Pilih balita terlebih dahulu.');
      return;
    }
    if (measurementForm.measuredAt > today) {
      setFieldErrors({ measuredAt: 'Tanggal pengukuran tidak boleh di masa depan.' });
      setError('Periksa kembali data yang ditandai merah di bawah.');
      return;
    }
    if (mode === 'new' && childForm.birthDate > today) {
      setFieldErrors({ birthDate: 'Tanggal lahir tidak boleh di masa depan.' });
      setError('Periksa kembali data yang ditandai merah di bawah.');
      return;
    }

    setSaving(true);
    try {
      let childId = selectedChildId;
      let birthDate = children.find((c) => c.id === selectedChildId)?.birthDate ?? '';

      if (mode === 'new') {
        const res = await growthApi.createChild({
          name: childForm.name,
          birthDate: childForm.birthDate,
          sex: childForm.sex,
          parentName: childForm.parentName,
          parentOccupation: childForm.parentOccupation,
          posyanduLocation: childForm.posyanduLocation,
          exclusiveBreastfeeding: childForm.exclusiveBreastfeeding,
          // Field is labeled/input in grams (cth: 3200) but the API stores kg.
          birthWeightKg: childForm.birthWeightKg ? Number(childForm.birthWeightKg) / 1000 : undefined,
          birthLengthCm: childForm.birthLengthCm ? Number(childForm.birthLengthCm) : undefined,
          gestationalAgeWeeks: childForm.gestationalAgeWeeks ? Number(childForm.gestationalAgeWeeks) : undefined
        });
        childId = res.data.id;
        birthDate = res.data.birthDate;
      }

      if (measurementForm.measuredAt < birthDate) {
        setFieldErrors({ measuredAt: 'Tanggal pengukuran tidak boleh sebelum tanggal lahir anak.' });
        setError('Periksa kembali data yang ditandai merah di bawah.');
        setSaving(false);
        return;
      }

      await growthApi.createRecord({
        childId,
        measuredAt: measurementForm.measuredAt,
        weightKg: Number(measurementForm.weightKg),
        heightCm: Number(measurementForm.heightCm),
        headCircumferenceCm: measurementForm.headCircumferenceCm
          ? Number(measurementForm.headCircumferenceCm)
          : undefined,
        photo: photo ?? undefined,
        ageMonths: monthsBetween(birthDate, measurementForm.measuredAt),
        officerName: measurementForm.officerName,
        location: measurementForm.location,
        cleanWaterAccess: fromTriState(measurementForm.cleanWaterAccess),
        recurrentIllness: fromTriState(measurementForm.recurrentIllness),
        immunizationComplete: fromTriState(measurementForm.immunizationComplete),
        notes: measurementForm.notes
      });
      navigate(`/child/${childId}`);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const fields = parseFieldErrors(err.response.data);
        setFieldErrors(fields);
        setError(
          Object.keys(fields).length > 0
            ? 'Periksa kembali data yang ditandai merah di bawah.'
            : firstErrorMessage(err.response.data) ?? 'Gagal menjalankan skrining. Periksa kembali data yang diisi.'
        );
      } else {
        setError('Gagal menjalankan skrining. Periksa kembali data yang diisi.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadingPrefill) {
    return (
      <div className="p-4 max-w-3xl mx-auto flex items-center justify-center gap-2 text-gray-400 text-sm py-16">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Memuat data...
      </div>
    );
  }

  const pageTitle =
    pageMode === 'editChild' ? 'Edit Data Balita' : pageMode === 'editRecord' ? 'Edit Pengukuran' : 'Skrining Baru';
  const pageSubtitle =
    pageMode === 'editChild'
      ? 'Perbarui data balita ini. Riwayat pengukuran tidak ikut berubah.'
      : pageMode === 'editRecord'
        ? `Perbarui data antropometri & kuesioner untuk ${editRecordChildName || 'balita ini'}.`
        : 'Isi data balita & antropometri. AI Screening Engine akan menghitung Z-Score WHO dan klasifikasi risiko otomatis.';

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="flex items-center gap-2 font-display font-extrabold text-2xl text-gray-900">
          {pageMode === 'create' ? (
            <Smile className="h-6 w-6 text-primary" aria-hidden="true" />
          ) : (
            <Pencil className="h-6 w-6 text-primary" aria-hidden="true" />
          )}
          {pageTitle}
        </h1>
        <p className="text-sm text-gray-500">{pageSubtitle}</p>
      </div>

      {pageMode === 'create' && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`text-left rounded-xl border-2 p-4 transition-colors ${
              mode === 'existing'
                ? 'border-primary bg-primary-light/60'
                : 'border-gray-200 bg-white hover:border-primary/40'
            }`}
          >
            <Ruler className="h-5 w-5 text-primary mb-2" aria-hidden="true" />
            <p className="font-medium text-gray-900">Balita Terdaftar</p>
            <p className="text-xs text-gray-500">Lanjutkan pemantauan ({children.length} balita)</p>
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`text-left rounded-xl border-2 p-4 transition-colors ${
              mode === 'new' ? 'border-primary bg-primary-light/60' : 'border-gray-200 bg-white hover:border-primary/40'
            }`}
          >
            <UserPlus className="h-5 w-5 text-primary mb-2" aria-hidden="true" />
            <p className="font-medium text-gray-900">Balita Baru</p>
            <p className="text-xs text-gray-500">Daftarkan balita baru</p>
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="card p-4 space-y-4">
        {pageMode !== 'editRecord' &&
          (pageMode === 'create' && mode === 'existing' ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="skrining-child-select" className="field-label">
                  Pilih Balita
                </label>
                <select
                  id="skrining-child-select"
                  className="field-input"
                  value={selectedChildId}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  required
                >
                  <option value="">-- Pilih balita --</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label htmlFor="skrining-name" className="field-label">
                  Nama Balita *
                </label>
                <input
                  id="skrining-name"
                  className="field-input"
                  placeholder="Nama lengkap"
                  value={childForm.name}
                  onChange={(e) => setChildForm({ ...childForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="skrining-birthdate" className="field-label">
                    Tanggal Lahir *
                  </label>
                  <input
                    id="skrining-birthdate"
                    type="date"
                    className={inputClass('birthDate')}
                    value={childForm.birthDate}
                    onChange={(e) => setChildForm({ ...childForm, birthDate: e.target.value })}
                    max={today}
                    required
                  />
                  <FieldError message={fieldErrors.birthDate} />
                </div>
                <div>
                  <label htmlFor="skrining-sex" className="field-label">
                    Jenis Kelamin *
                  </label>
                  <select
                    id="skrining-sex"
                    className="field-input"
                    value={childForm.sex}
                    onChange={(e) => setChildForm({ ...childForm, sex: e.target.value as Child['sex'] })}
                  >
                    <option value="male">Laki-laki</option>
                    <option value="female">Perempuan</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="skrining-posyandu-location" className="field-label flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                  Lokasi Posyandu/Klinik (opsional)
                </label>
                <input
                  id="skrining-posyandu-location"
                  list="posyandu-location-options"
                  className="field-input"
                  placeholder="cth: Posyandu Melati"
                  value={childForm.posyanduLocation}
                  onChange={(e) => setChildForm({ ...childForm, posyanduLocation: e.target.value })}
                />
                <datalist id="posyandu-location-options">
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
                <p className="text-xs text-gray-400 mt-1">Dipakai untuk memfilter daftar balita di halaman Data Balita.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="skrining-parent-name" className="field-label">
                    Nama Orang Tua
                  </label>
                  <input
                    id="skrining-parent-name"
                    className="field-input"
                    value={childForm.parentName}
                    onChange={(e) => setChildForm({ ...childForm, parentName: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="skrining-parent-occupation" className="field-label">
                    Pekerjaan Orang Tua
                  </label>
                  <input
                    id="skrining-parent-occupation"
                    className="field-input"
                    placeholder="cth: Petani, IRT, dll"
                    value={childForm.parentOccupation}
                    onChange={(e) => setChildForm({ ...childForm, parentOccupation: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="skrining-birthweight" className="field-label">
                    Berat Lahir (gram)
                  </label>
                  <input
                    id="skrining-birthweight"
                    type="number"
                    step="1"
                    className={inputClass('birthWeightKg')}
                    placeholder="cth: 3200"
                    value={childForm.birthWeightKg}
                    onChange={(e) => setChildForm({ ...childForm, birthWeightKg: e.target.value })}
                  />
                  <FieldError message={fieldErrors.birthWeightKg} />
                </div>
                <div>
                  <label htmlFor="skrining-birthlength" className="field-label">
                    Panjang Lahir (cm)
                  </label>
                  <input
                    id="skrining-birthlength"
                    type="number"
                    step="0.1"
                    className={inputClass('birthLengthCm')}
                    placeholder="cth: 49"
                    value={childForm.birthLengthCm}
                    onChange={(e) => setChildForm({ ...childForm, birthLengthCm: e.target.value })}
                  />
                  <FieldError message={fieldErrors.birthLengthCm} />
                </div>
              </div>
              <div>
                <label htmlFor="skrining-gestational-age" className="field-label">
                  Usia Kehamilan (minggu)
                </label>
                <input
                  id="skrining-gestational-age"
                  type="number"
                  className={inputClass('gestationalAgeWeeks')}
                  placeholder="cth: 38"
                  value={childForm.gestationalAgeWeeks}
                  onChange={(e) => setChildForm({ ...childForm, gestationalAgeWeeks: e.target.value })}
                />
                <FieldError message={fieldErrors.gestationalAgeWeeks} />
              </div>
              <Toggle
                id="skrining-exclusive-breastfeeding"
                label="ASI Eksklusif 0-6 bulan"
                checked={childForm.exclusiveBreastfeeding}
                onChange={(checked) => setChildForm({ ...childForm, exclusiveBreastfeeding: checked })}
              />
            </div>
          ))}

        {pageMode !== 'editChild' && (
          <>
            <div className={pageMode === 'editRecord' ? 'space-y-3' : 'border-t border-gray-100 pt-4 space-y-3'}>
              <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
                <Ruler className="h-4 w-4 text-accent" aria-hidden="true" />
                Data Antropometri
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="skrining-measured-at" className="field-label">
                    Tanggal
                  </label>
                  <input
                    id="skrining-measured-at"
                    type="date"
                    className={inputClass('measuredAt')}
                    value={measurementForm.measuredAt}
                    onChange={(e) => setMeasurementForm({ ...measurementForm, measuredAt: e.target.value })}
                    max={today}
                    required
                  />
                  <FieldError message={fieldErrors.measuredAt} />
                </div>
                <div>
                  <label htmlFor="skrining-weight-kg" className="field-label">
                    Berat Badan (kg) *
                  </label>
                  <input
                    id="skrining-weight-kg"
                    type="number"
                    step="0.01"
                    className={inputClass('weightKg')}
                    placeholder="cth: 9.5"
                    value={measurementForm.weightKg}
                    onChange={(e) => setMeasurementForm({ ...measurementForm, weightKg: e.target.value })}
                    required
                  />
                  <FieldError message={fieldErrors.weightKg} />
                </div>
                <div>
                  <label htmlFor="skrining-height-cm" className="field-label">
                    Tinggi/Panjang (cm) *
                  </label>
                  <input
                    id="skrining-height-cm"
                    type="number"
                    step="0.01"
                    className={inputClass('heightCm')}
                    placeholder="cth: 75.2"
                    value={measurementForm.heightCm}
                    onChange={(e) => setMeasurementForm({ ...measurementForm, heightCm: e.target.value })}
                    required
                  />
                  <FieldError message={fieldErrors.heightCm} />
                </div>
                <div>
                  <label htmlFor="skrining-head-circumference" className="field-label">
                    Lingkar Kepala (cm)
                  </label>
                  <input
                    id="skrining-head-circumference"
                    type="number"
                    step="0.1"
                    className={inputClass('headCircumferenceCm')}
                    placeholder="opsional"
                    value={measurementForm.headCircumferenceCm}
                    onChange={(e) => setMeasurementForm({ ...measurementForm, headCircumferenceCm: e.target.value })}
                  />
                  <FieldError message={fieldErrors.headCircumferenceCm} />
                </div>
              </div>
              <div>
                <label htmlFor="skrining-officer-name" className="field-label">
                  Nama Petugas
                </label>
                <input
                  id="skrining-officer-name"
                  className="field-input"
                  placeholder="Mis. Bidan Sari"
                  value={measurementForm.officerName}
                  onChange={(e) => setMeasurementForm({ ...measurementForm, officerName: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="skrining-location" className="field-label">
                  Lokasi Pengukuran
                </label>
                <input
                  id="skrining-location"
                  className="field-input"
                  placeholder="Mis. Posyandu Melati"
                  value={measurementForm.location}
                  onChange={(e) => setMeasurementForm({ ...measurementForm, location: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="skrining-photo" className="field-label flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                  Foto Balita (opsional)
                </label>
                <p className="text-xs text-gray-400 mb-1">Simulasi antropometri digital &amp; dokumentasi pertumbuhan.</p>
                <input
                  id="skrining-photo"
                  type="file"
                  accept="image/*"
                  className="field-input text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary-light file:text-primary"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
                <Syringe className="h-4 w-4 text-accent" aria-hidden="true" />
                Kuesioner Faktor Risiko
              </p>
              <div>
                <label htmlFor="skrining-clean-water" className="field-label flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                  Akses air bersih &amp; sanitasi layak
                </label>
                <select
                  id="skrining-clean-water"
                  className="field-input text-sm"
                  value={measurementForm.cleanWaterAccess}
                  onChange={(e) =>
                    setMeasurementForm({ ...measurementForm, cleanWaterAccess: e.target.value as TriState })
                  }
                >
                  <option value="">Belum diisi</option>
                  <option value="yes">Ya</option>
                  <option value="no">Tidak</option>
                </select>
              </div>
              <div>
                <label htmlFor="skrining-recurrent-illness" className="field-label flex items-center gap-1.5">
                  <Thermometer className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                  Riwayat sakit/diare berulang (3 bulan terakhir)
                </label>
                <select
                  id="skrining-recurrent-illness"
                  className="field-input text-sm"
                  value={measurementForm.recurrentIllness}
                  onChange={(e) =>
                    setMeasurementForm({ ...measurementForm, recurrentIllness: e.target.value as TriState })
                  }
                >
                  <option value="">Belum diisi</option>
                  <option value="yes">Ya</option>
                  <option value="no">Tidak</option>
                </select>
              </div>
              <div>
                <label htmlFor="skrining-immunization" className="field-label flex items-center gap-1.5">
                  <Syringe className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
                  Imunisasi lengkap sesuai usia
                </label>
                <select
                  id="skrining-immunization"
                  className="field-input text-sm"
                  value={measurementForm.immunizationComplete}
                  onChange={(e) =>
                    setMeasurementForm({ ...measurementForm, immunizationComplete: e.target.value as TriState })
                  }
                >
                  <option value="">Belum diisi</option>
                  <option value="yes">Ya</option>
                  <option value="no">Tidak</option>
                </select>
              </div>
              <div>
                <label htmlFor="skrining-notes" className="field-label">
                  Catatan (opsional)
                </label>
                <textarea
                  id="skrining-notes"
                  className="field-input text-sm"
                  rows={2}
                  placeholder="Mis. anak rewel saat diukur, sudah dirujuk ke puskesmas, dll."
                  value={measurementForm.notes}
                  onChange={(e) => setMeasurementForm({ ...measurementForm, notes: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full bg-gradient-hero hover:opacity-90"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Menyimpan...
            </>
          ) : pageMode === 'create' ? (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Jalankan AI Screening
            </>
          ) : (
            'Simpan Perubahan'
          )}
        </button>
      </form>
    </div>
  );
}
