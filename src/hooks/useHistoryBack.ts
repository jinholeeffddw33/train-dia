'use client';

import { useEffect, useRef } from 'react';

/**
 * PWA 뒤로가기(하드웨어/제스처) 인터셉트 훅.
 *
 * 글로벌 스택으로 관리: 가장 최근에 등록된 핸들러만 popstate에 반응.
 * 월드 진입 → 서브 화면 순으로 중첩되어도 올바르게 역순 해제.
 */

type StackEntry = {
  key: string;
  onBack: () => void;
};

const handlerStack: StackEntry[] = [];
let suppressPopState = false;
let listenerAttached = false;

function ensureGlobalListener() {
  if (listenerAttached) return;
  listenerAttached = true;

  window.addEventListener('popstate', () => {
    if (suppressPopState) {
      suppressPopState = false;
      return;
    }
    const top = handlerStack.pop();
    if (top) {
      top.onBack();
    }
  });
}

export function useHistoryBack(
  key: string,
  onBack: () => void,
  enabled: boolean = true,
) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const registeredRef = useRef(false);
  const entryRef = useRef<StackEntry | null>(null);

  useEffect(() => {
    if (!enabled) {
      // 비활성화 시 스택에서 제거 + 히스토리 엔트리 정리
      if (registeredRef.current && entryRef.current) {
        const idx = handlerStack.indexOf(entryRef.current);
        if (idx !== -1) {
          handlerStack.splice(idx, 1);
          // popstate 연쇄 방지 후 히스토리 정리
          suppressPopState = true;
          history.back();
        }
        entryRef.current = null;
        registeredRef.current = false;
      }
      return;
    }

    ensureGlobalListener();

    const entry: StackEntry = {
      key,
      get onBack() { return onBackRef.current; },
    };
    history.pushState({ historyBack: key }, '');
    handlerStack.push(entry);
    entryRef.current = entry;
    registeredRef.current = true;

    return () => {
      if (entryRef.current) {
        const idx = handlerStack.indexOf(entryRef.current);
        if (idx !== -1) {
          handlerStack.splice(idx, 1);
          suppressPopState = true;
          history.back();
        }
        entryRef.current = null;
        registeredRef.current = false;
      }
    };
  }, [key, enabled]);
}
