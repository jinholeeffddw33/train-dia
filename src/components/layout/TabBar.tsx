'use client';

import styles from './TabBar.module.css';

export type TabId = 'home' | 'calendar' | 'line' | 'compare' | 'contacts' | 'more';

interface TabItem {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabItem[] = [
  { id: 'home', label: '홈', icon: '🏠' },
  { id: 'calendar', label: '교번', icon: '📅' },
  { id: 'line', label: '5호선', icon: '🚇' },
  { id: 'compare', label: '비교', icon: '⚖️' },
  { id: 'contacts', label: '연락처', icon: '📞' },
  { id: 'more', label: '더보기', icon: '⚙️' },
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
            data-tab={tab.id}
            onClick={() => onTabChange(tab.id)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
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
