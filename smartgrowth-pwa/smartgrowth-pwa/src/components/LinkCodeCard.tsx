import { KeyRound, RefreshCw } from 'lucide-react';
import { CopyButton } from '@/components/CopyButton';

interface Props {
  code: string;
  childName: string;
  // Only passed where regeneration makes sense (ChildDashboard) — same
  // convention as ParentDashboardQr.tsx's onRegenerate.
  onRegenerate?: () => void;
}

// Kader/nakes-facing counterpart to ParentDashboardQr.tsx: that one is the
// no-login Fase 2 QR (read-only, no account needed); this is the plain
// 6-digit Child.link_code an orangtua redeems once (POST /children/link/)
// to attach their own account to this child, so they can also record
// pengukuran mandiri for it — not just view it.
export function LinkCodeCard({ code, childName, onRegenerate }: Props) {
  return (
    <div className="card p-4 space-y-3">
      <p className="flex items-center gap-1.5 font-display font-bold text-gray-900">
        <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
        Kode Tautan Akun Orang Tua
      </p>
      <p className="text-xs text-gray-500">
        Berikan kode ini ke orang tua {childName} agar akun mereka bisa melihat &amp; mencatat pengukuran mandiri
        balita ini (daftar/masuk dulu, lalu tautkan lewat menu &ldquo;Tautkan Balita&rdquo;).
      </p>
      <div className="flex items-center gap-2">
        <p className="flex-1 font-mono text-lg font-bold tracking-wider text-gray-900 bg-primary-light/60 rounded-lg px-3 py-2 text-center">
          {code}
        </p>
        <CopyButton value={code} label="Salin Kode" />
        {onRegenerate && (
          <button type="button" onClick={onRegenerate} className="btn-ghost text-xs shrink-0">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Kode Baru
          </button>
        )}
      </div>
    </div>
  );
}
