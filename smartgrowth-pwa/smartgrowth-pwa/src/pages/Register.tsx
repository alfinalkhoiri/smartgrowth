import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
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
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Daftar Akun SmartGrowth</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <label className="block text-sm text-gray-600 mb-1">Username</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Password</label>
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Peran</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
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
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-700 text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {loading ? 'Memproses...' : 'Daftar'}
        </button>
        <p className="text-sm text-gray-500 text-center">
          Sudah punya akun?{' '}
          <Link to="/login" className="text-teal-700 font-medium">
            Masuk
          </Link>
        </p>
      </form>
    </div>
  );
}
