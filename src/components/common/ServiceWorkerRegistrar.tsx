'use client';

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
  const { updateAvailable, applyUpdate } = useServiceWorker();
  const online = useOnlineStatus();

  if (!updateAvailable && online) return null;

  return (
    <div className={styles.bannerStack}>
      {updateAvailable && (
        <div className={styles.updateBanner}>
          <span>새 버전이 나왔어요</span>
          <button type="button" className={styles.updateBtn} onClick={applyUpdate}>
            업데이트
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
