import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HealingCardEntry {
  id: string;
  date: string;    // "2026-03-18"
  amount: number;   // 사용 금액
  memo: string;     // 사용처
}

interface HealingCardState {
  /** 월 한도 (기본 300,000원) */
  limit: number;
  /** 사용 내역 */
  entries: HealingCardEntry[];
  /** 마지막 초기화 월 "2026-03" */
  lastResetMonth: string;

  /** 한도 변경 */
  setLimit: (limit: number) => void;
  /** 사용 기록 추가 */
  addEntry: (amount: number, memo: string) => void;
  /** 사용 기록 삭제 */
  removeEntry: (id: string) => void;
  /** 월 초기화 체크 (앱 진입 시 호출) */
  checkMonthlyReset: () => void;
  /** 총 사용 금액 */
  totalUsed: () => number;
  /** 잔액 */
  remaining: () => number;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const useHealingCardStore = create<HealingCardState>()(
  persist(
    (set, get) => ({
      limit: 300000,
      entries: [],
      lastResetMonth: currentMonth(),

      setLimit: (limit) => set({ limit: Math.max(0, limit) }),

      addEntry: (amount, memo) => {
        const entry: HealingCardEntry = {
          id: genId(),
          date: todayStr(),
          amount,
          memo,
        };
        set((s) => ({ entries: [...s.entries, entry] }));
      },

      removeEntry: (id) =>
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      checkMonthlyReset: () => {
        const cm = currentMonth();
        if (get().lastResetMonth !== cm) {
          set({ entries: [], lastResetMonth: cm });
        }
      },

      totalUsed: () => get().entries.reduce((sum, e) => sum + e.amount, 0),

      remaining: () => get().limit - get().entries.reduce((sum, e) => sum + e.amount, 0),
    }),
    { name: 'dia-healing-card' },
  ),
);
