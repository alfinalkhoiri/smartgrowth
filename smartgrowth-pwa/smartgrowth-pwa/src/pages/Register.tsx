import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Activity, Eye, Loader2, QrCode, UserPlus } from 'lucide-react';
import { authApi, type PublicRole } from '@/api/auth';
import { growthApi } from '@/api/growth';
import { firstErrorMessage, parseFieldErrors } from '@/api/errors';
import { FieldError } from '@/components/FieldError';

const roleLabels: Record<PublicRole, string> = {
  orangtua: 'Orang Tua',
  kader_nakes: 'Kader/Nakes'
};

export default function Register() {
  const [searchParams] = useSearchParams();
  // From the admin "Kode Posyandu" QR (?code=...&role=kader_nakes).
  const prefilledCode = searchParams.get('code') ?? '';
  // From a child's own "Bagikan ke Orang Tua" QR (?linkCode=...&role=
  // orangtua&viewToken=..., see LinkCodeCard.tsx) — scanning it lands on
  // the picker below instead of registering immediately, so a parent who
  // just wants to check results isn't forced to create an account.
  const prefilledLinkCode = searchParams.get('linkCode') ?? '';
  const viewToken = searchParams.get('viewToken') ?? '';

  // Only shown when there's actually a "just look" option to offer — if the
  // child has no public_token yet, viewToken is empty and this skips
  // straight to the registration form (mode stays 'form').
  const [mode, setMode] = useState<'choose' | 'form'>(prefilledLinkCode && viewToken ? 'choose' : 'form');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [posyanduLocation, setPosyanduLocation] = useState('');
  const [role, setRole] = useState<PublicRole>(prefilledCode ? 'kader_nakes' : 'orangtua');
  const [inviteCode, setInviteCode] = useState(prefilledCode);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  // True while an already-logged-in orangtua's linkCode QR scan is being
  // auto-redeemed (e.g. linking a second/third child) — skips the whole
  // registration form since they already have an account.
  const [autoLinking, setAutoLinking] = useState(Boolean(prefilledLinkCode) && authApi.isAuthenticated());
  const navigate = useNavigate();
  const inputClass = (field: string) => `field-input${fieldErrors[field] ? ' field-input-error' : ''}`;

  useEffect(() => {
    if (!autoLinking) return;
    growthApi
      .linkChild(prefilledLinkCode)
      .then((res) => navigate(`/child/${res.data.id}`, { replace: true }))
      .catch((err) => {
        const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
        setError(message ?? 'Gagal menautkan balita. Kode mungkin sudah tidak berlaku.');
        setAutoLinking(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLinking]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);
    try {
      await authApi.register({
        username,
        password,
        role,
        email: email || undefined,
        phoneNumber: phoneNumber || undefined,
        posyanduLocation: posyanduLocation || undefined,
        ...(role === 'kader_nakes' ? { inviteCode } : {})
      });
      if (role === 'orangtua' && prefilledLinkCode) {
        // Scanned a child's QR — link right away instead of sending them to
        // /tautkan-balita to type the same code in again.
        try {
          const res = await growthApi.linkChild(prefilledLinkCode);
          navigate(`/child/${res.data.id}`, { replace: true });
          return;
        } catch {
          // Registration itself succeeded — don't strand them on an error
          // page over just the link step. /tautkan-balita lets them retry
          // (or enter a different code) with an account that already exists.
          navigate('/tautkan-balita', { replace: true });
          return;
        }
      }
      // Orangtua tanpa QR (mis. buka /register langsung) belum tertaut ke
      // balita mana pun — arahkan ke halaman tautkan manual.
      navigate(role === 'orangtua' ? '/tautkan-balita' : '/', { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const fields = parseFieldErrors(err.response.data);
        setFieldErrors(fields);
        setError(
          Object.keys(fields).length > 0
            ? 'Periksa kembali data yang ditandai merah di bawah.'
            : firstErrorMessage(err.response.data) ?? 'Gagal mendaftar. Periksa kembali data yang diisi.'
        );
      } else {
        setError('Gagal mendaftar. Periksa kembali data yang diisi.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (autoLinking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Menautkan balita ke akun Anda...
        </div>
      </div>
    );
  }

  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-primary shadow-soft">
              <Activity className="h-6 w-6 text-white" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-display font-bold text-gray-900">SmartGrowth</h1>
            <p className="text-sm text-gray-500">Pilih salah satu untuk melanjutkan</p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate(`/p/${viewToken}`)}
              className="w-full text-left card p-4 space-y-1 hover:border-primary/40 border-2 border-transparent"
            >
              <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
                <Eye className="h-4 w-4 text-accent" aria-hidden="true" />
                Lihat Saja
              </p>
              <p className="text-xs text-gray-500">
                Lihat hasil pengukuran &amp; rekomendasi balita, tanpa perlu daftar akun.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode('form')}
              className="w-full text-left card p-4 space-y-1 hover:border-primary/40 border-2 border-transparent"
            >
              <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
                <UserPlus className="h-4 w-4 text-accent" aria-hidden="true" />
                Daftar &amp; Catat Mandiri
              </p>
              <p className="text-xs text-gray-500">
                Daftar akun supaya bisa mencatat pengukuran sendiri di rumah, di antara kunjungan Posyandu.
              </p>
            </button>
          </div>

          <p className="text-sm text-gray-500 text-center">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Masuk
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-primary shadow-soft">
            <Activity className="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-display font-bold text-gray-900">Daftar Akun SmartGrowth</h1>
          <p className="text-sm text-gray-500">
            {prefilledLinkCode ? 'Untuk orang tua/wali balita' : 'Untuk kader posyandu & tenaga kesehatan'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}
          {prefilledCode && (
            <p className="flex items-center gap-1.5 text-sm text-primary bg-primary-light/60 rounded-lg px-3 py-2">
              <QrCode className="h-4 w-4 shrink-0" aria-hidden="true" />
              Kode posyandu sudah terisi dari QR — tinggal lengkapi username &amp; password.
            </p>
          )}
          {prefilledLinkCode && (
            <p className="flex items-center gap-1.5 text-sm text-primary bg-primary-light/60 rounded-lg px-3 py-2">
              <QrCode className="h-4 w-4 shrink-0" aria-hidden="true" />
              Balita terdeteksi dari QR — lengkapi data di bawah, akun akan otomatis tertaut setelah daftar.
            </p>
          )}
          <div>
            <label htmlFor="register-username" className="field-label">
              Username
            </label>
            <input
              id="register-username"
              className={inputClass('username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="cth: kader_melati"
              required
            />
            <FieldError message={fieldErrors.username} />
          </div>
          <div>
            <label htmlFor="register-password" className="field-label">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              className={inputClass('password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
              required
            />
            <FieldError message={fieldErrors.password} />
          </div>
          <div>
            <label htmlFor="register-email" className="field-label">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              className={inputClass('email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="nama@email.com"
              required
            />
            <FieldError message={fieldErrors.email} />
          </div>
          <div>
            <label htmlFor="register-phone" className="field-label">
              No. HP
            </label>
            <input
              id="register-phone"
              type="tel"
              className={inputClass('phoneNumber')}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              autoComplete="tel"
              placeholder="08xxxxxxxxxx"
              required
            />
            <FieldError message={fieldErrors.phoneNumber} />
          </div>
          {role === 'kader_nakes' && (
            <div>
              <label htmlFor="register-posyandu-location" className="field-label">
                Lokasi Klinik/Posyandu
              </label>
              <input
                id="register-posyandu-location"
                className={inputClass('posyanduLocation')}
                value={posyanduLocation}
                onChange={(e) => setPosyanduLocation(e.target.value)}
                placeholder="cth: Posyandu Melati"
              />
              <FieldError message={fieldErrors.posyanduLocation} />
            </div>
          )}
          {prefilledLinkCode ? (
            <p className="text-xs text-gray-400">
              Mendaftar sebagai <span className="font-medium text-gray-600">Orang Tua</span> — otomatis tertaut ke
              balita di atas setelah daftar, langsung bisa mencatat pengukuran mandiri.
            </p>
          ) : (
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
              <p className="text-xs text-gray-400 mt-1">
                {role === 'orangtua'
                  ? 'Setelah daftar, tautkan akun ke balita Anda pakai kode/QR dari kader/nakes agar bisa mencatat pengukuran mandiri.'
                  : 'Bisa melihat & mencatat data semua balita di posyandu.'}
              </p>
            </div>
          )}
          {role === 'kader_nakes' && (
            <div>
              <label htmlFor="register-invite-code" className="field-label">
                Kode Posyandu
              </label>
              <input
                id="register-invite-code"
                className={inputClass('inviteCode')}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Minta ke koordinator posyandu Anda"
                required
              />
              <FieldError message={fieldErrors.inviteCode} />
              <p className="text-xs text-gray-400 mt-1">
                Peran Kader/Nakes bisa melihat data semua balita, jadi butuh kode ini agar tidak sembarang orang
                bisa mendaftar.
              </p>
            </div>
          )}
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
