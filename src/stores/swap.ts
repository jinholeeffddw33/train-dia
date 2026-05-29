import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SwapEntry {
  /** 변경된 교번 번호 (예: "5", "대1", "78") */
  dia: string;
  /** 교번 변경 대상 기관사 ID */
  driverId: string;
  /** 변경 생성 시점 (ISO) */
  createdAt: string;
}

interface SwapState {
  /** 날짜별 교번 변경 { "2026-03-25": { dia: "5", createdAt: "..." } } */
  swaps: Record<string, SwapEntry>;
  /** 교번 변경 저장 */
  setSwap: (date: string, dia: string, driverId: string) => void;
  /** 교번 변경 삭제 */
  removeSwap: (date: string) => void;
  /** 특정 날짜 변경 조회 */
  getSwap: (date: string) => SwapEntry | null;
}

export const useSwapStore = create<SwapState>()(
  persist(
    (set, get) => ({
      swaps: {},

      setSwap: (date, dia, driverId) =>
        set((state) => ({
          swaps: {
            ...state.swaps,
            [date]: { dia, driverId, createdAt: new Date().toISOString() },
          },
        })),

      removeSwap: (date) =>
        set((state) => {
          const next = { ...state.swaps };
          delete next[date];
          return { swaps: next };
        }),

      getSwap: (date) => get().swaps[date] ?? null,
    }),
    {
      name: 'diaSwaps',
      partialize: (state) => ({ swaps: state.swaps }),
    },
  ),
);
