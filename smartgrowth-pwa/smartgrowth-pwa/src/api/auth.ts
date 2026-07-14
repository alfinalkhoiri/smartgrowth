import { apiClient } from './client';

interface LoginResponse {
  access: string;
  refresh: string;
}

export type PublicRole = 'kader' | 'nakes' | 'viewer';

export interface RegisterPayload {
  username: string;
  password: string;
  role: PublicRole;
  email?: string;
  phoneNumber?: string;
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
  isAuthenticated: () => Boolean(localStorage.getItem('smartgrowth_token'))
};
