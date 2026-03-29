'use client';

import { useEffect, useRef } from 'react';

/**
 * PWA 뒤로가기 인터셉트 훅 v4.
 *
 * - history 스택을 항상 [root, guard] 2개 유지 → 앱 종료 방지
 * - popstate 시 최상위 핸들러 실행 (스택에서 제거하지 않음)
 * - 핸들러 콜백은 항상 ref로 최신 상태 유지
 * - cleanup에서 history 조작 없음
 */

interface Entry {
  key: string;
  backRef: React.RefObject<(() => void) | null>;
}

const stack: Entry[] = [];
let ready = false;

function init() {
  if (ready) return;
  ready = true;

  history.replaceState({ dia: 0 }, '');
  history.pushState({ dia: 1 }, '');

  window.addEventListener('popstate', () => {
    // 즉시 guard 복구
    history.pushState({ dia: 1 }, '');

    // 최상위 핸들러 실행
    for (let i = stack.length - 1; i >= 0; i--) {
      const fn = stack[i].backRef.current;
      if (fn) {
        fn();
        return;
      }
    }
  });
}

export function useHistoryBack(
  key: string,
  onBack: () => void,
  enabled: boolean = true,
) {
  const backRef = useRef<(() => void) | null>(null);
  backRef.current = enabled ? onBack : null;

  const entryRef = useRef<Entry | null>(null);

  useEffect(() => {
    init();

    // 이미 등록된 키면 무시 (ref가 항상 최신이므로 갱신 불필요)
    if (stack.some((e) => e.key === key)) {
      entryRef.current = stack.find((e) => e.key === key)!;
      return;
    }

    const entry: Entry = { key, backRef };
    stack.push(entry);
    entryRef.current = entry;

    return () => {
      const idx = stack.findIndex((e) => e.key === key);
      if (idx !== -1) stack.splice(idx, 1);
      entryRef.current = null;
    };
  }, [key]);
}
