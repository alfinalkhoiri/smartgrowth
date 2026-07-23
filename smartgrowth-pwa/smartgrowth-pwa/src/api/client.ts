import axios, { type InternalAxiosRequestConfig } from 'axios';

// In Capacitor builds, this should point to your deployed API base URL
// (native WebViews can't use relative "/api" against localhost the way a browser dev server can).
// e.g. import.meta.env.VITE_API_BASE_URL = 'https://smartgrowth-api.example.id'
const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';

// Endpoints hit *before* a session exists — a 401 here is a normal "wrong
// credentials"/validation error for the calling page to show, not a sign
// the session expired, so the refresh-and-retry logic below skips them
// entirely (retrying/redirecting on a failed login attempt would be
// pointless and confusing).
const AUTH_BOOTSTRAP_PATHS = ['/auth/login', '/auth/refresh', '/auth/register'];

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retriedAfterRefresh?: boolean;
}

export const apiClient = axios.create({
  baseURL,
  timeout: 10000
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartgrowth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function clearSessionAndRedirect() {
  localStorage.removeItem('smartgrowth_token');
  localStorage.removeItem('smartgrowth_refresh');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// Shared across every 401 that arrives while a refresh is already in
// flight. Without this, several requests failing at the same moment (e.g.
// a page firing off Promise.all of a few API calls right as the access
// token expires) would each fire their own /auth/refresh call — with
// ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION on the backend, only the
// first of those would actually succeed (it invalidates the refresh token
// it used), so every other one would then itself 401 and force a bogus
// logout even though the session was perfectly fine.
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    const refreshToken = localStorage.getItem('smartgrowth_refresh');
    refreshPromise = axios
      .post<{ access: string; refresh: string }>(`${baseURL}/auth/refresh`, { refresh: refreshToken })
      .then((res) => {
        localStorage.setItem('smartgrowth_token', res.data.access);
        localStorage.setItem('smartgrowth_refresh', res.data.refresh);
        return res.data.access;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;

    if (status !== 401 || !config || AUTH_BOOTSTRAP_PATHS.some((path) => config.url?.includes(path))) {
      return Promise.reject(error);
    }

    // Already retried once, or there's no refresh token to try with (never
    // logged in, or a previous refresh already failed) — nothing left to
    // do but treat this like a real session expiry.
    if (config._retriedAfterRefresh || !localStorage.getItem('smartgrowth_refresh')) {
      clearSessionAndRedirect();
      return Promise.reject(error);
    }

    try {
      config._retriedAfterRefresh = true;
      const newAccessToken = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(config);
    } catch {
      // Refresh token itself is expired/blacklisted — this IS a real
      // "you've been idle too long, log in again" moment (see
      // REFRESH_TOKEN_LIFETIME in the backend's SIMPLE_JWT settings).
      clearSessionAndRedirect();
      return Promise.reject(error);
    }
  }
);
