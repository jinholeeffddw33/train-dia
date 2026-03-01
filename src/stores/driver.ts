import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Person } from '@/lib/types';
import { P } from '@/data/cycle';

interface DriverState {
  /** 현재 선택된 기관사 */
  current: Person | null;
  /** 기관사 선택 (P 배열에서 ID로 검색) */
  pick: (id: string) => void;
  /** 직접 Person 객체 설정 (P 배열 외 사용자용) */
  setCurrent: (person: Person) => void;
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

      setCurrent: (person: Person) => {
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
