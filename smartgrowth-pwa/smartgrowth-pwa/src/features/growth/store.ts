import { create } from 'zustand';
import type { Child, GrowthRecord } from '@/types';

interface GrowthState {
  children: Child[];
  records: Record<string, GrowthRecord[]>; // keyed by childId
  setChildren: (children: Child[]) => void;
  addChild: (child: Child) => void;
  updateChild: (child: Child) => void;
  removeChild: (childId: string) => void;
  setRecords: (childId: string, records: GrowthRecord[]) => void;
  addRecord: (record: GrowthRecord) => void;
  updateRecord: (record: GrowthRecord) => void;
  removeRecord: (childId: string, recordId: string) => void;
}

// Kept in memory + hydrated from the PWA cache (via NetworkFirst in vite.config.ts)
// rather than localStorage, so large history doesn't bloat local storage quota.
export const useGrowthStore = create<GrowthState>((set) => ({
  children: [],
  records: {},
  setChildren: (children) => set({ children }),
  addChild: (child) => set((state) => ({ children: [...state.children, child] })),
  updateChild: (child) =>
    set((state) => ({
      children: state.children.map((c) => (c.id === child.id ? child : c))
    })),
  removeChild: (childId) =>
    set((state) => ({ children: state.children.filter((c) => c.id !== childId) })),
  setRecords: (childId, records) =>
    set((state) => ({ records: { ...state.records, [childId]: records } })),
  addRecord: (record) =>
    set((state) => ({
      records: {
        ...state.records,
        [record.childId]: [...(state.records[record.childId] ?? []), record]
      }
    })),
  updateRecord: (record) =>
    set((state) => ({
      records: {
        ...state.records,
        [record.childId]: (state.records[record.childId] ?? []).map((r) =>
          r.id === record.id ? record : r
        )
      }
    })),
  removeRecord: (childId, recordId) =>
    set((state) => ({
      records: {
        ...state.records,
        [childId]: (state.records[childId] ?? []).filter((r) => r.id !== recordId)
      }
    }))
}));
