'use client';

import { useEffect, useRef } from 'react';

/**
 * PWA 뒤로가기(하드웨어/제스처) 인터셉트 훅 v3.
 *
 * 전략: history 스택을 항상 2개 이상 유지.
 * popstate 발생 시 → 최상위 핸들러 실행 + 즉시 pushState로 스택 복구.
 * cleanup에서 history.back()을 절대 호출하지 않음 → 연쇄 종료 방지.
 */

type Handler = { key: string; fn: () => void };

const stack: Handler[] = [];
let listening = false;

function attach() {
  if (listening) return;
  listening = true;

  // 앱 시작 시 히스토리 엔트리 2개 확보 (빈 스택 방지)
  history.replaceState({ dia: 'root' }, '');
  history.pushState({ dia: 'guard' }, '');

  window.addEventListener('popstate', () => {
    // 항상 즉시 pushState로 스택 복구 (앱 종료 방지)
    history.pushState({ dia: 'guard' }, '');

    if (stack.length > 0) {
      const top = stack[stack.length - 1];
      top.fn();
    }
    // 핸들러가 없으면 아무 일도 안 함 (WorldHub에서 뒤로가기 = 무시)
  });
}

export function useHistoryBack(
  key: string,
  onBack: () => void,
  enabled: boolean = true,
) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const entryRef = useRef<Handler | null>(null);

  useEffect(() => {
    attach();

    if (!enabled) {
      // 비활성화 → 스택에서 제거 (history 조작 없음)
      if (entryRef.current) {
        const idx = stack.indexOf(entryRef.current);
        if (idx !== -1) stack.splice(idx, 1);
        entryRef.current = null;
      }
      return;
    }

    // 이미 동일 키가 스택에 있으면 콜백만 갱신
    const existing = stack.find((h) => h.key === key);
    if (existing) {
      existing.fn = () => onBackRef.current();
      entryRef.current = existing;
      return;
    }

    const entry: Handler = {
      key,
      get fn() { return () => onBackRef.current(); },
      set fn(f) { /* handled by ref */ },
    };
    // getter로 항상 최신 onBack 참조
    Object.defineProperty(entry, 'fn', {
      get() { return () => onBackRef.current(); },
    });

    stack.push(entry);
    entryRef.current = entry;

    return () => {
      if (entryRef.current) {
        const idx = stack.indexOf(entryRef.current);
        if (idx !== -1) stack.splice(idx, 1);
        entryRef.current = null;
      }
    };
  }, [key, enabled]);
}
