'use client';

import { useState, useCallback } from 'react';
import TabBar, { type TabId } from './TabBar';
import ToastContainer from '../common/Toast';
import { AlertFab } from '@/features/alerts';
import { useAlertStore } from '@/stores/alert';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: (activeTab: TabId) => React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const alertCount = useAlertStore((s) => s.alerts.length);
  const { canInstall, install } = useInstallPrompt();
  const { updateAvailable, applyUpdate } = useServiceWorker();
  const [installDismissed, setInstallDismissed] = useState(false);

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className={styles.shell}>
      {/* 업데이트 배너 */}
      {updateAvailable && (
        <div className={styles.updateBanner}>
          <span>새 버전이 있습니다</span>
          <button type="button" className={styles.updateBtn} onClick={applyUpdate}>
            업데이트
          </button>
        </div>
      )}

      {/* 설치 프롬프트 */}
      {canInstall && !installDismissed && (
        <div className={styles.installBanner}>
          <span>홈 화면에 추가하면 더 편리해요</span>
          <div className={styles.installActions}>
            <button type="button" className={styles.installBtn} onClick={install}>
              설치
            </button>
            <button type="button" className={styles.installDismiss} onClick={() => setInstallDismissed(true)}>
              나중에
            </button>
          </div>
        </div>
      )}

      <main className={styles.content}>
        {children(activeTab)}
      </main>
      <TabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        alertCount={alertCount}
      />
      <AlertFab />
      <ToastContainer />
    </div>
  );
}
