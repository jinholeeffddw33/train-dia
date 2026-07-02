'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Screen Wake Lock — "화면 계속 켜기" (승무 중 행로 화면 유지).
 * - iOS 18.4+ / Android Chrome 지원. 미지원이면 supported=false (UI에서 숨김).
 * - 탭 이탈/화면 꺼짐으로 OS가 해제하면 → visible 복귀 시 자동 재획득.
 * - 화면이 켜진 채로 해제되면(배터리 세이버 등) 토글 상태를 OFF로 동기화.
 */
export function useWakeLock() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  /** 사용자 의사 — 숨김 해제 후 visible 복귀 시 재획득 여부 */
  const wantRef = useRef(false);

  useEffect(() => {
    setSupported(typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  }, []);

  const acquire = useCallback(async (): Promise<boolean> => {
    try {
      if (!('wakeLock' in navigator)) return false;
      const sentinel = await navigator.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      sentinel.addEventListener('release', () => {
        // 의도적 해제/교체된 sentinel 이면 release()가 이미 상태를 처리함
        if (sentinelRef.current !== sentinel) return;
        sentinelRef.current = null;
        setActive(false);
        // 화면이 보이는 채로 해제됨(시스템 회수) → 사용자 토글도 OFF 동기화
        if (document.visibilityState === 'visible') {
          wantRef.current = false;
        }
      });
      setActive(true);
      return true;
    } catch {
      sentinelRef.current = null;
      setActive(false);
      return false;
    }
  }, []);

  const release = useCallback(async () => {
    wantRef.current = false;
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setActive(false);
    try {
      await sentinel?.release();
    } catch {
      /* 이미 해제됨 — 무시 */
    }
  }, []);

  /** 토글 — ON이 되면 true 반환 */
  const toggle = useCallback(async (): Promise<boolean> => {
    if (wantRef.current || sentinelRef.current) {
      await release();
      return false;
    }
    wantRef.current = true;
    const ok = await acquire();
    if (!ok) wantRef.current = false;
    return ok;
  }, [acquire, release]);

  // 화면 복귀 시 재획득 (탭 전환/화면 꺼짐으로 해제된 경우)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && wantRef.current && !sentinelRef.current) {
        acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [acquire]);

  // 언마운트 시 해제
  useEffect(() => {
    return () => {
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, []);

  return { supported, active, toggle };
}
