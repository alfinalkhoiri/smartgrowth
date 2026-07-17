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
    pdf.ts          # jsPDF/jsPDF-autotable report generator, lazy-loaded
                    # via dynamic import (see ChildDashboard.tsx) so the
                    # ~450KB gzipped library isn't in the main bundle
  pages/            # Dashboard (Beranda), Skrining, ChildrenList (Data
                    # Balita), ChildDashboard, Riwayat, Edukasi, Jadwal,
                    # Login, Register — RequireAuth + AppLayout wrap every
                    # route except /login and /register (see App.tsx)
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
the app (`src/api/auth.ts`). Registration is public but role-limited to
kader/nakes/viewer (matching the backend — admin accounts aren't publicly
self-serviceable). `RequireAuth` in `App.tsx` guards every other route and
redirects to `/login`; `client.ts`'s response interceptor does the same on a
401 (expired token).

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
