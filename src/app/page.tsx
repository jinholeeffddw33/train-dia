'use client';

import { useState, useCallback, useEffect } from 'react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import AuthGate from '@/components/common/AuthGate';
import AppShell from '@/components/layout/AppShell';
import WorldHub, { type WorldId } from '@/components/layout/WorldHub';
import ComingSoon from '@/components/layout/ComingSoon';
import type { TabId } from '@/components/layout/TabBar';
import { HomeHeader, TodayCard, WeekStrip, StatusCards, MonthSummary, DutyInfoCard, HomeTipsQuiz } from '@/features/home';
import { CalendarTab, ExchangeRequest } from '@/features/calendar';
import { DutyTab } from '@/features/duty';
import { MoreTab } from '@/features/more';
import { Line5Tab } from '@/features/line5';
import { EduTab } from '@/features/edu';

function TabContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'home':
      return <HomeTab />;
    case 'calendar':
      return <CalendarTab />;
    case 'line':
      return <Line5Tab />;
    case 'duty':
      return <DutyTab />;
    case 'exchange':
      return <ExchangeRequest />;
    case 'more':
      return <MoreTab />;
    default:
      return null;
  }
}

function HomeTab() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  return (
    <>
      <HomeHeader />
      <WeekStrip
        selectedDate={selectedDate}
        onSelectDate={(date) => setSelectedDate(date || undefined)}
      />
      <TodayCard selectedDate={selectedDate} />
      <StatusCards baseDate={selectedDate} />
      <MonthSummary />
      <DutyInfoCard />
      <HomeTipsQuiz />
    </>
  );
}

export default function HomePage() {
  const [world, setWorld] = useState<WorldId | null>(null);

  const handleEnter = useCallback((w: WorldId) => {
    setWorld(w);
  }, []);

  const handleBack = useCallback(() => {
    setWorld(null);
  }, []);

  // 월드 진입 시 히스토리 push → 뒤로가기로 WorldHub 복귀
  useHistoryBack(`world-${world}`, handleBack, world !== null);

  return (
    <AuthGate>
      {world === null ? (
        <WorldHub onEnter={handleEnter} />
      ) : world === 'duty' ? (
        <AppShell onBack={handleBack}>
          {(activeTab) => <TabContent tab={activeTab} />}
        </AppShell>
      ) : world === 'edu' ? (
        <EduTab onBack={handleBack} />
      ) : (
        <ComingSoon worldId={world} onBack={handleBack} />
      )}
    </AuthGate>
  );
}
