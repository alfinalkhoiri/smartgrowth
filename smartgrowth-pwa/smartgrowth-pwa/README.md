# SmartGrowth PWA

React + TypeScript + Vite PWA scaffold for the SmartGrowth telescreening app.
Structured so it can be wrapped into a native app with **Capacitor** later
without rewriting the UI.

## Structure

```
src/
  api/             # axios client + endpoint calls (talks to the Django backend)
    growth.ts      # children/growth-records/reference; auto-switches to
                    # multipart when a photo File is included in a payload
    schedule.ts    # posyandu-schedules CRUD
  features/growth/
    zscore.ts      # riskLabel()/riskDescription() — label/copy helpers only;
                    # actual HAZ/WHZ/WAZ/HCZ classification is 100%
                    # backend-side (score_risk() in risk_engine.py)
    store.ts       # Zustand store, offline-first state
  components/       # AppLayout (nav + disclaimer footer), GrowthChart,
                    # RiskBadge (4-tier), Toggle (switch input), etc.
  lib/
    dates.ts        # monthsBetween()
    pdf.ts          # jsPDF/jsPDF-autotable report generator — A5, Buku KIA
                    # sized, compact summary + QR (see "Laporan PDF" below),
                    # lazy-loaded via dynamic import (see ChildDashboard.tsx)
                    # so the ~450KB gzipped library isn't in the main bundle
                    # — exports generateChildReport() (download) and
                    # printChildReport() (print)
  pages/            # Dashboard (Beranda), Skrining, ChildrenList (Data
                    # Balita), ChildDashboard, Riwayat, Edukasi, Jadwal,
                    # Login, Register, Setting + UserList + KodePosyandu
                    # (admin-only, under /admin/setting/*), PublicChildView
                    # (no-login parent dashboard, #/p/:token) — RequireAuth +
                    # AppLayout wrap every route except /login, /register,
                    # and /p/:token (see App.tsx)
  types/            # shared TS types (Child, GrowthRecord, RiskAssessment,
                    # PosyanduSchedule, GrowthReference)
vite.config.ts      # vite-plugin-pwa: manifest + offline caching rules
                    # (NetworkFirst for children/growth-records/posyandu-
                    # schedules) + navigateFallback (app-shell for offline
                    # SPA routes), dev/preview proxy to Django, and the
                    # "@/*" alias (must mirror tsconfig.json's "paths" — tsc
                    # only type-checks aliases, it doesn't make Vite resolve
                    # them at runtime)
```

## Why this is "Capacitor-ready"

1. **`base: './'`** in `vite.config.ts` — asset paths stay relative, which is
   required inside a Capacitor WebView (no absolute domain root like a real browser).
2. **`HashRouter`, not `BrowserRouter`** (`src/App.tsx`) — with a relative
   `base`, a real navigation/reload on a nested route like `/child/:id` would
   resolve the cached `index.html`'s relative asset paths against `/child/`
   instead of `/`, 404ing every asset (verified this failure with Playwright
   before switching routers). Every route living under one `#` fragment
   avoids that, and is Capacitor's own recommended pattern for exactly this
   reason.
3. **API base URL is env-driven** (`VITE_API_BASE_URL`), not hardcoded to `/api`,
   because a native WebView has no dev-server proxy to fall back on.
4. **All state/data logic lives in `api/` and `features/`, separate from UI** —
   if you ever *do* need to rewrite the UI in React Native, this layer moves over
   almost unchanged.
5. **Offline caching is verified working**, not just configured — Workbox
   `runtimeCaching` (NetworkFirst for growth records/children/posyandu-
   schedules — every page-load API call needs its own rule, or offline
   `Promise.all()`s reject and blank out data that would otherwise still be
   cached) plus `navigateFallback` for the app shell. Tested end-to-end with
   Playwright against a production build (`npm run build && npm run
   preview`): log in, browse Beranda/a child dashboard/Jadwal, go offline,
   reload each URL — data still renders from cache, including generating a
   PDF report (the lazy-loaded chunk is still precached even though it isn't
   in the initial bundle). (`npm run dev` does **not** register the service
   worker at all — `devOptions.enabled` isn't set — so this can only be
   verified against a real build, not the dev server.)

