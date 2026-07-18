import { useEffect, useState } from 'react';
import axios from 'axios';
import { Check, Copy, KeyRound, Loader2, QrCode, RefreshCw } from 'lucide-react';
import { authApi, type InviteCodeInfo } from '@/api/auth';
import { firstErrorMessage } from '@/api/errors';

// #/register (HashRouter) so the link opens straight into the app's own
// registration route, not a server-side one — react-router reads the query
// string from the part after the '#' just like a normal path.
function registrationLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/register?code=${code}&role=kader_nakes`;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button onClick={handleCopy} className="btn-secondary">
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? 'Tersalin' : label}
    </button>
  );
}

export default function KodePosyandu() {
  const isAdmin = authApi.isAdmin();
  const [info, setInfo] = useState<InviteCodeInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');

  const loadQr = async (code: string) => {
    const { default: QRCode } = await import('qrcode');
    setQrDataUrl(await QRCode.toDataURL(registrationLink(code), { margin: 1, width: 240 }));
  };

  useEffect(() => {
    if (!isAdmin) return;
    authApi
      .getInviteCode()
      .then((res) => {
        setInfo(res.data);
        return loadQr(res.data.code);
      })
      .catch((err) => {
        const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
        setError(message ?? 'Gagal memuat kode posyandu.');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleRegenerate = async () => {
    if (
      !window.confirm(
        'Yakin ingin membuat kode baru? Kode & QR yang lama langsung tidak berlaku — pastikan kader/nakes yang belum mendaftar sudah dapat kode/QR baru.'
      )
    )
      return;
    setRegenerating(true);
    setError('');
    try {
      const res = await authApi.regenerateInviteCode();
      setInfo(res.data);
      await loadQr(res.data.code);
    } catch (err) {
      const message = axios.isAxiosError(err) ? firstErrorMessage(err.response?.data) : null;
      setError(message ?? 'Gagal membuat kode baru.');
    } finally {
      setRegenerating(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <p className="text-sm text-gray-500">Halaman ini khusus untuk peran Admin.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="flex items-center gap-2 font-display font-extrabold text-2xl text-gray-900">
          <KeyRound className="h-6 w-6 text-primary" aria-hidden="true" />
          Kode Posyandu
        </h1>
        <p className="text-sm text-gray-500">
          Kode yang dibutuhkan untuk mendaftar sebagai Kader/Nakes — sebarkan hanya ke petugas posyandu yang sah.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-gray-400 text-sm py-10">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Memuat...
        </div>
      ) : (
        info && (
          <div className="card p-6 space-y-5">
            <div className="flex flex-col items-center gap-3">
              {qrDataUrl && (
                <img src={qrDataUrl} alt="QR pendaftaran Kader/Nakes" className="rounded-lg border border-gray-100" />
              )}
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                Scan untuk langsung membuka halaman Daftar dengan kode terisi otomatis
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="field-label">Kode</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 font-mono text-lg font-bold tracking-wider text-gray-900 bg-primary-light/60 rounded-lg px-3 py-2">
                  {info.code}
                </p>
                <CopyButton value={info.code} label="Salin Kode" />
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="field-label">Link pendaftaran langsung</p>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-xs text-gray-500 truncate bg-gray-50 rounded-lg px-3 py-2">
                  {registrationLink(info.code)}
                </p>
                <CopyButton value={registrationLink(info.code)} label="Salin Link" />
              </div>
            </div>

            <p className="text-xs text-gray-400">
              {info.updatedBy
                ? `Terakhir diubah oleh ${info.updatedBy} pada ${new Date(info.updatedAt).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}`
                : 'Belum pernah diganti manual sejak sistem pertama kali dipasang.'}
            </p>

            <button onClick={handleRegenerate} disabled={regenerating} className="btn-ghost-danger w-full">
              {regenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Membuat kode baru...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Buat Kode Baru (kode lama langsung tidak berlaku)
                </>
              )}
            </button>
          </div>
        )
      )}
    </div>
  );
}
