'use client';

import { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '@/lib/constants';

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000;
/** 콜드 스타트 자동 업데이트를 이 세션에서 이미 시도했는지 (무한 새로고침 방지) */
const AUTO_UPDATE_KEY = 'dia-auto-updated';

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

    // ★ 등록 URL 에 배포 버전을 실어 보낸다 — sw.js 파일 내용은 배포해도 안 바뀌므로
    //   `/sw.js` 그대로면 브라우저가 **SW 업데이트를 감지조차 못 한다**(바이트 동일).
    //   v 가 바뀌면 새 스크립트로 취급돼 install→activate 가 돌고,
    //   sw.js 가 그 v 로 캐시 이름을 만들어 옛 버전 캐시를 activate 에서 폐기한다.
    navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`).then((reg) => {
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

  // ── 콜드 스타트 자동 적용 ──
  // "앱을 밀었다 켜면 새 버전이 적용돼 있어야 한다"(진호 2026-08-09).
  // 이전에는 outdated 여도 배너를 띄우고 **사용자가 눌러야** 적용됐다.
  //
  // ★ 콜드 스타트에서만 자동 적용한다. 포그라운드 복귀 때 자동 새로고침하면
  //   작성 중이던 메모·폼이 날아간다 — 그 경우는 기존대로 배너로 남긴다.
  //   "콜드 스타트"의 판정 = 이 세션에서 아직 자동 적용을 한 적이 없음(sessionStorage).
  //   세션 저장소는 앱을 완전히 종료하면 비므로 "밀었다 켜기"와 정확히 일치한다.
  // ★ 무한 새로고침 방지: 적용 직전에 표식을 남기고, 표식이 있으면 다시는 자동 적용하지 않는다.
  //   (배포가 롤백되는 등으로 버전이 계속 어긋나도 루프에 빠지지 않는다)
  const autoAppliedRef = useRef(false);
  useEffect(() => {
    if (!outdated || autoAppliedRef.current) return;
    if (typeof window === 'undefined') return;
    let alreadyTried = false;
    try {
      alreadyTried = window.sessionStorage.getItem(AUTO_UPDATE_KEY) === '1';
    } catch { /* 프라이빗 모드 등 — 자동 적용을 포기하고 배너로 */ alreadyTried = true; }
    if (alreadyTried) return;
    autoAppliedRef.current = true;
    try { window.sessionStorage.setItem(AUTO_UPDATE_KEY, '1'); } catch { /* ignore */ }
    forceAppUpdate();
  }, [outdated]);

  return { updateAvailable, applyUpdate: forceAppUpdate, outdated, currentVersion: APP_VERSION, latestVersion };
}
