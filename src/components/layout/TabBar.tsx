'use client';

import { Home, CalendarDays, TrainFront, Briefcase, RefreshCw, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './TabBar.module.css';

export type TabId = 'home' | 'calendar' | 'line' | 'duty' | 'exchange' | 'more';

interface TabItem {
  id: TabId;
  label: string;
  Icon: LucideIcon;
}

const TABS: TabItem[] = [
  { id: 'home', label: '홈', Icon: Home },
  { id: 'calendar', label: '교번', Icon: CalendarDays },
  { id: 'line', label: '5호선', Icon: TrainFront },
  { id: 'duty', label: '근무', Icon: Briefcase },
  { id: 'exchange', label: '교체', Icon: RefreshCw },
  { id: 'more', label: '설정', Icon: Settings },
];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  alertCount?: number;
  exchangeCount?: number;
}

export default function TabBar({ activeTab, onTabChange, alertCount = 0, exchangeCount = 0 }: TabBarProps) {
  return (
    <nav className={styles.tabBar} role="tablist" aria-label="메인 내비게이션">
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
            {tab.id === 'exchange' && exchangeCount > 0 && (
              <span className={styles.badge} aria-label={`교체 요청 ${exchangeCount}개`}>
                {exchangeCount > 9 ? '9+' : exchangeCount}
              </span>
            )}
            {isActive && <span className={styles.tabIndicator} />}
          </button>
        );
      })}
    </nav>
  );
}
