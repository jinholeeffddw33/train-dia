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
  // 진입 시 '근무'(대시보드) 탭으로 시작 — '홈' 탭은 맨 앞(WorldHub)으로 나가는 액션
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'work');
  // SW 등록/업데이트 배너는 루트의 ServiceWorkerRegistrar가 전역 담당 (중복 등록 방지)
  // 하단 TabBar 만 스크롤 방향에 따라 숨긴다. 상단 헤더(.z-app-header)는 2026-08-03 부터
  // 고정/자동숨김을 걷어내고 본문과 함께 스크롤 — 헤더만 따로 움직여 보이던 문제.
  const { hidden: chromeHidden } = useHeaderScroll();


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

  // 기준 탭 = '근무'(대시보드). 뒤로가기 시 여기로 복귀
  const goWorkTab = useCallback(() => {
    startViewTransition(() => setActiveTab('work'), 'fade');
  }, []);

  // 근무 탭이 아닐 때 뒤로가기 → 근무 탭 복귀
  useHistoryBack(`tab-${activeTab}`, goWorkTab, activeTab !== 'work');

  const handleTabChange = useCallback((tab: TabId) => {
    // '홈' 탭 = 맨 앞(WorldHub)으로 나가기
    if (tab === 'home') {
      onBack?.();
      return;
    }
    if (tab === 'line') triggerScroll();
    // Shared Axis — 탭은 위계가 같고 방향이 없다 → 페이드(fade). 미지원/모션 감소 시 즉시 전환.
    startViewTransition(() => {
      setActiveTab(tab);
      window.scrollTo({ top: 0 });
    }, 'fade');
  }, [triggerScroll, onBack]);


  return (
    <div
      className={styles.shell}
      data-has-back={onBack ? '' : undefined}
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
