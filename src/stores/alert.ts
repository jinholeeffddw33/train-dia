import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Alert } from '@/lib/types';

interface AlertState {
  /** 전체 알림 목록 */
  alerts: Alert[];
  /** PIN 인증 여부 (세션 단위) */
  authorized: boolean;
  /** 알림 목록 세팅 */
  setAlerts: (alerts: Alert[]) => void;
  /** 알림 추가 */
  addAlert: (alert: Alert) => void;
  /** 알림 비활성화 */
  deactivate: (id: string) => void;
  /** PIN 인증 */
  authorize: () => void;
  /** 활성 알림 개수 */
  activeCount: () => number;
}

export const useAlertStore = create<AlertState>()(
  persist(
    (set, get) => ({
      alerts: [],
      authorized: false,

      setAlerts: (alerts) => set({ alerts }),

      addAlert: (alert) =>
        set((state) => ({ alerts: [alert, ...state.alerts] })),

      deactivate: (id) =>
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id),
        })),

      authorize: () => set({ authorized: true }),

      activeCount: () => get().alerts.length,
    }),
    {
      name: 'diaAlerts',
      partialize: (state) => ({ alerts: state.alerts }),
    },
  ),
);
