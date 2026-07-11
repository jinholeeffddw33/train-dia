'use client';

import { Home, CalendarDays, TrainFront, Briefcase, ClipboardList, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './TabBar.module.css';

export type TabId = 'home' | 'work' | 'calendar' | 'line' | 'duty' | 'more';

interface TabItem {
  id: TabId;
  label: string;
  Icon: LucideIcon;
}

const TABS: TabItem[] = [
  { id: 'home', label: '홈', Icon: Home },           // 맨 앞(WorldHub)으로 나가기
  { id: 'work', label: '근무', Icon: ClipboardList }, // 오늘의 교번 대시보드
  { id: 'calendar', label: '달력', Icon: CalendarDays },
  { id: 'duty', label: '교번', Icon: Briefcase },
  { id: 'line', label: '5호선', Icon: TrainFront },
  { id: 'more', label: '더보기', Icon: LayoutGrid },   // 더보기(기능 모음) — 설정은 우상단 기어로
];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  alertCount?: number;
  exchangeCount?: number;
  /** 아래로 스크롤 시 true → 바가 아래로 슬라이드되어 숨음 (ZINOSB 바텀네비 통일). */
  hidden?: boolean;
}

export default function TabBar({ activeTab, onTabChange, alertCount = 0, exchangeCount = 0, hidden = false }: TabBarProps) {
  // 주얼 구슬 위치 = 활성 인덱스 (prop 기반 → SSR/클라 동일, 로딩 깜빡 0)
  const activeIdx = Math.max(0, TABS.findIndex((t) => t.id === activeTab));
  return (
    <nav
      className={`${styles.tabBar} ${hidden ? styles.tabBarHidden : ''}`}
      role="tablist"
      aria-label="메인 내비게이션"
      style={{ '--bn-i': activeIdx, '--bn-n': TABS.length } as React.CSSProperties}
    >
      {/* 슬라이딩 주얼 구슬 (네온 라임) — 활성 탭 위로 이동 */}
      <span className={styles.tabJewel} aria-hidden />
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <tab.Icon className={styles.tabIcon} size={22} strokeWidth={isActive ? 2.2 : 1.8} />
            <span className={styles.tabLabel}>{tab.label}</span>
            {tab.id === 'home' && alertCount > 0 && (
              <span className={styles.badge} aria-label={`알림 ${alertCount}개`}>
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
            {/* 교체가 설정 안으로 이동 → 교체 요청 배지도 설정 탭에 표시 */}
            {tab.id === 'more' && exchangeCount > 0 && (
              <span className={styles.badge} aria-label={`교체 요청 ${exchangeCount}개`}>
                {exchangeCount > 9 ? '9+' : exchangeCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
