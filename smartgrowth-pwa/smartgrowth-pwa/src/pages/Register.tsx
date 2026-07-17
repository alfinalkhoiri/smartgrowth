import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Sprout, UserPlus } from 'lucide-react';
import { authApi, type PublicRole } from '@/api/auth';
import { firstErrorMessage } from '@/api/errors';

const roleLabels: Record<PublicRole, string> = {
  kader: 'Kader Posyandu',
  nakes: 'Tenaga Kesehatan (Nakes)',
  viewer: 'Manajemen / Viewer'
};

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<PublicRole>('kader');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.register({ username, password, role });
      navigate('/', { replace: true });
    } catch (err) {
      const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
      setError(message ?? 'Gagal mendaftar. Periksa kembali data yang diisi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Sprout className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <h1 className="text-xl font-display font-semibold text-gray-900">Daftar Akun SmartGrowth</h1>
          <p className="text-sm text-gray-500">Untuk kader posyandu &amp; tenaga kesehatan</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="register-username" className="field-label">
              Username
            </label>
            <input
              id="register-username"
              className="field-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label htmlFor="register-password" className="field-label">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label htmlFor="register-role" className="field-label">
              Peran
            </label>
            <select
              id="register-role"
              className="field-input"
              value={role}
              onChange={(e) => setRole(e.target.value as PublicRole)}
            >
              {(Object.keys(roleLabels) as PublicRole[]).map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Memproses...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Daftar
              </>
            )}
          </button>
          <p className="text-sm text-gray-500 text-center">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Masuk
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
