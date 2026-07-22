# SmartGrowth PWA

React + TypeScript + Vite PWA for the SmartGrowth telescreening app —
also ships as a native Android app via **Capacitor** (`android/`, see
"Native Android app" below), same UI/code, no rewrite.

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
    parentLink.ts   # registrationLink(linkCode, publicToken?) — the single
                    # #/register?linkCode=...&viewToken=... URL shared by
                    # LinkCodeCard.tsx's QR and the printed PDF's QR, so the
                    # two can't drift into encoding different links
    pdf.ts          # jsPDF/jsPDF-autotable report generator — A5, Buku KIA
                    # sized, compact summary + QR (see "Laporan PDF" below),
                    # lazy-loaded via dynamic import (see ChildDashboard.tsx)
                    # so the ~450KB gzipped library isn't in the main bundle
                    # — exports generateChildReport() (download) and
                    # printChildReport() (print)
  pages/            # Dashboard (Beranda), Skrining, ChildrenList (Data
                    # Balita), ChildDashboard, Riwayat, Edukasi, Jadwal,
                    # Login, Register, Setting + UserList + KodePosyandu
                    # (admin-only, under /admin/setting/*), LinkChild +
                    # PengukuranMandiri (orangtua-only, "pengukuran mandiri"
                    # — see Auth section), PublicChildView (no-login parent
                    # dashboard, #/p/:token) — RequireAuth + AppLayout wrap
                    # every route except /login, /register, and /p/:token
                    # (see App.tsx)
  types/            # shared TS types (Child, GrowthRecord, RiskAssessment,
                    # PosyanduSchedule, GrowthReference)
vite.config.ts      # vite-plugin-pwa: manifest + offline caching rules
                    # (NetworkFirst for children/growth-records/posyandu-
                    # schedules) + navigateFallback (app-shell for offline
                    # SPA routes), injectRegister: false (see main.tsx below
                    # for why), dev/preview proxy to Django, and the "@/*"
                    # alias (must mirror tsconfig.json's "paths" — tsc only
                    # type-checks aliases, it doesn't make Vite resolve them
                    # at runtime)
```

**Service worker registration** (`main.tsx`) registers via `virtual:pwa-
register`'s `registerSW()` rather than letting the plugin auto-inject its
own `<script>` (`injectRegister: false` in `vite.config.ts`) — the default
injected script turns out to be a bare `serviceWorker.register()` call with
no update-checking or reload logic at all, regardless of `registerType:
'autoUpdate'`. Discovered the hard way: a deploy went out, was verified
correct server-side, but a tab left open from before the deploy kept
rendering the old UI — the normal kader/nakes usage pattern (app open all
day at posyandu) means a tab can sit for hours without a navigation event
ever triggering an update check. `registerSW({ immediate: true, ... })`
reloads the tab once a new service worker takes over, plus an hourly
`registration.update()` call (`setInterval`) so a long-lived open tab
notices a deploy without needing to navigate anywhere first.

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
   because a native WebView has no dev-server proxy to fall back on — this is
   exactly what `.env.capacitor` sets for the real Android build now (see
   "Native Android app" below), not just a hypothetical.
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

## Native Android app (Capacitor)

Set up and committed — `android/` is a real, buildable Android Studio
project, not just scaffolding notes. What's in place:

- **`capacitor.config.ts`** — `appId: 'com.smartgrowth.app'`, `webDir: 'dist'`,
  no `server.url` (deliberately — the built `dist/` assets are bundled into
  the app itself, Capacitor's default, rather than loading a remote page, so
  the app shell works offline the same way the PWA already does).
- **`.env.capacitor`** — sets `VITE_API_BASE_URL=https://smartgrowth.f-mc.my.id/api`
  for native builds only (checked into git; it's a public URL, not a
  secret). The regular web build never reads this file — it still resolves
  the relative `/api` default in `src/api/client.ts` against nginx.
