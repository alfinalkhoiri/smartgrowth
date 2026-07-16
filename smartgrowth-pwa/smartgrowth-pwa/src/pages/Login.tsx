import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, LogIn, Sprout } from 'lucide-react';
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
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Sprout className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <h1 className="text-xl font-semibold text-gray-900">Masuk SmartGrowth</h1>
          <p className="text-sm text-gray-500">Deteksi dini risiko stunting &amp; wasting balita</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="login-username" className="field-label">
              Username
            </label>
            <input
              id="login-username"
              className="field-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label htmlFor="login-password" className="field-label">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Memproses...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Masuk
              </>
            )}
          </button>
          <p className="text-sm text-gray-500 text-center">
            Belum punya akun?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Daftar
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
