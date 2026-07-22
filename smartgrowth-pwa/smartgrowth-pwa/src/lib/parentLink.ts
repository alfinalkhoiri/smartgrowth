// #/register?linkCode=...&role=orangtua&viewToken=... (HashRouter) — the
// ONE link/QR shown to parents, everywhere it's shown (ChildDashboard's
// LinkCodeCard.tsx and the printed A5 report's QR, lib/pdf.ts). Scanning or
// opening it lands on Register.tsx, which offers a choice: "Lihat Saja"
// jumps straight to the read-only #/p/:token dashboard, no account;
// "Daftar & Catat Mandiri" registers a new orangtua account and links it to
// this child in a single submit. Already-authenticated visitors (e.g. an
// existing parent scanning a second child's QR) skip straight to linking.
// `viewToken` is omitted if the child has no public_token yet — Register.tsx
// then skips the "Lihat Saja" option and goes straight to the form.
// Centralized here (rather than duplicated in each caller) because this URL
// shape has already changed more than once — one place to keep in sync.
export function registrationLink(linkCode: string, publicToken?: string): string {
  const base = `${window.location.origin}${window.location.pathname}#/register?linkCode=${linkCode}&role=orangtua`;
  return publicToken ? `${base}&viewToken=${publicToken}` : base;
}
