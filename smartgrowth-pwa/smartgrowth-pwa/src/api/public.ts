import { apiClient } from './client';
import type { PublicChildDashboard } from '@/types';

// No-login parent dashboard (Fase 2) — apiClient still attaches an
// Authorization header if one happens to be in localStorage (e.g. a kader
// previewing the link while logged in), but the backend endpoint is
// AllowAny and only ever looks at the token in the URL, so this works
// identically for a signed-out visitor.
export const publicApi = {
  getChildDashboard: (token: string) => apiClient.get<PublicChildDashboard>(`/public/children/${token}/`)
};
