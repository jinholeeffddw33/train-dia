'use client';

import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import type { TabId } from '@/components/layout/TabBar';
import { HomeHeader, TodayCard, WeekStrip, StatusCards, MonthSummary, DriverSelector } from '@/features/home';
import styles from './page.module.css';

function TabContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'home':
      return <HomeTab />;
    case 'calendar':
      return <PlaceholderTab name="교번" emoji="📅" color="var(--dia-green)" />;
    case 'line':
      return <PlaceholderTab name="5호선" emoji="🚇" color="var(--dia-purple)" />;
    case 'compare':
      return <PlaceholderTab name="비교" emoji="⚖️" color="var(--dia-amber)" />;
    case 'contacts':
      return <PlaceholderTab name="연락처" emoji="📞" color="var(--dia-sky)" />;
    case 'more':
      return <PlaceholderTab name="더보기" emoji="⚙️" color="var(--dia-gray)" />;
    default:
      return null;
  }
}

function HomeTab() {
  const [selectorOpen, setSelectorOpen] = useState(false);

  return (
    <>
      <HomeHeader onDriverSelect={() => setSelectorOpen(true)} />
      <TodayCard />
      <WeekStrip />
      <StatusCards />
      <MonthSummary />
      <DriverSelector
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
      />
    </>
  );
}

function PlaceholderTab({ name, emoji, color }: { name: string; emoji: string; color: string }) {
  return (
    <div className={styles.placeholder}>
      <span className={styles.placeholderIcon}>{emoji}</span>
      {/* STYLE-EXCEPTION: 탭별 동적 컬러 */}
      <h2 className={styles.placeholderTitle} style={{ color }}>{name}</h2>
      <p className={styles.placeholderDesc}>준비 중입니다</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <AppShell>
      {(activeTab) => <TabContent tab={activeTab} />}
    </AppShell>
  );
}
