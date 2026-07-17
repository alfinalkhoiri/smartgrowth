import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { growthApi } from '@/api/growth';
import { firstErrorMessage } from '@/api/errors';
import { authApi } from '@/api/auth';
import { monthsBetween } from '@/lib/dates';
import type { Child } from '@/types';

const today = new Date().toISOString().slice(0, 10);

const emptyChildForm = {
  name: '',
  birthDate: '',
  sex: 'male' as Child['sex'],
  parentName: '',
  parentOccupation: '',
  exclusiveBreastfeeding: false,
  birthWeightKg: '',
  birthLengthCm: '',
  gestationalAgeWeeks: ''
};

const emptyMeasurementForm = {
  measuredAt: today,
  weightKg: '',
  heightCm: '',
  headCircumferenceCm: ''
};

export default function Skrining() {
  const navigate = useNavigate();
  const canCreate = authApi.canCreate();

  const [step, setStep] = useState<1 | 2>(1);
  const [childForm, setChildForm] = useState(emptyChildForm);
  const [measurementForm, setMeasurementForm] = useState(emptyMeasurementForm);
  const [createdChild, setCreatedChild] = useState<Child | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!canCreate) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <p className="text-sm text-gray-500">
          Peran Anda tidak memiliki akses untuk memulai skrining baru.
        </p>
      </div>
    );
  }

  const handleChildSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (childForm.birthDate > today) {
      setError('Tanggal lahir tidak boleh di masa depan.');
      return;
    }
    setSaving(true);
    try {
      const res = await growthApi.createChild({
        name: childForm.name,
        birthDate: childForm.birthDate,
        sex: childForm.sex,
        parentName: childForm.parentName,
        parentOccupation: childForm.parentOccupation,
        exclusiveBreastfeeding: childForm.exclusiveBreastfeeding,
        birthWeightKg: childForm.birthWeightKg ? Number(childForm.birthWeightKg) : undefined,
        birthLengthCm: childForm.birthLengthCm ? Number(childForm.birthLengthCm) : undefined,
        gestationalAgeWeeks: childForm.gestationalAgeWeeks ? Number(childForm.gestationalAgeWeeks) : undefined
      });
      setCreatedChild(res.data);
      setStep(2);
    } catch (err) {
      const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
      setError(message ?? 'Gagal menyimpan data balita. Periksa kembali data yang diisi.');
    } finally {
      setSaving(false);
    }
  };

  const handleMeasurementSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!createdChild) return;
    setError('');
    if (measurementForm.measuredAt > today) {
      setError('Tanggal pengukuran tidak boleh di masa depan.');
      return;
    }
    setSaving(true);
    try {
      await growthApi.createRecord({
        childId: createdChild.id,
        measuredAt: measurementForm.measuredAt,
        weightKg: Number(measurementForm.weightKg),
        heightCm: Number(measurementForm.heightCm),
        headCircumferenceCm: measurementForm.headCircumferenceCm
          ? Number(measurementForm.headCircumferenceCm)
          : undefined,
        ageMonths: monthsBetween(createdChild.birthDate, measurementForm.measuredAt)
      });
      navigate(`/child/${createdChild.id}`);
    } catch (err) {
      const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
      setError(message ?? 'Gagal menyimpan pengukuran. Periksa kembali data yang diisi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <h1 className="text-xl font-display font-semibold text-gray-900">Skrining Baru</h1>

      <div className="flex items-center gap-2 text-sm">
        <span className={`flex items-center gap-1.5 ${step === 1 ? 'text-primary font-medium' : 'text-gray-400'}`}>
          {step > 1 ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Circle className="h-4 w-4" aria-hidden="true" />
          )}
          1. Data Balita
        </span>
        <span className="text-gray-300">&mdash;</span>
        <span className={`flex items-center gap-1.5 ${step === 2 ? 'text-primary font-medium' : 'text-gray-400'}`}>
          <Circle className="h-4 w-4" aria-hidden="true" />
          2. Pengukuran Pertama
        </span>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {step === 1 && (
        <form onSubmit={handleChildSubmit} className="card p-4 space-y-3">
          <div>
            <label htmlFor="skrining-name" className="field-label">
              Nama
            </label>
            <input
              id="skrining-name"
              className="field-input"
              value={childForm.name}
              onChange={(e) => setChildForm({ ...childForm, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="skrining-parent-name" className="field-label">
                Nama Orang Tua (opsional)
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
                Pekerjaan Orang Tua (opsional)
              </label>
              <input
                id="skrining-parent-occupation"
                className="field-input"
                value={childForm.parentOccupation}
                onChange={(e) => setChildForm({ ...childForm, parentOccupation: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="skrining-birthdate" className="field-label">
                Tanggal Lahir
              </label>
              <input
                id="skrining-birthdate"
                type="date"
                className="field-input"
                value={childForm.birthDate}
                onChange={(e) => setChildForm({ ...childForm, birthDate: e.target.value })}
                max={today}
                required
              />
            </div>
            <div>
              <label htmlFor="skrining-sex" className="field-label">
                Jenis Kelamin
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
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="skrining-birthweight" className="field-label">
                Berat Lahir (kg, opsional)
              </label>
              <input
                id="skrining-birthweight"
                type="number"
                step="0.01"
                className="field-input"
                value={childForm.birthWeightKg}
                onChange={(e) => setChildForm({ ...childForm, birthWeightKg: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="skrining-birthlength" className="field-label">
                Panjang Lahir (cm, opsional)
              </label>
              <input
                id="skrining-birthlength"
                type="number"
                step="0.1"
                className="field-input"
                value={childForm.birthLengthCm}
                onChange={(e) => setChildForm({ ...childForm, birthLengthCm: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="skrining-gestational-age" className="field-label">
                Usia Kehamilan (minggu, opsional)
              </label>
              <input
                id="skrining-gestational-age"
                type="number"
                className="field-input"
                value={childForm.gestationalAgeWeeks}
                onChange={(e) => setChildForm({ ...childForm, gestationalAgeWeeks: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 min-h-[44px]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
              checked={childForm.exclusiveBreastfeeding}
              onChange={(e) => setChildForm({ ...childForm, exclusiveBreastfeeding: e.target.checked })}
            />
            ASI eksklusif
          </label>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Menyimpan...
              </>
            ) : (
              'Lanjut ke Pengukuran'
            )}
          </button>
        </form>
      )}

      {step === 2 && createdChild && (
        <form onSubmit={handleMeasurementSubmit} className="card p-4 space-y-3">
          <p className="text-sm text-gray-500">
            Data balita <span className="font-medium text-gray-900">{createdChild.name}</span> tersimpan. Lanjutkan
            dengan pengukuran pertama.
          </p>
          <div>
            <label htmlFor="skrining-measured-at" className="field-label">
              Tanggal Pengukuran
            </label>
            <input
              id="skrining-measured-at"
              type="date"
              className="field-input"
              value={measurementForm.measuredAt}
              onChange={(e) => setMeasurementForm({ ...measurementForm, measuredAt: e.target.value })}
              min={createdChild.birthDate}
              max={today}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="skrining-weight-kg" className="field-label">
                Berat (kg)
              </label>
              <input
                id="skrining-weight-kg"
                type="number"
                step="0.01"
                className="field-input"
                value={measurementForm.weightKg}
                onChange={(e) => setMeasurementForm({ ...measurementForm, weightKg: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="skrining-height-cm" className="field-label">
                Tinggi (cm)
              </label>
              <input
                id="skrining-height-cm"
                type="number"
                step="0.01"
                className="field-input"
                value={measurementForm.heightCm}
                onChange={(e) => setMeasurementForm({ ...measurementForm, heightCm: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label htmlFor="skrining-head-circumference" className="field-label">
              Lingkar Kepala (cm, opsional)
            </label>
            <input
              id="skrining-head-circumference"
              type="number"
              step="0.1"
              className="field-input"
              value={measurementForm.headCircumferenceCm}
              onChange={(e) => setMeasurementForm({ ...measurementForm, headCircumferenceCm: e.target.value })}
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Menyimpan...
              </>
            ) : (
              'Selesaikan Skrining'
            )}
          </button>
        </form>
      )}
    </div>
  );
}
