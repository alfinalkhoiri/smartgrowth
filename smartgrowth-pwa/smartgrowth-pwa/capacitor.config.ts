import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartgrowth.app',
  appName: 'SmartGrowth',
  webDir: 'dist',
  // No `server.url` — deliberately bundling the built `dist/` assets into
  // the app itself (Capacitor's default) rather than loading a remote URL,
  // so the app shell works the same offline-first way the PWA already does
  // (see vite.config.ts's Workbox config). The app still talks to the real
  // backend over the network for data — see VITE_API_BASE_URL in
  // src/api/client.ts, which a native WebView needs explicitly (it can't
  // resolve a relative "/api" against a dev server the way a browser tab
  // can).
  android: {
    // Capacitor's Android WebView serves local assets over
    // https://localhost by default — matches CORS_ALLOWED_ORIGINS added on
    // the backend for this app (see backend README's Capacitor/CORS note).
    allowMixedContent: false
  }
};

export default config;
