import { create } from 'zustand';
import type { Person } from '@/lib/types';

interface CompareState {
  /** 비교 대상 A */
  personA: Person | null;
  /** 비교 대상 B */
  personB: Person | null;
  /** 비교 연도 */
  year: number;
  /** 비교 월 */
  month: number;

  setPersonA: (p: Person | null) => void;
  setPersonB: (p: Person | null) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  resetMonth: () => void;
}

const now = new Date();

export const useCompareStore = create<CompareState>()((set) => ({
  personA: null,
  personB: null,
  year: now.getFullYear(),
  month: now.getMonth() + 1,

  setPersonA: (p) => set({ personA: p }),
  setPersonB: (p) => set({ personB: p }),

  prevMonth: () =>
    set((s) => {
      if (s.month === 1) return { year: s.year - 1, month: 12 };
      return { month: s.month - 1 };
    }),

  nextMonth: () =>
    set((s) => {
      if (s.month === 12) return { year: s.year + 1, month: 1 };
      return { month: s.month + 1 };
    }),

  resetMonth: () =>
    set({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    }),
}));
