'use client';

import { useEffect, useRef, useState } from 'react';

const LAST_RELOAD_KEY = 'sw_lastReloadTs';
const AUTO_RELOAD_THRESHOLD = 6 * 60 * 60 * 1000;
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // ── dev 모드: SW 등록 금지 + 기존 SW/캐시 즉시 정리 ──
    // dev 청크는 파일명이 불변이라 SW cache-first가 옛 JS를 영원히 반환 → 코드 수정이 화면에 반영 안 됨.
    // 개발자가 과거에 dev에서 설치해둔 SW가 있으면 캐시까지 걷어내야 정상화된다.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (typeof caches !== 'undefined') {
        caches.keys()
          .then((keys) => keys.filter((k) => k.startsWith('dia-')).forEach((k) => caches.delete(k)))
          .catch(() => {});
      }
      return;
    }

    if (!localStorage.getItem(LAST_RELOAD_KEY)) {
      localStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
    }

    let refreshing = false;
    // 첫 설치 가드: 등록 시점에 controller가 없었다면(첫 방문) clients.claim()으로
    // controllerchange가 한 번 발생하는데, 이때는 새 코드가 이미 떠 있으므로 reload 불필요.
    let hadController = !!navigator.serviceWorker.controller;
    const handleControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      if (refreshing) return;
      refreshing = true;
      localStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    const isStale = () => {
      const last = Number(localStorage.getItem(LAST_RELOAD_KEY) || 0);
      return Date.now() - last > AUTO_RELOAD_THRESHOLD;
    };

    const tryAutoApply = (reg: ServiceWorkerRegistration) => {
      if (!reg.waiting) return false;
      if (isStale() && document.visibilityState === 'visible') {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      }
      setUpdateAvailable(true);
      return false;
    };

    const watchInstalling = (reg: ServiceWorkerRegistration) => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          tryAutoApply(reg);
        }
      });
    };

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      regRef.current = reg;
      reg.addEventListener('updatefound', () => watchInstalling(reg));
      reg.update().catch(() => {});
      if (reg.waiting) tryAutoApply(reg);
    });

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const reg = regRef.current;
      if (!reg) return;
      reg.update().catch(() => {});
      if (reg.waiting) tryAutoApply(reg);
    };
    document.addEventListener('visibilitychange', onVisibility);

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      regRef.current?.update().catch(() => {});
    }, UPDATE_CHECK_INTERVAL);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, []);

  const applyUpdate = () => {
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  };

  return { updateAvailable, applyUpdate };
}
