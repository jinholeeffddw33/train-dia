import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface QuizState {
  /** 현재 퀴즈 인덱스 */
  currentIdx: number;
  /** 마지막 답변 시각 */
  answeredAt: string | null;
  /** 마지막 퀴즈 날짜 */
  day: string | null;
  /** 퀴즈 진행 */
  answer: (idx: number) => void;
  /** 날짜 리셋 */
  resetIfNewDay: (today: string) => void;
}

export const useQuizStore = create<QuizState>()(
  persist(
    (set, get) => ({
      currentIdx: 0,
      answeredAt: null,
      day: null,

      answer: (idx) =>
        set({
          currentIdx: idx,
          answeredAt: new Date().toISOString(),
        }),

      resetIfNewDay: (today) => {
        if (get().day !== today) {
          set({ currentIdx: 0, answeredAt: null, day: today });
        }
      },
    }),
    {
      name: 'quizState',
      partialize: (state) => ({
        currentIdx: state.currentIdx,
        answeredAt: state.answeredAt,
        day: state.day,
      }),
    },
  ),
);