- **`npm run build:capacitor`** — `tsc -b && vite build --mode capacitor`,
  i.e. the normal build but loading `.env.capacitor` instead of
  `.env`/`.env.production`.
- **`npm run cap:sync`** — `build:capacitor` then `npx cap sync`, i.e. "get
  the native project's bundled assets up to date with the latest code".
- **Backend CORS**: `CORS_ALLOWED_ORIGINS` on the VPS now also includes
  `https://localhost` — Capacitor's Android WebView serves local assets from
  that origin by default (`androidScheme`), so the API needs to allow-list
  it same as the deployed frontend's own origin (see backend README's
  `.env.example` for the annotated production block).

To actually build/run the APK you need the Android SDK + Gradle toolchain
somewhere. Two ways to get one, no Android Studio required for either if you
just want a debug .apk to sideload onto your own phone:

**Option A — GitHub Actions (`.github/workflows/android-build.yml`)**: builds
`assembleDebug` in the cloud on GitHub's own runner, no local Android SDK at
all. Trigger it manually from the repo's **Actions tab → "Build Android
APK" → Run workflow** (or `gh workflow run android-build.yml` with the
GitHub CLI), wait for it to finish, then download the `smartgrowth-debug-apk`
artifact from the completed run — that's the installable file. Copy it to
the phone (email/Drive/USB/whatever) and open it; Android will prompt to
allow installing from that source the first time. It's `workflow_dispatch`-
only (not on every push) since Android builds cost real CI minutes and
nothing is published anywhere yet — add a `push:` trigger later if you want
it automatic.

**Option B — Android Studio locally**, if you have it installed (also the
only option once you need to actually *develop/debug* the native side, not
just produce a build):

```bash
npm run cap:sync        # rebuilds dist/ (capacitor mode) and copies it into android/
npm run cap:open:android  # opens the project in Android Studio
# From Android Studio: Build > Build Bundle(s) / APK(s), or just Run ▶ on a
# connected device/emulator.
```

Either way, re-run the sync (`npm run cap:sync`, or re-trigger the Actions
workflow) after every code change you want reflected in the app — unlike
the web deploy, there's no service worker auto-update story here; the
native build only picks up whatever was in `dist/` the last time `cap sync`
ran.

**Not yet done** (left for whoever actually builds/ships this): custom app
icon/splash screen (still Capacitor's default placeholders — generating
proper multi-density Android icons is a separate task, e.g. via
`@capacitor/assets`), release signing config (`android/app/build.gradle`'s
`signingConfigs`, needed before a Play Store upload), and a native
`Camera`/`Filesystem` plugin if the photo-upload field in `Skrining.tsx`
ever needs a nicer in-app camera experience than the plain HTML
`<input type="file">` it uses today (which does already work via the OS's
own picker/camera chooser without any native plugin).

## Auth

`Login.tsx` and `Register.tsx` call `/api/auth/login` and `/api/auth/register`
respectively; both store the returned JWT in `localStorage` and redirect into
the app (`src/api/auth.ts`). Registration is public for both **kader_nakes**
and **orangtua** — `Register.tsx` has a `role` `<select>` (defaults to
`orangtua`, or `kader_nakes` if arriving via the "Kode Posyandu" QR deep link
with `?code=...&role=kader_nakes`), and the `inviteCode` field (matching the
backend's `RegistrationInviteCode`, managed on the Setting → Kode Posyandu
page) only shows/is-required when `role === 'kader_nakes'` — orangtua
registration needs no code at all (blast radius is small: a fresh orangtua
account sees nothing until linked to a child). Username, password, email,
and phone number all have placeholders and `required` on the `<input>`
(browser-level validation, not just server-side); email/phone are enforced
server-side too (`RegisterSerializer`), while the optional "Lokasi
Klinik/Posyandu" field (`posyanduLocation`) isn't. A successful orangtua
registration redirects to `/tautkan-balita` instead of `/` — a fresh
orangtua account has no linked child yet, so Beranda would just be empty.
Admin accounts aren't publicly self-serviceable.

