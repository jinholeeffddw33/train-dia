'use client';

import { useState, useCallback } from 'react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { ArrowLeft } from 'lucide-react';
import TabBar, { type TabId } from './TabBar';
import ToastContainer from '../common/Toast';

import { useTrainStore } from '@/stores/train';
import { useExchangeStore } from '@/stores/exchange';
import { useDriverStore } from '@/stores/driver';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import styles from './AppShell.module.css';


interface AppShellProps {
  children: (activeTab: TabId) => React.ReactNode;
  onBack?: () => void;
}

export default function AppShell({ children, onBack }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const { updateAvailable, applyUpdate } = useServiceWorker();


  const triggerScroll = useTrainStore((s) => s.triggerScroll);
  const myDriver = useDriverStore((s) => s.myDriver ?? s.current);
  const viewDriver = useDriverStore((s) => s.current);
  const isViewMode = useDriverStore((s) => s.isViewMode);
  const backToMe = useDriverStore((s) => s.backToMe);
  const exchangePosts = useExchangeStore((s) => s.posts);
  const exchangeCount = myDriver
    ? exchangePosts.filter((p) =>
        p.status === 'pending' && (
          (p.type === 'direct' && p.targetId === myDriver.I) ||
          (p.type === 'open' && p.requesterId === myDriver.I && p.volunteers.length > 0)
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

      {/* 조회 모드 배너 — 삭제: HomeHeader 내 돌아가기 버튼으로 통합 */}

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
        exchangeCount={exchangeCount}
      />
      <ToastContainer />
    </div>
  );
}
