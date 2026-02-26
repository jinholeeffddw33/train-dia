import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Person } from '@/lib/types';
import { P } from '@/data/cycle';

interface DriverState {
  /** 현재 선택된 기관사 */
  current: Person | null;
  /** 기관사 선택 */
  pick: (id: string) => void;
  /** 초기화 (localStorage에서 복원) */
  restore: () => void;
}

export const useDriverStore = create<DriverState>()(
  persist(
    (set) => ({
      current: null,

      pick: (id: string) => {
        const person = P.find((p) => p.I === id) ?? null;
        set({ current: person });
      },

      restore: () => {
        // persist middleware가 자동 복원하므로 별도 로직 불필요
      },
    }),
    {
      name: 'dp',
      partialize: (state) => ({ current: state.current }),
    },
  ),
);
