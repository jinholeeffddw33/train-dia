import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ===== 규정 문제 풀이 이어풀기 진행상황 (SSOT) =====
// 규정별(quiz url)로 "다음에 풀 문제 인덱스"를 저장한다.
// 중간에 나갔다가 다시 들어오면 그 지점부터 이어서 풀 수 있다.

interface QuizProgressState {
  /** quiz url → 다음에 풀 문제 인덱스 (0-based) */
  progress: Record<string, number>;
  /** 진행 위치 저장 */
  setProgress: (key: string, idx: number) => void;
  /** 진행 위치 조회 (없으면 0) */
  getProgress: (key: string) => number;
  /** 진행 위치 삭제 (완료/처음부터) */
  clearProgress: (key: string) => void;
}

export const useQuizProgressStore = create<QuizProgressState>()(
  persist(
    (set, get) => ({
      progress: {},

      setProgress: (key, idx) =>
        set((s) => ({ progress: { ...s.progress, [key]: idx } })),

      getProgress: (key) => get().progress[key] ?? 0,

      clearProgress: (key) =>
        set((s) => {
          if (!(key in s.progress)) return s;
          const next = { ...s.progress };
          delete next[key];
          return { progress: next };
        }),
    }),
    {
      name: 'regQuizProgress',
      partialize: (state) => ({ progress: state.progress }),
    },
  ),
);