## Local development

Requires **Node.js 18+** (Vite 5 doesn't run on Node 16 or older — fails at
startup with `crypto.getRandomValues is not a function`). Verified working
on Node 24 LTS.

```bash
npm install
npm run dev
```

Vite proxies `/api/*` to `http://localhost:8000` in dev (see `vite.config.ts`
→ `server.proxy`), so the Django backend must be running on port 8000 first.
Override the proxy target with the `VITE_PROXY_TARGET` env var if the backend
runs elsewhere.

## Building for web (PWA)

```bash
npm run build
npm run preview   # serves dist/ at :4173, proxies /api like the dev server —
                   # this is the only way to test the actual service worker
                   # locally, since `npm run dev` doesn't register one
# output in dist/, deployable to any static host (installable, offline-capable)
```

## Upgrading to a native app later (Capacitor)

When you're ready to produce an installable APK/IPA for a competition demo:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init smartgrowth id.ac.presuniv.smartgrowth
npm run build
npx cap add android   # and/or: npx cap add ios
npx cap sync
npx cap open android  # opens Android Studio to build the APK
```

No UI code changes needed for this step — only `capacitor.config.ts` gets added,
and `VITE_API_BASE_URL` must point to your deployed backend (not localhost).

## Auth

`Login.tsx` and `Register.tsx` call `/api/auth/login` and `/api/auth/register`
respectively; both store the returned JWT in `localStorage` and redirect into
the app (`src/api/auth.ts`). Registration is public but only for
**kader_nakes** — `Register.tsx` no longer offers an "Orang Tua" role option
at all (the role selector was removed entirely; the payload always sends
`role: 'kader_nakes'`), and the `inviteCode` field (matching the backend's
`RegistrationInviteCode`, managed on the Setting → Kode Posyandu page) is
always shown and required, not conditional on a role pick anymore. Username,
password, email, and phone number all have placeholders and `required` on
the `<input>` (browser-level validation, not just server-side); email/phone
are enforced server-side too (`RegisterSerializer`), while the optional
"Lokasi Klinik/Posyandu" field (`posyanduLocation`) isn't. The `orangtua`
role still exists server-side (`PUBLIC_ROLE_CHOICES` in the backend still
lists it) but nothing in the UI creates one anymore — parents use the
no-login QR flow below instead. Admin accounts aren't publicly
self-serviceable. `authApi.canCreate()`/`canEditDelete()` are both true for
kader_nakes/admin and both false for orangtua — there's no longer a
create-vs-edit split like the old kader/nakes roles had. `RequireAuth` in
`App.tsx` guards every other route and redirects to `/login`; `client.ts`'s
response interceptor does the same on a 401 (expired token).

**Superseded by Fase 2** (below) as the primary parent-facing flow — the
login+redeem-code UI described above was never built, since it turned out
parents just needed a link, not an account. The role/permission plumbing
above is still live and unaffected; it's just not the path a parent
actually takes anymore.

### Fase 2: dashboard orang tua tanpa login

`pages/PublicChildView.tsx`, mounted at the public route `#/p/:token` in
`App.tsx` — deliberately **outside** the `RequireAuth` wrapper, since the
whole point is no login. Fetches `GET /api/public/children/<token>/`
(`api/public.ts`) — an unauthenticated backend endpoint, so this page has no
nav bar, no login/logout, just the same **`DetailTabs`** (Hasil
Pengukuran / Rekomendasi / Edukasi) shown on `ChildDashboard.tsx`, driven by
the latest measurement's data: the "Hasil" tab has the latest result
(`RiskBadge` + weight/height), two `GrowthChart` instances (`metric="height"`
and `metric="weight"`, shown as soon as there's **1+** record — the gate used
to require 2+, changed once single-measurement children were found to render
no chart at all) plus the read-only measurement history list;
"Rekomendasi" renders `RecommendationsPanel` — one card with the latest
measurement's date/weight/height/HAZ/WHZ/WAZ (plus officer name/posyandu
location, but **only** when rendered from `ChildDashboard.tsx`; this page's
`PublicGrowthRecord` doesn't carry those fields, so that line just doesn't
appear here — see the backend README's privacy note on
`PublicGrowthRecordSerializer`), then a "Dari Kuesioner" subsection that
**always** renders — either the specific recommendations or, if none were
flagged, a "tidak ada faktor risiko tambahan" confirmation, so it never
looks like the questionnaire silently did nothing — and a "Catatan Petugas"
block when `notes` is present. "Edukasi" renders `EducationTips` (tips +
concrete food/drink examples from `lib/nutritionTips.ts`, keyed off risk
status). A 404 renders as "Link tidak valid atau sudah tidak berlaku" rather
than any kind of login prompt.

