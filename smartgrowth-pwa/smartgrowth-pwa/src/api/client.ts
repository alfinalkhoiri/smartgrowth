import axios from 'axios';

// In Capacitor builds, this should point to your deployed API base URL
// (native WebViews can't use relative "/api" against localhost the way a browser dev server can).
// e.g. import.meta.env.VITE_API_BASE_URL = 'https://smartgrowth-api.example.id'
const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';

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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('smartgrowth_token');
      localStorage.removeItem('smartgrowth_refresh');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
