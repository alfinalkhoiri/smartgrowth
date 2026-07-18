import { apiClient } from './client';

interface LoginResponse {
  access: string;
  refresh: string;
}

export type PublicRole = 'kader_nakes' | 'orangtua';
export type Role = PublicRole | 'admin';

export interface RegisterPayload {
  username: string;
  password: string;
  role: PublicRole;
  email?: string;
  phoneNumber?: string;
  // Hanya wajib diisi kalau role === 'kader_nakes' — lihat
  // KADER_NAKES_INVITE_CODE di backend. Peran kader_nakes bisa lihat SEMUA
  // balita, jadi pendaftaran publik ke peran ini digerbangi kode ini supaya
  // tidak sembarang orang bisa mendaftar dan langsung dapat akses penuh.
  inviteCode?: string;
}

interface TokenPayload {
  username?: string;
  role?: Role;
  is_superuser?: boolean;
}

// Decodes the JWT payload (middle segment) client-side — no signature check,
// this is only for showing/hiding UI actions, never a security boundary.
// The backend's RoleBasedGrowthPermission is the real authority; a user
// tampering with this can only change what buttons they see, not what the
// API actually lets them do.
function decodeToken(token: string): TokenPayload | null {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(normalized)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const authApi = {
  login: async (username: string, password: string) => {
    const res = await apiClient.post<LoginResponse>('/auth/login', { username, password });
    localStorage.setItem('smartgrowth_token', res.data.access);
    localStorage.setItem('smartgrowth_refresh', res.data.refresh);
    return res.data;
  },
  register: async (payload: RegisterPayload) => {
    const res = await apiClient.post<LoginResponse>('/auth/register', payload);
    localStorage.setItem('smartgrowth_token', res.data.access);
    localStorage.setItem('smartgrowth_refresh', res.data.refresh);
    return res.data;
  },
  logout: () => {
    localStorage.removeItem('smartgrowth_token');
    localStorage.removeItem('smartgrowth_refresh');
  },
  isAuthenticated: () => Boolean(localStorage.getItem('smartgrowth_token')),
  getCurrentUser: (): TokenPayload | null => {
    const token = localStorage.getItem('smartgrowth_token');
    return token ? decodeToken(token) : null;
  },
  // Mirrors RoleBasedGrowthPermission on the backend: kader_nakes/admin (or
  // any superuser) has full create+edit+delete; orangtua is read-only and
  // only ever sees their own linked child(ren) — that scoping happens
  // server-side (visible_children()), not here. Keep in sync with the
  // backend matrix if it ever changes.
  canCreate: (): boolean => {
    const user = authApi.getCurrentUser();
    if (!user) return false;
    return user.is_superuser === true || user.role === 'kader_nakes' || user.role === 'admin';
  },
  canEditDelete: (): boolean => {
    const user = authApi.getCurrentUser();
    if (!user) return false;
    return user.is_superuser === true || user.role === 'kader_nakes' || user.role === 'admin';
  },
  isOrangtua: (): boolean => authApi.getCurrentUser()?.role === 'orangtua'
};
