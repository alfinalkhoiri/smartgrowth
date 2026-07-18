import { create } from 'zustand';
import type { Child, GrowthRecord } from '@/types';

interface GrowthState {
  children: Child[];
  records: Record<string, GrowthRecord[]>; // keyed by childId
  setChildren: (children: Child[]) => void;
  removeChild: (childId: string) => void;
  setRecords: (childId: string, records: GrowthRecord[]) => void;
  removeRecord: (childId: string, recordId: string) => void;
}

// Kept in memory + hydrated from the PWA cache (via NetworkFirst in vite.config.ts)
// rather than localStorage, so large history doesn't bloat local storage quota.
// No add/update actions — every create/edit flow now goes through Skrining.tsx,
// which navigates away afterward and lets the destination page re-fetch fresh
// data instead of hand-patching the store.
export const useGrowthStore = create<GrowthState>((set) => ({
  children: [],
  records: {},
  setChildren: (children) => set({ children }),
  removeChild: (childId) =>
    set((state) => ({ children: state.children.filter((c) => c.id !== childId) })),
  setRecords: (childId, records) =>
    set((state) => ({ records: { ...state.records, [childId]: records } })),
  removeRecord: (childId, recordId) =>
    set((state) => ({
      records: {
        ...state.records,
        [childId]: (state.records[childId] ?? []).filter((r) => r.id !== recordId)
      }
    }))
}));
