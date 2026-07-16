# SmartGrowth PWA

React + TypeScript + Vite PWA scaffold for the SmartGrowth telescreening app.
Structured so it can be wrapped into a native app with **Capacitor** later
without rewriting the UI.

## Structure

```
src/
  api/            # axios client + endpoint calls (talks to Django/Flask backend)
  features/growth/
    zscore.ts     # Stage 1: rule-based WHO Z-score risk classification
    store.ts      # Zustand store, offline-first state
  components/      # GrowthChart, RiskBadge, etc.
  pages/           # route-level screens (Login.tsx, Register.tsx, RequireAuth guard in App.tsx)
  types/           # shared TS types (Child, GrowthRecord, RiskAssessment)
vite.config.ts     # vite-plugin-pwa: manifest + offline caching rules +
                   # navigateFallback (app-shell for offline SPA routes),
                   # dev/preview proxy to Django, and the "@/*" alias (must
                   # mirror tsconfig.json's "paths" — tsc only type-checks
                   # aliases, it doesn't make Vite resolve them at runtime)
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
   `runtimeCaching` (NetworkFirst for growth records/children) plus
   `navigateFallback` for the app shell. Tested end-to-end with Playwright
   against a production build (`npm run build && npm run preview`): log in,
   view a child's growth chart, go offline, reload the same URL — data still
   renders from cache. (`npm run dev` does **not** register the service
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

Palette/typography/spacing were chosen data-driven (via the `ui-ux-pro-max`
skill's design-system search for "healthcare medical dashboard government
public-health"), not picked ad hoc: the **"Accessible & Ethical"** style —
cyan primary (`#0891b2`, Tailwind's `cyan-600`) + emerald accent (`#059669`),
Figtree typeface, WCAG AAA-oriented contrast. Tokens live in
`tailwind.config.js` (`colors.primary` / `colors.accent`) and shared
component classes (`.field-input`, `.btn-primary`, `.btn-secondary`,
`.btn-ghost`, `.card`) in `src/index.css` under `@layer components` — reuse
those instead of one-off utility strings on new pages.

Baseline rules followed throughout (see the skill's `references/pro-rules.md`
for the full checklist): 44×44px minimum touch targets, visible
`:focus-visible` rings, `prefers-reduced-motion` respected, no emoji-as-icon
(SVG only, via `lucide-react`), and risk status is never color-only — every
`RiskBadge` and history-row status dot pairs an icon/color together.

## Risk classification layers

- **Stage 1 (ship first):** rule-based WHO Height-for-Age Z-score thresholds
  (`src/features/growth/zscore.ts`) — clinically defensible, needs no training data.
- **Stage 2 (later):** predictive model (e.g. logistic regression / random forest)
  using historical growth + risk factors (exclusive breastfeeding, birth weight, etc.),
  called via a `/risk-assessment/:childId` backend endpoint. Keep Stage 1 as the
  fallback/baseline even after Stage 2 ships.
