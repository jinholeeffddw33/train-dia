'use client';

import { useState, useEffect, useCallback } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeApp } from '@/lib/native/platform';
import { checkAlarmPermission, requestAlarmPermission } from '@/lib/native/localAlarms';

type Permission = 'default' | 'granted' | 'denied';

/**
 * 알림 권한/발송 어댑터.
 *
 * 웹과 네이티브는 **아예 다른 API** 를 쓴다:
 *   · 웹      — `Notification` + Service Worker
 *   · 네이티브 — Capacitor LocalNotifications (WebView 에는 `Notification` 자체가 없다.
 *               2026-08-18 실기기 실측으로 확인: `'Notification' in window === false`)
 *
 * 이 훅이 그 차이를 흡수한다. 화면 코드는 supported/permission/requestPermission 만 보면 된다.
 * ⚠️ 어댑터가 없으면 앱에서 알림 설정 UI 가 **통째로 사라진다**(supported=false) —
 *   사용자에게는 "앱이 웹보다 기능이 적다"로 보인다.
 */
export function useNotification() {
  const [permission, setPermission] = useState<Permission>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (isNativeApp()) {
      setSupported(true);
      checkAlarmPermission().then((p) => {
        if (cancelled) return;
        setPermission(p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'default');
      });
      return () => {
        cancelled = true;
      };
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      setSupported(true);
      setPermission(Notification.permission as Permission);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const requestPermission = useCallback(async () => {
    if (!supported) return false;

    if (isNativeApp()) {
      const granted = await requestAlarmPermission();
      setPermission(granted ? 'granted' : 'denied');
      return granted;
    }

    const result = await Notification.requestPermission();
    setPermission(result as Permission);
    return result === 'granted';
  }, [supported]);

  const notify = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!supported || permission !== 'granted') return null;

      if (isNativeApp()) {
        // 즉시 발화 — 예약 알람은 lib/native/localAlarms 가 따로 다룬다.
        // id 는 예약 대역(100000~)과 겹치지 않게 낮은 범위를 쓴다.
        LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 90_000) + 1_000,
              title,
              body: options?.body ?? '',
              autoCancel: true,
            },
          ],
        }).catch(() => {});
        return null;
      }

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