`authApi.canCreate()`/`canEditDelete()` are both true for kader_nakes/admin
and both false for orangtua — those still gate the *full* Skrining.tsx flow
(new child, edit/delete any record) exactly as before. A separate
`authApi.canSelfMeasure()` (true only for orangtua) gates the narrower
"pengukuran mandiri" capability described below — deliberately not folded
into `canCreate()`, since an orangtua who can create a *measurement* for
their own linked child must never be able to reach "Balita Baru" mode or
edit/delete an existing record. `RequireAuth` in `App.tsx` guards every
other route and redirects to `/login`; `client.ts`'s response interceptor
does the same on a 401 (expired token).

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

There used to be a dedicated `components/ParentDashboardQr.tsx` rendering
this link as its own QR card in both `Skrining.tsx` and `ChildDashboard.tsx`
— removed once it became clear that showing parents **two different QR
images** to choose between ("view only" vs. "register") was just confusing
(which one do I scan?), not two genuinely useful options. The choice itself
is still offered — just as an in-app picker after a single scan, see Fase 1
below — rather than as two physical QR codes. This route (`#/p/:token`) is
no longer reached *directly* by any QR in the app — even the QR printed on
the A5 report (`lib/pdf.ts`) now encodes the same registration+picker link
as `LinkCodeCard.tsx` (via the shared `lib/parentLink.ts` helper, keyed off
`child.linkCode`, not `child.publicToken`), so a parent scanning a printed
report gets the identical "Lihat Saja" vs "Daftar & Catat Mandiri" choice
instead of a third, inconsistent flow just for paper copies.

### Fase 1: akun orang tua & pengukuran mandiri

The first version of this flow made a parent register, land on an empty
Beranda, then separately visit a "Tautkan Balita" page and type a 6-digit
code by hand — three steps for what's conceptually one action ("this is my
child's account"). It's now collapsed into one scan, matching the same
deep-link-QR pattern `KodePosyandu.tsx` already used for kader_nakes
invites — and it's the **one and only** "share with parent" QR shown
anywhere in the app now (see the note above about the removed
`ParentDashboardQr.tsx`). What that one scan leads to depends on a choice
made *after* scanning, not on which QR was scanned (see the picker below).

