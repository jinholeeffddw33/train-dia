'use client';

import { useState, useEffect, useCallback } from 'react';

type Permission = 'default' | 'granted' | 'denied';

export function useNotification() {
  const [permission, setPermission] = useState<Permission>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setSupported(true);
      setPermission(Notification.permission as Permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!supported) return false;
    const result = await Notification.requestPermission();
    setPermission(result as Permission);
    return result === 'granted';
  }, [supported]);

  const notify = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!supported || permission !== 'granted') return null;

      // Service Worker가 있으면 SW를 통해 알림 (백그라운드 지원 + 기본 알림음 + 진동)
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            icon: '/icons/dia5-192.png',
            badge: '/icons/badge-96.png',
            ...options,
            vibrate: [300, 200, 300, 200, 300],
          } as NotificationOptions);
        });
        return null;
      }

      // 폴백: 직접 Notification
      return new Notification(title, {
        icon: '/icons/dia5-192.png',
        ...options,
      });
    },
    [supported, permission],
  );

  return {
    supported,
    permission,
    requestPermission,
    notify,
  };
}
