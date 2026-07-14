import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.login(username, password);
      navigate('/', { replace: true });
    } catch {
      setError('Username atau password salah.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Masuk SmartGrowth</h1>
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
            autoComplete="current-password"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-700 text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {loading ? 'Memproses...' : 'Masuk'}
        </button>
        <p className="text-sm text-gray-500 text-center">
          Belum punya akun?{' '}
          <Link to="/register" className="text-teal-700 font-medium">
            Daftar
          </Link>
        </p>
      </form>
    </div>
  );
}
