import { useEffect, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';

// #/p/:token (HashRouter) — a public route outside RequireAuth, see App.tsx.
function publicDashboardLink(token: string): string {
  return `${window.location.origin}${window.location.pathname}#/p/${token}`;
}

interface Props {
  token: string;
  childName: string;
  // Only passed where regeneration makes sense (ChildDashboard) — omit to
  // hide the option, e.g. in the Skrining picker where it'd be one click
  // away from silently invalidating a QR someone already printed.
  onRegenerate?: () => void;
}

export function ParentDashboardQr({ token, childName, onRegenerate }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(publicDashboardLink(token), { margin: 1, width: 180 }).then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="card p-4 space-y-3">
      <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
        <Users className="h-4 w-4 text-accent" aria-hidden="true" />
        Bagikan ke Orang Tua
      </p>
      <p className="text-xs text-gray-500">
        Orang tua {childName} bisa scan QR ini untuk melihat hasil &amp; riwayat pengukuran kapan saja — tanpa perlu
        login atau daftar akun.
      </p>
      <div className="flex items-center gap-4">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR dashboard orang tua ${childName}`}
            className="h-28 w-28 rounded-lg border border-gray-100 shrink-0"
          />
        ) : (
          <div className="h-28 w-28 rounded-lg bg-gray-100 animate-pulse shrink-0" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs text-gray-400 truncate">{publicDashboardLink(token)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={publicDashboardLink(token)} label="Salin Link" />
            {onRegenerate && (
              <button type="button" onClick={onRegenerate} className="btn-ghost text-xs">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                QR Baru
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
