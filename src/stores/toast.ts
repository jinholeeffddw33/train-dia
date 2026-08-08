'use client';

import { create } from 'zustand';
import { hapticError, hapticSuccess, hapticWarning } from '@/lib/haptic';

/**
 * 토스트 전역 store (UI-TOAST-001) — ZINOSB toastStore 적응 이식 2026-08-09
 *
 * ★ 왜 store 로 바꿨나 —
 *   기존 구현은 `let addToastFn: ((...) => void) | null = null` 모듈 레벨 가변 싱글턴이었다.
 *   ToastContainer 가 마운트될 때 자기 setState 를 거기 꽂고, 언마운트 때 null 로 되돌린다.
 *   그래서:
 *     1. 컨테이너가 마운트되기 **전에** 부른 토스트는 그냥 사라진다(초기 로드 중 에러 알림이 증발).
 *     2. 라우트 전환/StrictMode 재마운트 사이 짧은 순간에 부르면 역시 사라진다.
 *     3. 화면이 두 개면 마지막에 마운트된 쪽만 살아남는다.
 *   store 는 컴포넌트 생명주기 밖에 있어서 이 창이 없다.
 *
 * ★ 햅틱 자동 발화 (진호 결정 2026-08-09) —
 *   개별 버튼 703곳 배선 대신 **여기 한 곳에서** success/error/warning 에 햅틱을 물린다.
 *   배선 0으로 커버율이 붙는다. 그래서 호출부에서 토스트와 함께 햅틱을 **중복 호출 금지**.
 *   iOS Safari 는 navigator.vibrate 미지원이라 조용히 no-op — 동작에 지장 없다.
 *
 * ★ 기존 호출부 34건은 그대로 둔다 — `showToast(text, type)` 시그니처를 유지하고
 *   내부만 store 로 바꿨다.
 */

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface ToastItem {
  id: number;
  text: string;
  type: ToastType;
}

/** 화면에 동시에 쌓이는 최대 개수 — 넘치면 가장 오래된 것부터 밀어낸다 */
const MAX_VISIBLE = 3;
const DURATION_MS = 3000;

interface ToastState {
  toasts: ToastItem[];
  show: (text: string, type?: ToastType) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (text, type = 'info') => {
    const id = ++nextId;

    // 같은 문구가 이미 떠 있으면 새로 쌓지 않는다(연타 시 같은 토스트 도배 방지)
    const existing = get().toasts.find((t) => t.text === text && t.type === type);
    if (existing) {
      const prev = timers.get(existing.id);
      if (prev) clearTimeout(prev);
      timers.set(existing.id, setTimeout(() => get().dismiss(existing.id), DURATION_MS));
      return existing.id;
    }

    set((s) => {
      const next = [...s.toasts, { id, text, type }];
      // 넘치는 만큼 오래된 것 제거(타이머도 같이 정리해야 누수가 안 생긴다)
      while (next.length > MAX_VISIBLE) {
        const dropped = next.shift();
        if (dropped) {
          const t = timers.get(dropped.id);
          if (t) clearTimeout(t);
          timers.delete(dropped.id);
        }
      }
      return { toasts: next };
    });

    // 햅틱 자동 발화 — info 는 조용히(단순 안내에 진동은 과함)
    if (type === 'success') hapticSuccess();
    else if (type === 'error') hapticError();
    else if (type === 'warning') hapticWarning();

    timers.set(id, setTimeout(() => get().dismiss(id), DURATION_MS));
    return id;
  },

  dismiss: (id) => {
    const t = timers.get(id);
    if (t) clearTimeout(t);
    timers.delete(id);
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },

  clear: () => {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    set({ toasts: [] });
  },
}));

/**
 * 전역 토스트 호출 — 컴포넌트 밖(스토어·유틸·이벤트 핸들러)에서도 쓸 수 있다.
 * 기존 `showToast` 와 시그니처가 같아 호출부 34건은 수정이 필요 없다.
 */
export function showToast(text: string, type: ToastType = 'info'): number {
  return useToastStore.getState().show(text, type);
}

export function dismissToast(id: number): void {
  useToastStore.getState().dismiss(id);
}
