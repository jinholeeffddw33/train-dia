'use client';

import { useEffect, useRef } from 'react';

/**
 * ESC 키로 오버레이/모달 닫기 공통 훅.
 * active 일 때만 keydown 리스너 등록 — 중첩 오버레이는 상위에서 active 조건으로 제어.
 */
export function useEscapeClose(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);
}
