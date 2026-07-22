import { useEffect, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';

// #/register?linkCode=...&role=orangtua&viewToken=... (HashRouter) — the
// ONE QR shown to parents. Scanning it lands on Register.tsx, which offers
// a choice (see its "picker" mode): "Lihat Saja" jumps straight to the
// read-only #/p/:token dashboard, no account; "Daftar" registers a new
// orangtua account and links it to this child in a single submit, landing
// on the child's own (fuller) dashboard — already-registered parents (e.g.
// scanning a sibling's QR) skip the picker/form entirely and just get
// linked. Same deep-link-QR pattern as KodePosyandu.tsx's kader_nakes
// invite. `viewToken` is omitted from the URL if publicToken isn't set
// (Register.tsx just won't offer the "Lihat Saja" option in that case).
function registrationLink(code: string, publicToken?: string): string {
  const base = `${window.location.origin}${window.location.pathname}#/register?linkCode=${code}&role=orangtua`;
  return publicToken ? `${base}&viewToken=${publicToken}` : base;
}

interface Props {
  code: string;
  childName: string;
  // Embedded into the QR so Register.tsx can offer "Lihat Saja" (no
  // account) alongside "Daftar" — omitted from the QR link if the child has
  // no public_token yet.
  publicToken?: string;
  // Only passed where regeneration makes sense (ChildDashboard).
  onRegenerate?: () => void;
}

export function LinkCodeCard({ code, childName, publicToken, onRegenerate }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const link = registrationLink(code, publicToken);

  useEffect(() => {
    let cancelled = false;
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(link, { margin: 1, width: 180 }).then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, publicToken]);

  return (
    <div className="card p-4 space-y-3">
      <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
        <Users className="h-4 w-4 text-accent" aria-hidden="true" />
        Bagikan ke Orang Tua
      </p>
      <p className="text-xs text-gray-500">
        Orang tua {childName} scan QR ini, lalu bisa pilih: lihat saja hasil &amp; rekomendasi tanpa daftar, atau
        daftar akun sekalian supaya bisa mencatat pengukuran mandiri sendiri.
      </p>
      <div className="flex items-center gap-4">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR daftar & dashboard orang tua ${childName}`}
            className="h-28 w-28 rounded-lg border border-gray-100 shrink-0"
          />
        ) : (
          <div className="h-28 w-28 rounded-lg bg-gray-100 animate-pulse shrink-0" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs text-gray-400 truncate" title={link}>
            {link}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={link} label="Salin Link" />
          </div>
        </div>
      </div>
      <div className="space-y-2 border-t border-gray-100 pt-3">
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
  );
}
