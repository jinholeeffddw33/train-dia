'use client';

import { useState, useCallback } from 'react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useHeaderScroll } from '@/hooks/useHeaderScroll';
import { startViewTransition } from '@/lib/viewTransition';
import { ArrowLeft } from 'lucide-react';
import TabBar, { type TabId } from './TabBar';
import InternIntroModal from '../common/InternIntroModal';

import { useTrainStore } from '@/stores/train';
import { useExchangeStore } from '@/stores/exchange';
import { useDriverStore } from '@/stores/driver';
import styles from './AppShell.module.css';


interface AppShellProps {
  children: (activeTab: TabId) => React.ReactNode;
  onBack?: () => void;
  /** 초기 탭 — manifest shortcuts URL 파라미터 진입용 (?world=duty&tab=calendar) */
  initialTab?: TabId;
}

export default function AppShell({ children, onBack, initialTab }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'home');
  // SW 등록/업데이트 배너는 루트의 ServiceWorkerRegistrar가 전역 담당 (중복 등록 방지)
  // ZINOSB 헤더 통일 이식 — window 스크롤 모델. 아래로 스크롤 시 헤더(.z-app-header)·TabBar 슬라이드 숨김,
  // 위로 올리면 복귀 + topZone 통과 후 frosted. data-attr 로 후손 헤더/탭바에 전파.
  const { hidden: chromeHidden, frosted: chromeFrosted } = useHeaderScroll();


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

  const goHomeTab = useCallback(() => {
    startViewTransition(() => setActiveTab('home'));
  }, []);

  // home 탭이 아닐 때 뒤로가기 → home 탭 복귀
  useHistoryBack(`tab-${activeTab}`, goHomeTab, activeTab !== 'home');

  const handleTabChange = useCallback((tab: TabId) => {
    if (tab === 'line') triggerScroll();
    // View Transition — 탭 전환 크로스페이드 (미지원/모션 감소 시 즉시 전환)
    startViewTransition(() => {
      setActiveTab(tab);
      window.scrollTo({ top: 0 });
    });
  }, [triggerScroll]);


  return (
    <div
      className={styles.shell}
      data-has-back={onBack ? '' : undefined}
      data-chrome-hidden={chromeHidden ? '' : undefined}
      data-chrome-frosted={chromeFrosted ? '' : undefined}
    >
      {/* 업데이트 배너 — 루트 ServiceWorkerRegistrar로 이동 */}
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
        hidden={chromeHidden}
      />
      {/* ToastContainer — 루트 layout 으로 이동 (전 월드 공용, 2026-07-02 R4) */}
      <InternIntroModal />
    </div>
  );
}
