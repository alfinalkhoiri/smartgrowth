import { useEffect, useState } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';

// #/register?linkCode=...&role=orangtua (HashRouter) — scanning this both
// registers a new orangtua account AND links it to this child in one step
// (see Register.tsx's autoLinking/prefilledLinkCode handling), instead of
// registering then separately visiting /tautkan-balita to type the code by
// hand. Same deep-link-QR pattern as KodePosyandu.tsx's kader_nakes invite.
function registrationLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/register?linkCode=${code}&role=orangtua`;
}

interface Props {
  code: string;
  childName: string;
  // Only passed where regeneration makes sense (ChildDashboard) — same
  // convention as ParentDashboardQr.tsx's onRegenerate.
  onRegenerate?: () => void;
}

// Kader/nakes-facing counterpart to ParentDashboardQr.tsx: that one is the
// no-login Fase 2 QR (read-only, no account needed); this is the plain
// 6-digit Child.link_code an orangtua redeems (POST /children/link/) to
// attach their own account to this child, so they can also record
// pengukuran mandiri for it — not just view it.
export function LinkCodeCard({ code, childName, onRegenerate }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(registrationLink(code), { margin: 1, width: 180 }).then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
    );
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="card p-4 space-y-3">
      <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
        <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
        Tautkan Akun Orang Tua
      </p>
      <p className="text-xs text-gray-500">
        Orang tua {childName} scan QR ini untuk langsung daftar akun &amp; tertaut ke balita ini sekaligus — bisa
        langsung mencatat pengukuran mandiri, tanpa perlu masukkan kode manual.
      </p>
      <div className="flex items-center gap-4">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR tautan akun orang tua ${childName}`}
            className="h-28 w-28 rounded-lg border border-gray-100 shrink-0"
          />
        ) : (
          <div className="h-28 w-28 rounded-lg bg-gray-100 animate-pulse shrink-0" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs text-gray-400">
            Atau minta orang tua ketik manual kode ini di menu &ldquo;Tautkan Balita&rdquo;:
          </p>
          <p className="font-mono text-base font-bold tracking-wider text-gray-900 bg-primary-light/60 rounded-lg px-3 py-1.5 text-center">
            {code}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={code} label="Salin Kode" />
            {onRegenerate && (
              <button type="button" onClick={onRegenerate} className="btn-ghost text-xs">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Kode Baru
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