`GrowthChart.tsx` takes a `metric: 'height' | 'weight'` prop and a
structurally-typed `{ ageMonths, heightCm, weightKg }[]` records array (not
the full `GrowthRecord`) — the latter is why this page's slimmer
`PublicGrowthRecord[]` satisfies it too, without needing a second chart
component; the former is why both dashboards render it twice instead of one
combined multi-line chart.

The QR itself is `components/ParentDashboardQr.tsx` — takes just
`token` + `childName`, lazy-loads the `qrcode` package (dynamic `import()`,
not in the main bundle, same pattern as `jspdf`/`lib/pdf.ts`) and renders
a data-URL `<img>` of `.../#/p/<token>`, plus a copy-link button
(`components/CopyButton.tsx`, also shared with `KodePosyandu.tsx`). It's
mounted in two places: `Skrining.tsx` (once an existing child is selected
in "Balita Terdaftar" mode) and `ChildDashboard.tsx` (always, as a
"Bagikan ke Orang Tua" card — this one also gets an `onRegenerate` handler,
since invalidating a QR that's already been shown/printed only makes sense
from the child's own page, not mid-pick in the Skrining flow). Both buttons
inside `ParentDashboardQr` are explicitly `type="button"` — the Skrining
instance sits inside a `<form>`, and without that they'd submit it.

The old Fase 1 login-based flow (role `orangtua`, `LinkChildView`) is
untouched and still works if anyone registers that way — it's just no
longer the flow either the UI or a fresh parent would actually go through.

### Setting menu (admin-only)

`pages/Setting.tsx` is the one nav item `AppLayout.tsx` only renders when
`authApi.isAdmin()` — a small menu page (two linked cards) rather than a
dropdown, since this app has no submenu/dropdown nav pattern yet. It links
to two sub-pages, both still gated by `authApi.isAdmin()` themselves (not
just hidden from nav):

- **`pages/UserList.tsx`** (`/admin/setting/users`) — fetches
  `GET /api/auth/users` (`authApi.listUsers()`) and renders every registered
  account in a table (username, role badge, email, phone, posyandu/clinic
  location, join date). Each row has a delete button (`authApi.deleteUser()`
  → `DELETE /api/auth/users/<id>`, `window.confirm`'d first) **except** the
  row matching the logged-in admin's own `user_id` (decoded from the JWT —
  SimpleJWT's default claim, not one `RoleTokenObtainPairSerializer` adds
  itself) — the backend also rejects self-deletion with a 400, this is just
  the UI not offering a button that would always fail anyway. No edit action,
  since none was asked for.
- **`pages/KodePosyandu.tsx`** (`/admin/setting/kode-posyandu`, moved from
  the old standalone `/admin/kode-posyandu`) — shows the current
  kader_nakes registration code as text (with a copy button) and as a QR
  (generated client-side, `qrcode` lazy-loaded via dynamic `import()` so
  it's not in the main bundle) encoding a direct link to
  `/#/register?code=...&role=kader_nakes` — `Register.tsx` reads those two
  query params via `useSearchParams()` (works fine under `HashRouter`, since
  everything after `#/register` is a normal path+query to react-router) and
  prefills the invite-code field, so scanning the QR is a one-step flow
  instead of typing an 8-character code by hand. "Buat Kode Baru" immediately
  invalidates the old code/QR — confirmed via `window.confirm` before
  calling it, since anyone who hasn't registered yet with the old QR would
  need a reprint.

## Laporan PDF (unduh & cetak)

`lib/pdf.ts` builds one jsPDF doc (`buildChildReportDoc()`) shared by two
entry points:

- **`generateChildReport()`** — `doc.save(...)`, triggered by "Unduh Laporan
  PDF" in `ChildDashboard.tsx`.
- **`printChildReport()`** — triggers the browser's native print dialog for
  the same report, from the "Cetak Laporan" button next to it. This does
  **not** `window.open()` a new tab — an earlier version did, and it turned
  out to fail silently in real testing: building the doc needs a few awaits
  (dynamic imports + the QR fetch), and by the time `window.open()` would
  run, the browser had often already dropped the click's "user activation",
  so the popup opened but a *later* navigation to the blob PDF URL inside it
  got silently blocked (no error, just a permanently blank tab). The fix was
  a hidden same-page `<iframe>` instead: set its `src` to the blob URL, wait
  for `onload`, then call `.contentWindow.print()` — no new-tab/popup
  machinery involved at all, so there's no activation window to lose.

The page itself is **A5** (`new jsPDF({ format: 'a5' })`, 148×210mm) — the
same trim size as Buku KIA, so it can physically live alongside it instead
of being a loose A4 sheet nobody keeps. Content is deliberately a compact
snapshot, not the full record: branded header band, child profile line, a
colored risk status callout (same 4-tier palette as `RiskBadge.tsx`), the
latest measurement's weight/height/Z-score/officer summary, a short history
table (last 5 measurements only, with a "riwayat lengkap ada di web" note
if there are more), and — when `child.publicToken` is set — a large QR
call-to-action box encoding the same `#/p/:token` link as
`ParentDashboardQr.tsx`, framed as "Detail Lengkap & Rekomendasi di Web".
The full recommendation list, officer notes, nutrition tips, and food
examples are deliberately **not** printed — they only live on the web
dashboard behind that QR, so parents have a reason to actually open the
link instead of the print being a complete (and instantly stale) substitute
for it.

## Design system

Palette/typography match the original Lovable prototype design this app was
later aligned to (verified against its live preview's computed CSS via
Playwright, not eyeballed from screenshots) — green primary (`#259d65`, from
HSL `152 62% 38%`) + blue accent (`#119ad4`, from HSL `198 85% 45%`), a
3-stop `bg-gradient-hero` used on the Beranda hero banner, Poppins for
headings (`font-display`, extrabold/bold weights) + Plus Jakarta Sans for
body text. Tokens live in `tailwind.config.js` (`colors.primary` /
`colors.accent` / `backgroundImage.gradient-hero` / `boxShadow.card` etc.)
and shared component classes (`.field-input`, `.btn-primary`,
`.btn-secondary`, `.btn-ghost`, `.card`) in `src/index.css` under
`@layer components` — reuse those instead of one-off utility strings on new
pages. `AppLayout.tsx` also carries a permanent disclaimer footer bar
present on every authenticated page.

Baseline accessibility rules followed throughout: 44×44px minimum touch
targets, visible `:focus-visible` rings, `prefers-reduced-motion` respected,
no emoji-as-icon (SVG only, via `lucide-react`), and risk status is never
color-only — every `RiskBadge` and history-row status dot pairs an
icon/color together (4 tiers: normal/berisiko/stunting/malnutrisi, see
`RiskBadge.tsx`).

## Risk classification

All HAZ/WHZ/WAZ/HCZ Z-score math and the weighted 0-100 `score_risk()`
classification happen **entirely backend-side**
(`apps/growth/services/risk_engine.py`) — the frontend never computes a
status itself. `src/features/growth/zscore.ts` only holds
`riskLabel()`/`riskDescription()` copy helpers keyed off the `riskStatus`
string the API already returns. Stage 2 (an ML layer on top of this
rule-based baseline) is intentionally not started yet — see the backend
README's TODO section.
