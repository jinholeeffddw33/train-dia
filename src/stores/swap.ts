import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SwapEntry {
  /** 변경된 교번 번호 (예: "5", "대1", "78") */
  dia: string;
  /** 변경 생성 시점 (ISO) */
  createdAt: string;
}

interface SwapState {
  /** 날짜별 교번 변경 { "2026-03-25": { dia: "5", createdAt: "..." } } */
  swaps: Record<string, SwapEntry>;
  /** 교번 변경 저장 */
  setSwap: (date: string, dia: string) => void;
  /** 교번 변경 삭제 */
  removeSwap: (date: string) => void;
  /** 특정 날짜 변경 조회 */
  getSwap: (date: string) => SwapEntry | null;
  /** 만료된 변경 정리 (오늘 이전 날짜 삭제) */
  cleanExpired: () => void;
}

export const useSwapStore = create<SwapState>()(
  persist(
    (set, get) => ({
      swaps: {},

      setSwap: (date, dia) =>
        set((state) => ({
          swaps: {
            ...state.swaps,
            [date]: { dia, createdAt: new Date().toISOString() },
          },
        })),

      removeSwap: (date) =>
        set((state) => {
          const next = { ...state.swaps };
          delete next[date];
          return { swaps: next };
        }),

      getSwap: (date) => get().swaps[date] ?? null,

      cleanExpired: () =>
        set((state) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const next: Record<string, SwapEntry> = {};
          for (const [date, entry] of Object.entries(state.swaps)) {
            if (date >= todayStr) {
              next[date] = entry;
            }
          }
          return { swaps: next };
        }),
    }),
    {
      name: 'diaSwaps',
      partialize: (state) => ({ swaps: state.swaps }),
    },
  ),
);
