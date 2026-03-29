'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * PWA 뒤로가기(하드웨어/제스처) 인터셉트 훅.
 *
 * 원리: history.pushState로 더미 엔트리를 쌓고,
 * popstate 이벤트 발생 시 등록된 콜백을 실행.
 *
 * 개선사항 (v2):
 * - 스택 대신 단일 핸들러 방식으로 단순화
 * - suppressPopState 타이밍 문제 해결
 * - cleanup 시 history.back() 연쇄 방지
 */

// 전역 핸들러 맵 (key → callback)
const handlers = new Map<string, () => void>();
// cleanup 중 popstate 무시 카운터
let suppressCount = 0;
let listenerReady = false;

function ensureListener() {
  if (listenerReady) return;
  listenerReady = true;

  window.addEventListener('popstate', () => {
    if (suppressCount > 0) {
      suppressCount--;
      return;
    }

    // 가장 최근에 등록된 핸들러 실행
    const keys = [...handlers.keys()];
    if (keys.length === 0) return;

    const lastKey = keys[keys.length - 1];
    const handler = handlers.get(lastKey);
    handlers.delete(lastKey);
    handler?.();
  });
}

export function useHistoryBack(
  key: string,
  onBack: () => void,
  enabled: boolean = true,
) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      // 비활성화 → 정리
      if (pushedRef.current) {
        handlers.delete(key);
        pushedRef.current = false;
        suppressCount++;
        history.back();
      }
      return;
    }

    ensureListener();

    // 이미 등록된 동일 키가 있으면 핸들러만 갱신
    if (handlers.has(key)) {
      handlers.set(key, () => onBackRef.current());
      return;
    }

    handlers.set(key, () => onBackRef.current());
    history.pushState({ hb: key }, '');
    pushedRef.current = true;

    return () => {
      if (pushedRef.current && handlers.has(key)) {
        handlers.delete(key);
        pushedRef.current = false;
        suppressCount++;
        history.back();
      }
    };
  }, [key, enabled]);
}
