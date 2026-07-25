'use client';

import { useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import styles from './ServiceWorkerRegistrar.module.css';

/**
 * SW 등록 + 전역 배너 (업데이트/오프라인).
 * layout.tsx(서버 컴포넌트)에 넣는 유일한 클라이언트 진입점 —
 * AppShell 밖(인증 게이트 이전)에서도 SW 등록·오프라인 안내가 동작한다.
 * useServiceWorker는 여기서만 호출한다(중복 등록 방지).
 */
export default function ServiceWorkerRegistrar() {
  const { updateAvailable, applyUpdate, outdated, currentVersion, latestVersion } = useServiceWorker();
  const online = useOnlineStatus();
  const showUpdate = updateAvailable || outdated;

  useEffect(() => {
    // 영구 스토리지 요청 — 설치 PWA 의 교번/설정이 브라우저 정리로 지워지지 않게 (1회)
    navigator.storage?.persist?.().catch(() => {});

    // 앱 포그라운드 진입 시 아이콘 배지 클리어 (App Badging)
    const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
    const clearBadge = () => {
      nav.clearAppBadge?.().catch(() => {});
    };
    clearBadge();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') clearBadge();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (!showUpdate && online) return null;

  return (
    <div className={styles.bannerStack}>
      {showUpdate && (
        <div className={styles.updateBanner}>
          <div className={styles.updateInfo}>
            <span>새 버전이 나왔어요</span>
            {outdated && latestVersion && (
              <span className={styles.updateVer}>현재 {currentVersion} → 최신 {latestVersion}</span>
            )}
          </div>
          <button type="button" className={styles.updateBtn} onClick={applyUpdate}>
            지금 업데이트
          </button>
        </div>
      )}
      {!online && (
        <div className={styles.offlineBanner} role="status">
          <WifiOff size={16} aria-hidden />
          <span>오프라인 상태예요 — 저장된 근무표를 보여드려요</span>
        </div>
      )}
    </div>
  );
}