`components/LinkCodeCard.tsx` — rendered in `ChildDashboard.tsx` as the
single "Bagikan ke Orang Tua" card whenever `child.linkCode` is present
**and** `canEditDelete()` — i.e. kader_nakes/admin only, even though the
backend also lets an already-linked orangtua read `child.linkCode` (so they
*could* hand it on to a co-parent, see permissions.py). The card is gated
out for orangtua here anyway: it's the tool kader_nakes uses to onboard a
parent, and a parent looking at their own already-linked child's dashboard
has no use for a QR whose whole purpose is registering + linking an
account they already have. Lazy-loads `qrcode` to render a QR encoding
`#/register?linkCode=<code>&role=orangtua&viewToken=<child.publicToken>`
(the `viewToken` param is omitted if the child has no `public_token` yet),
plus the plain 6-digit code as a manual fallback (read aloud, or typed in
if scanning isn't possible) with a copy button and a "Kode Baru" regenerate
button (`growthApi.regenerateLinkCode()` → `POST /children/<id>/regenerate-
code/`) — both always shown here since the card itself is already
`canEditDelete()`-gated.

`pages/Register.tsx` reads both the `linkCode` and `viewToken` query params
(distinct from the existing `code` param used for the kader_nakes
invite-code QR — the three never appear together). When both `linkCode`
and `viewToken` are present and the visitor **isn't already authenticated**,
it renders a picker (`mode: 'choose' | 'form'`, defaulting to `'choose'`)
instead of jumping straight to the form: **"Lihat Saja"** navigates to
`/p/<viewToken>` (the same no-login dashboard Fase 2 always used, no
account created); **"Daftar & Catat Mandiri"** switches to `'form'` mode.
If `viewToken` is missing (child has no `public_token`), there's nothing to
offer a "just look" link to, so it skips the picker and goes straight to
the form — same as before this change.

Choosing (or defaulting straight to) the form: the role `<select>` and the
kader_nakes-only "Lokasi Klinik/Posyandu" field are hidden entirely (role is
fixed to `orangtua`, unambiguous from having scanned a *specific child's*
QR), and a banner explains the account will auto-link after registering.
`handleSubmit()` calls `authApi.register()` then immediately
`growthApi.linkChild(linkCode)`, landing directly on `/child/<id>` — no
intermediate page. If a user who's **already** authenticated opens the same
link (e.g. an existing parent scanning a second child's QR for a sibling),
a `useEffect` keyed off `autoLinking = Boolean(prefilledLinkCode) &&
authApi.isAuthenticated()` skips the picker and the form entirely and
redeems the code right away — an account holder scanning a new child's QR
almost certainly wants to link it, not view it read-only when they already
have full access.

`pages/LinkChild.tsx` (route `/tautkan-balita`) — still exists as the manual
fallback (QR didn't scan, or linking a second child without wanting to
re-register): orangtua-only page (guards on `authApi.isOrangtua()`) with a
single 6-digit numeric input (`inputMode="numeric"`, strips non-digits
client-side) that calls `growthApi.linkChild(code)` →
`POST /api/children/link/`. On success it shows a confirmation with the
linked child's name and a button to Beranda, rather than auto-redirecting —
useful here since, unlike the QR path, there's no single child context to
jump straight into.

`pages/PengukuranMandiri.tsx` (route `/pengukuran-mandiri`) — orangtua-only,
deliberately a separate, much simpler component from `Skrining.tsx` rather
than a fourth mode bolted onto it: it fetches `growthApi.listChildren()`
(already scoped server-side to the orangtua's own linked children via
`visible_children()`), shows a child `<select>` only if there's more than
one, then just the core anthropometric fields — tanggal, berat, tinggi,
lingkar kepala (opsional), catatan (opsional). No officer name, no
location, no risk-factor questionnaire, no photo upload — those are
kader/nakes-facing fields that don't apply to an at-home self-measurement.
`ageMonths` is computed client-side with `lib/dates.ts`'s `monthsBetween()`
(same helper `Skrining.tsx` uses), not entered manually. Submitting calls
the same `growthApi.createRecord()` used everywhere else — the backend
computes Z-scores/risk_status identically regardless of who submitted it.
An empty-children state links out to `/tautkan-balita` instead of showing a
blank form. Both `ChildDashboard.tsx`'s header ("+ Pengukuran Mandiri"
button, shown via `canSelfMeasure()`) and `Dashboard.tsx`'s hero CTA branch
on `authApi.isOrangtua()` to point here instead of `/skrining`.

`AppLayout.tsx`'s nav swaps in a dedicated `orangtuaNav` array (not just
conditionally hiding/showing items from `baseNav`) when `authApi.isOrangtua()`
— "Skrining Baru" is replaced by "Pengukuran Mandiri", and a "Tautkan
Balita" item is appended; "Data Balita"/"Riwayat"/"Edukasi"/"Jadwal
Posyandu" stay the same since those pages already work correctly read-scoped
to whatever `visible_children()` returns for that account.

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
if there are more), and — when `child.linkCode` is set — a large QR
call-to-action box encoding the same registration+picker link as
`LinkCodeCard.tsx` (`lib/parentLink.ts`'s `registrationLink()`, not the
bare `#/p/:token` link this used to point to), framed as "Detail Lengkap &
Rekomendasi di Web". The full recommendation list, officer notes, nutrition
tips, and food examples are deliberately **not** printed — they only live
on the web (behind either "Lihat Saja" or a registered account), so
parents have a reason to actually open the link instead of the print being
a complete (and instantly stale) substitute for it.

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
