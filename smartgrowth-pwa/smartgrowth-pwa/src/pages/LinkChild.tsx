import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Link2, Loader2 } from 'lucide-react';
import { growthApi } from '@/api/growth';
import { firstErrorMessage, parseFieldErrors } from '@/api/errors';
import { FieldError } from '@/components/FieldError';
import { authApi } from '@/api/auth';

// Orangtua-only — kader/nakes/admin manage every child directly, they never
// need to "link" to one. Redeems the 6-digit Child.link_code a kader/nakes
// hands out at posyandu (see KodePosyandu.tsx's sibling flow for the
// kader_nakes invite code — this is the per-child equivalent, for parents).
export default function LinkChild() {
  const isOrangtua = authApi.isOrangtua();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [linkedName, setLinkedName] = useState('');
  const navigate = useNavigate();

  if (!isOrangtua) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <p className="text-sm text-gray-500">Halaman ini khusus untuk peran Orang Tua.</p>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);
    try {
      const res = await growthApi.linkChild(code);
      setLinkedName(res.data.name);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const fields = parseFieldErrors(err.response.data);
        setFieldErrors(fields);
        setError(
          Object.keys(fields).length > 0
            ? 'Periksa kembali kode yang diisi.'
            : firstErrorMessage(err.response.data) ?? 'Gagal menautkan balita.'
        );
      } else {
        setError('Gagal menautkan balita.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-display font-extrabold text-2xl text-gray-900">
          <Link2 className="h-6 w-6 text-primary" aria-hidden="true" />
          Tautkan Balita
        </h1>
        <p className="text-sm text-gray-500">
          Masukkan kode 6-digit dari kader/nakes posyandu untuk melihat data &amp; mencatat pengukuran mandiri
          balita Anda.
        </p>
      </div>

      {linkedName ? (
        <div className="card p-6 text-center space-y-3">
          <p className="text-sm text-gray-700">
            Berhasil ditautkan ke <span className="font-semibold">{linkedName}</span>.
          </p>
          <button onClick={() => navigate('/')} className="btn-primary w-full">
            Ke Beranda
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="link-code" className="field-label">
              Kode Tautan
            </label>
            <input
              id="link-code"
              inputMode="numeric"
              className={`field-input text-center tracking-[0.3em] font-mono text-lg${
                fieldErrors.code ? ' field-input-error' : ''
              }`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="123456"
              required
            />
            <FieldError message={fieldErrors.code} />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Menautkan...
              </>
            ) : (
              'Tautkan'
            )}
          </button>
        </form>
      )}
    </div>
  );
}
