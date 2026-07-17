import { apiClient } from './client';
import type { PosyanduSchedule } from '@/types';

export const scheduleApi = {
  listSchedules: () => apiClient.get<PosyanduSchedule[]>('/posyandu-schedules/'),
  createSchedule: (payload: Omit<PosyanduSchedule, 'id' | 'createdAt'>) =>
    apiClient.post<PosyanduSchedule>('/posyandu-schedules/', payload),
  updateSchedule: (id: string, payload: Omit<PosyanduSchedule, 'id' | 'createdAt'>) =>
    apiClient.put<PosyanduSchedule>(`/posyandu-schedules/${id}/`, payload),
  deleteSchedule: (id: string) => apiClient.delete(`/posyandu-schedules/${id}/`)
};
