'use client';

import { useState, useCallback } from 'react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { ArrowLeft } from 'lucide-react';
import TabBar, { type TabId } from './TabBar';
import ToastContainer from '../common/Toast';

import { AlertFab } from '@/features/alerts';
import { useAlertStore } from '@/stores/alert';
import { useTrainStore } from '@/stores/train';
import { useExchangeStore } from '@/stores/exchange';
import { useDriverStore } from '@/stores/driver';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import styles from './AppShell.module.css';


interface AppShellProps {
  children: (activeTab: TabId) => React.ReactNode;
  onBack?: () => void;
}

export default function AppShell({ children, onBack }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const alertCount = useAlertStore((s) => s.alerts.length);
  const { canInstall, install } = useInstallPrompt();
  const { updateAvailable, applyUpdate } = useServiceWorker();
  const [installDismissed, setInstallDismissed] = useState(false);


  const triggerScroll = useTrainStore((s) => s.triggerScroll);
  const driver = useDriverStore((s) => s.current);
  const exchangePosts = useExchangeStore((s) => s.posts);
  const exchangeCount = driver
    ? exchangePosts.filter((p) =>
        p.status === 'pending' && (
          (p.type === 'direct' && p.targetId === driver.I) ||
          (p.type === 'open' && p.requesterId === driver.I && p.volunteers.length > 0)
        )
      ).length
    : 0;

  const goHomeTab = useCallback(() => setActiveTab('home'), []);

  // home 탭이 아닐 때 뒤로가기 → home 탭 복귀
  useHistoryBack(`tab-${activeTab}`, goHomeTab, activeTab !== 'home');

  const handleTabChange = useCallback((tab: TabId) => {
    if (tab === 'line') triggerScroll();
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  }, [triggerScroll]);


  return (
    <div className={styles.shell} data-has-back={onBack ? '' : undefined}>
      {/* 업데이트 배너 */}
      {updateAvailable && (
        <div className={styles.updateBanner}>
          <span>새 버전이 나왔어요</span>
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

      {onBack && (
        <button
          type="button"
          className={styles.backBtn}
          onClick={onBack}
          aria-label="세계 선택으로 돌아가기"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
      )}

      <main className={styles.content}>
        {children(activeTab)}
      </main>
      <TabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        alertCount={alertCount}
        exchangeCount={exchangeCount}
      />
      <AlertFab />
      <ToastContainer />
    </div>
  );
}
