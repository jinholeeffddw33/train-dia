'use client';

import { useEffect, useRef } from 'react';

/**
 * PWA 뒤로가기 인터셉트 훅 v5.
 */

interface Entry {
  key: string;
  backRef: React.RefObject<(() => void) | null>;
}

const stack: Entry[] = [];
let ready = false;
let processing = false;

function init() {
  if (ready) return;
  ready = true;

  history.replaceState({ dia: 0 }, '');
  history.pushState({ dia: 1 }, '');

  window.addEventListener('popstate', () => {
    // 처리 중이면 무시 (연쇄 방지)
    if (processing) {
      history.pushState({ dia: 1 }, '');
      return;
    }
    processing = true;

    // guard 복구
    history.pushState({ dia: 1 }, '');

    // 최상위 활성 핸들러 실행
    for (let i = stack.length - 1; i >= 0; i--) {
      const fn = stack[i].backRef.current;
      if (fn) {
        fn();
        break;
      }
    }

    // 200ms 후 처리 해제 (빠른 연속 뒤로가기 허용)
    setTimeout(() => { processing = false; }, 200);
  });
}

export function useHistoryBack(
  key: string,
  onBack: () => void,
  enabled: boolean = true,
) {
  const backRef = useRef<(() => void) | null>(null);
  backRef.current = enabled ? onBack : null;

  useEffect(() => {
    init();

    // 이미 등록된 키면 스킵 (같은 ref이므로 current만 갱신되면 됨)
    if (stack.some((e) => e.key === key)) return;

    const entry: Entry = { key, backRef };
    stack.push(entry);

    return () => {
      const idx = stack.findIndex((e) => e.key === key);
      if (idx !== -1) stack.splice(idx, 1);
    };
  }, [key]);
}
