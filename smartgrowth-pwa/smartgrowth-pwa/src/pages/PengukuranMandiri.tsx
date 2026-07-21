import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Baby, Loader2, Ruler } from 'lucide-react';
import { growthApi } from '@/api/growth';
import { authApi } from '@/api/auth';
import { firstErrorMessage, parseFieldErrors } from '@/api/errors';
import { FieldError } from '@/components/FieldError';
import { monthsBetween } from '@/lib/dates';
import type { Child } from '@/types';

const today = new Date().toISOString().slice(0, 10);

// Orangtua-only, simplified counterpart to the full kader/nakes Skrining.tsx
// — just the core anthropometric fields for a child they're already linked
// to (no "Balita Baru" mode, no officer/location/kuesioner section, those
// don't apply to a self-reported at-home measurement). Backend enforces the
// same scope independently (GrowthRecordPermission + GrowthRecordSerializer.
// validate()), this page just keeps the form itself simple.
export default function PengukuranMandiri() {
  const isOrangtua = authApi.canSelfMeasure();
  const [searchParams] = useSearchParams();
  const preselectedChildId = searchParams.get('child') ?? '';
  const navigate = useNavigate();

  const [children, setChildren] = useState<Child[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [childId, setChildId] = useState(preselectedChildId);
  const [measuredAt, setMeasuredAt] = useState(today);
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [headCircumferenceCm, setHeadCircumferenceCm] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const inputClass = (field: string) => `field-input${fieldErrors[field] ? ' field-input-error' : ''}`;

  useEffect(() => {
    if (!isOrangtua) return;
    growthApi
      .listChildren()
      .then((res) => {
        setChildren(res.data);
        if (!preselectedChildId && res.data.length > 0) setChildId(res.data[0].id);
      })
      .finally(() => setLoadingChildren(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOrangtua]);

  if (!isOrangtua) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <p className="text-sm text-gray-500">Halaman ini khusus untuk peran Orang Tua.</p>
      </div>
    );
  }

  const selectedChild = children.find((c) => c.id === childId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedChild) return;
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      await growthApi.createRecord({
        childId: selectedChild.id,
        measuredAt,
        weightKg: Number(weightKg),
        heightCm: Number(heightCm),
        headCircumferenceCm: headCircumferenceCm ? Number(headCircumferenceCm) : undefined,
        ageMonths: monthsBetween(selectedChild.birthDate, measuredAt),
        notes: notes || undefined
      });
      navigate(`/child/${selectedChild.id}`, { replace: true });
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
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-display font-extrabold text-2xl text-gray-900">
          <Ruler className="h-6 w-6 text-primary" aria-hidden="true" />
          Pengukuran Mandiri
        </h1>
        <p className="text-sm text-gray-500">
          Catat berat &amp; tinggi badan balita Anda sendiri di antara kunjungan Posyandu.
        </p>
      </div>

      {loadingChildren ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-10">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat...
        </div>
      ) : children.length === 0 ? (
        <div className="card p-6 text-center space-y-3">
          <Baby className="h-8 w-8 text-gray-300 mx-auto" aria-hidden="true" />
          <p className="text-sm text-gray-500">
            Belum ada balita yang tertaut ke akun Anda. Minta kode tautan dari kader/nakes posyandu terlebih
            dahulu.
          </p>
          <Link to="/tautkan-balita" className="btn-primary w-full">
            Tautkan Balita
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}
          {children.length > 1 && (
            <div>
              <label htmlFor="mandiri-child" className="field-label">
                Balita
              </label>
              <select
                id="mandiri-child"
                className="field-input"
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="mandiri-measured-at" className="field-label">
                Tanggal
              </label>
              <input
                id="mandiri-measured-at"
                type="date"
                className={inputClass('measuredAt')}
                value={measuredAt}
                onChange={(e) => setMeasuredAt(e.target.value)}
                max={today}
                required
              />
              <FieldError message={fieldErrors.measuredAt} />
            </div>
            <div>
              <label htmlFor="mandiri-weight-kg" className="field-label">
                Berat (kg)
              </label>
              <input
                id="mandiri-weight-kg"
                type="number"
                step="0.01"
                className={inputClass('weightKg')}
                placeholder="cth: 9.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
              />
              <FieldError message={fieldErrors.weightKg} />
            </div>
            <div>
              <label htmlFor="mandiri-height-cm" className="field-label">
                Tinggi/Panjang (cm)
              </label>
              <input
                id="mandiri-height-cm"
                type="number"
                step="0.01"
                className={inputClass('heightCm')}
                placeholder="cth: 75.2"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                required
              />
              <FieldError message={fieldErrors.heightCm} />
            </div>
            <div>
              <label htmlFor="mandiri-head-circumference" className="field-label">
                Lingkar Kepala (cm)
              </label>
              <input
                id="mandiri-head-circumference"
                type="number"
                step="0.1"
                className={inputClass('headCircumferenceCm')}
                placeholder="opsional"
                value={headCircumferenceCm}
                onChange={(e) => setHeadCircumferenceCm(e.target.value)}
              />
              <FieldError message={fieldErrors.headCircumferenceCm} />
            </div>
          </div>
          <div>
            <label htmlFor="mandiri-notes" className="field-label">
              Catatan (opsional)
            </label>
            <textarea
              id="mandiri-notes"
              className="field-input"
              rows={2}
              placeholder="Mis. anak rewel saat diukur"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Menyimpan...
              </>
            ) : (
              'Simpan Pengukuran'
            )}
          </button>
        </form>
      )}
    </div>
  );
}
