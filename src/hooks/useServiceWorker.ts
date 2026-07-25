'use client';

import { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '@/lib/constants';

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000;

/**
 * 어디서든(버튼 등) 호출해 즉시 최신으로 만든다 — 훅 부수효과(중복 SW 등록) 없음.
 * 대기 중 새 SW가 있으면 즉시 전환(→controllerchange 자동 새로고침),
 * 없으면 네트워크 우선 셸을 다시 받아 최신화.
 */
export function forceAppUpdate() {
  if (typeof window === 'undefined') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    window.location.reload();
    return;
  }
  navigator.serviceWorker.getRegistration()
    .then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        reg?.update?.().catch(() => {});
        window.location.reload();
      }
    })
    .catch(() => window.location.reload());
}

export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
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
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // 근무표·출근시간이 코드에 포함되어 배포되므로, 옛 버전 = 옛 출근시간.
    // 앱을 열거나 포그라운드로 돌아온 시점(=사용자가 화면을 보는 순간)에
    // 대기 중인 새 버전이 있으면 지체 없이 즉시 적용한다(6시간 대기 없음).
    // 화면이 숨겨진 상태에서 설치가 끝난 경우만 배너로 남겨 다음 포그라운드에 적용.
    const tryAutoApply = (reg: ServiceWorkerRegistration) => {
      if (!reg.waiting) return false;
      if (document.visibilityState === 'visible') {
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

  // ── 버전 확인: 서버(배포본)의 APP_VERSION 과 내 번들의 APP_VERSION 비교 ──
  // SW가 /api/* 를 우회하므로 항상 라이브 값을 받는다. 캐시된 옛 앱이면 값이 달라진다.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const check = () => {
      fetch('/api/version', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!cancelled && d && typeof d.version === 'string') setLatestVersion(d.version);
        })
        .catch(() => { /* 오프라인 등 — 무시 */ });
    };
    check();
    const onVisibility = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') check();
    }, VERSION_CHECK_INTERVAL);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, []);

  const outdated = latestVersion != null && latestVersion !== APP_VERSION;

  return { updateAvailable, applyUpdate: forceAppUpdate, outdated, currentVersion: APP_VERSION, latestVersion };
}
