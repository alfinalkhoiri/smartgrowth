import { apiClient } from './client';
import type { Child, GrowthRecord, RiskAssessment, GrowthReference } from '@/types';

// Every path below ends in a trailing slash to match DRF's DefaultRouter
// URL patterns exactly. Django's APPEND_SLASH can't transparently redirect
// POST/PUT/DELETE without dropping the request body, so a missing slash
// here isn't just cosmetic — it 500s on every write.
export const growthApi = {
  listChildren: () => apiClient.get<Child[]>('/children/'),
  getChild: (id: string) => apiClient.get<Child>(`/children/${id}/`),
  createChild: (payload: Omit<Child, 'id'>) => apiClient.post<Child>('/children/', payload),
  updateChild: (id: string, payload: Omit<Child, 'id'>) =>
    apiClient.put<Child>(`/children/${id}/`, payload),
  deleteChild: (id: string) => apiClient.delete(`/children/${id}/`),

  listRecords: (childId: string) =>
    apiClient.get<GrowthRecord[]>('/growth-records/', { params: { child: childId } }),
  createRecord: (payload: Omit<GrowthRecord, 'id'>) =>
    apiClient.post<GrowthRecord>('/growth-records/', payload),
  updateRecord: (id: string, payload: Omit<GrowthRecord, 'id'>) =>
    apiClient.put<GrowthRecord>(`/growth-records/${id}/`, payload),
  deleteRecord: (id: string) => apiClient.delete(`/growth-records/${id}/`),

  getRiskAssessment: (childId: string) =>
    apiClient.get<RiskAssessment>(`/risk-assessment/${childId}/`),

  getReference: (sex: 'male' | 'female', ageMonths: number, heightCm?: number) =>
    apiClient.get<GrowthReference>('/growth-reference/', {
      params: { sex, ageMonths, ...(heightCm != null ? { heightCm } : {}) }
    })
};
