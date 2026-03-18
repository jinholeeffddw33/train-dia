import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Person } from '@/lib/types';

interface CompareState {
  /** 비교 인원 수 (2~20) */
  count: number;
  /** 비교 대상 배열 */
  persons: (Person | null)[];
  /** 비교 연도 */
  year: number;
  /** 비교 월 */
  month: number;

  setCount: (n: number) => void;
  setPerson: (index: number, p: Person | null) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  resetMonth: () => void;
}

const now = new Date();

export const useCompareStore = create<CompareState>()(
  persist(
    (set) => ({
      count: 2,
      persons: [null, null],
      year: now.getFullYear(),
      month: now.getMonth() + 1,

      setCount: (n) =>
        set((s) => {
          const next = Array.from({ length: n }, (_, i) => s.persons[i] ?? null);
          return { count: n, persons: next };
        }),

      setPerson: (index, p) =>
        set((s) => {
          const next = [...s.persons];
          next[index] = p;
          return { persons: next };
        }),

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
    }),
    {
      name: 'dia-compare',
      partialize: (state) => ({
        count: state.count,
        persons: state.persons,
      }),
    },
  ),
);
