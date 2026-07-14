import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Capacitor note:
// - `server.url` in capacitor.config.ts (when added) will point to this build output.
// - Keep base: './' so asset paths work correctly when wrapped in a native WebView.
export default defineConfig({
  base: './',
  resolve: {
    // Mirrors the "@/*" path in tsconfig.json — tsc only type-checks aliases,
    // it doesn't resolve them at runtime, so Vite needs its own mapping.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'SmartGrowth - Stunting Risk Telescreening',
        short_name: 'SmartGrowth',
        description: 'AI-based telescreening for early stunting risk detection and toddler growth monitoring',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Without this, reloading (or deep-linking) a client-side route like
        // /child/:id while offline shows the browser's default offline error
        // page instead of the cached app shell — Workbox only serves
        // precached index.html for *unmatched* navigations if told to.
        // Verified with Playwright: offline reload of /child/:id 404s at the
        // navigation level (not just the API call) without this set.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Cache API responses for growth records so the app works offline
        // and syncs later when connection returns.
        runtimeCaching: [
          {
            urlPattern: /\/api\/growth-records/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'growth-records-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: /\/api\/children/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'children-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Forwards /api calls to the Django dev server so the browser only
      // ever talks to one origin (avoids needing CORS for local dev).
      // Override via VITE_PROXY_TARGET when running this dev server inside
      // Docker, where "localhost" refers to the container, not the host
      // (use http://host.docker.internal:8000 in that case).
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  preview: {
    // Same proxy as `server`, so `npm run build && npm run preview` can be
    // used to test the real production build (incl. the PWA service worker,
    // which vite-plugin-pwa only registers outside of `npm run dev`)
    // locally without having to set VITE_API_BASE_URL + backend CORS just
    // for a local smoke test.
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
});
