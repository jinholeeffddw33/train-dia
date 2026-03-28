import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** 알람 시간 옵션 (분) */
export type AlarmMinute = 10 | 20 | 30 | 60 | 70;

/** 일반 열번용 옵션 */
export const NORMAL_OPTIONS: AlarmMinute[] = [10, 20, 30];
/** 기지 열번(1000/1500/2000대) 추가 옵션 */
export const DEPOT_OPTIONS: AlarmMinute[] = [60, 70];

/** DIA 85~91 고정 알람 시각 */
export const FIXED_TIME_OPTIONS = ['04:30', '04:40'] as const;
export type FixedTime = (typeof FIXED_TIME_OPTIONS)[number];

export const ALARM_LABELS: Record<AlarmMinute, string> = {
  10: '10분 전',
  20: '20분 전',
  30: '30분 전',
  60: '1시간 전',
  70: '1시간 10분 전',
};

interface AlarmState {
  /** 선택된 알람 시간 (분 단위), 빈 배열 = 사용안함 */
  selected: AlarmMinute[];
  /** DIA 85~91 고정 시각 알람 */
  fixedTimes: FixedTime[];
  /** 이미 울린 알람 키 (중복 방지) */
  fired: string[];
  toggle: (m: AlarmMinute) => void;
  toggleFixed: (t: FixedTime) => void;
  clearAll: () => void;
  markFired: (key: string) => void;
  resetFired: () => void;
}

export const useAlarmStore = create<AlarmState>()(
  persist(
    (set, get) => ({
      selected: [],
      fixedTimes: [],
      fired: [],

      toggle: (m: AlarmMinute) => {
        const cur = get().selected;
        set({
          selected: cur.includes(m) ? cur.filter((v) => v !== m) : [...cur, m],
        });
      },

      toggleFixed: (t: FixedTime) => {
        const cur = get().fixedTimes;
        set({
          fixedTimes: cur.includes(t) ? cur.filter((v) => v !== t) : [...cur, t],
        });
      },

      clearAll: () => set({ selected: [], fixedTimes: [] }),

      markFired: (key: string) => {
        const cur = get().fired;
        if (!cur.includes(key)) set({ fired: [...cur, key] });
      },

      resetFired: () => set({ fired: [] }),
    }),
    {
      name: 'dia-alarm',
      partialize: (state) => ({ selected: state.selected, fixedTimes: state.fixedTimes }),
    },
  ),
);
