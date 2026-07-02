'use client';

import { useEffect, useState } from 'react';

/**
 * 온라인/오프라인 상태 훅 — navigator.onLine + online/offline 이벤트.
 * SSR/hydration 안전: 초기값 true, 마운트 후 실제 값으로 동기화.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
