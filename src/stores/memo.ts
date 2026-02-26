import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MemoState {
  /** 날짜별 메모 { "2026-02-26": "메모 내용" } */
  memos: Record<string, string>;
  /** 메모 저장/수정 */
  setMemo: (date: string, text: string) => void;
  /** 메모 삭제 */
  removeMemo: (date: string) => void;
  /** 메모 조회 */
  getMemo: (date: string) => string;
}

export const useMemoStore = create<MemoState>()(
  persist(
    (set, get) => ({
      memos: {},

      setMemo: (date, text) =>
        set((state) => ({
          memos: { ...state.memos, [date]: text },
        })),

      removeMemo: (date) =>
        set((state) => {
          const next = { ...state.memos };
          delete next[date];
          return { memos: next };
        }),

      getMemo: (date) => get().memos[date] ?? '',
    }),
    {
      name: 'diaMemos',
      partialize: (state) => ({ memos: state.memos }),
    },
  ),
);
