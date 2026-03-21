'use client';

import { useState, useCallback, useEffect } from 'react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { ArrowLeft } from 'lucide-react';
import TabBar, { type TabId } from './TabBar';
import ToastContainer from '../common/Toast';
import Modal from '../common/Modal';
import { AlertFab } from '@/features/alerts';
import { useAlertStore } from '@/stores/alert';
import { useTrainStore } from '@/stores/train';
import { useExchangeStore } from '@/stores/exchange';
import { useDriverStore } from '@/stores/driver';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import styles from './AppShell.module.css';

const CHEER_KEY = 'cheer_dismissed_20260321';

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

  // 응원 팝업 (X 누르면 다시 안 뜸)
  const [cheerOpen, setCheerOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(CHEER_KEY)) setCheerOpen(true);
    } catch { /* SSR/private mode */ }
  }, []);
  const dismissCheer = useCallback(() => {
    setCheerOpen(false);
    try { localStorage.setItem(CHEER_KEY, '1'); } catch { /* ignore */ }
  }, []);

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

  const cheerTitle = driver
    ? `${driver.n} 기관사님께`
    : '답십리 기관사 여러분께';

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

      {/* 응원 팝업 */}
      <Modal open={cheerOpen} onClose={dismissCheer} title={cheerTitle}>
        <div className={styles.cheerBody}>
          <p className={styles.cheerEmoji}>🚇</p>
          <p className={styles.cheerText}>
            BTS 공연으로 전국이 들썩이는 오늘,<br />
            묵묵히 현장을 지키는 여러분 감사합니다.
          </p>
          <p className={styles.cheerHighlight}>고생 많으십니다!</p>
          <p className={styles.cheerSub}>안전 귀가하세요!</p>
          <button
            type="button"
            className={styles.cheerBtn}
            onClick={dismissCheer}
          >
            확인
          </button>
        </div>
      </Modal>
    </div>
  );
}
