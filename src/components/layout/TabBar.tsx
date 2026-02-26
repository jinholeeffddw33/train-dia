'use client';

import { Home, CalendarDays, TrainFront, GitCompareArrows, Phone, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import styles from './TabBar.module.css';

export type TabId = 'home' | 'calendar' | 'line' | 'compare' | 'contacts' | 'more';

interface TabItem {
  id: TabId;
  label: string;
  Icon: LucideIcon;
}

const TABS: TabItem[] = [
  { id: 'home', label: '홈', Icon: Home },
  { id: 'calendar', label: '교번', Icon: CalendarDays },
  { id: 'line', label: '5호선', Icon: TrainFront },
  { id: 'compare', label: '비교', Icon: GitCompareArrows },
  { id: 'contacts', label: '연락처', Icon: Phone },
  { id: 'more', label: '더보기', Icon: Settings },
];

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  alertCount?: number;
}

export default function TabBar({ activeTab, onTabChange, alertCount = 0 }: TabBarProps) {
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
            {isActive && <span className={styles.tabIndicator} />}
          </button>
        );
      })}
    </nav>
  );
}
