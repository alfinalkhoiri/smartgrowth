import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// registerType: 'autoUpdate' means this reloads the tab once a newly
// deployed service worker takes over — no "new version available, refresh?"
// prompt, and no need for a kader/nakes who left the app open all day to
// manually close/reopen it to see a deploy. Registered here (not via the
// plugin's own auto-injected <script>, see injectRegister: false in
// vite.config.ts) specifically because the auto-injected script is a bare
// `serviceWorker.register()` call with none of that update/reload behavior.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    // The browser only checks for a new SW on navigation by default — an
    // open tab left running for hours (exactly the kader/nakes usage
    // pattern this app is built for) would otherwise never notice a
    // deploy until closed and reopened.
    if (!registration) return;
    setInterval(() => registration.update(), 60 * 60 * 1000);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
