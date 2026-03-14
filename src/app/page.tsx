'use client';

import { useState } from 'react';
import AuthGate from '@/components/common/AuthGate';
import AppShell from '@/components/layout/AppShell';
import type { TabId } from '@/components/layout/TabBar';
import { HomeHeader, TodayCard, WeekStrip, StatusCards, MonthSummary, HomeTipsQuiz } from '@/features/home';
import { CalendarTab, ExchangeRequest } from '@/features/calendar';
import { DutyTab } from '@/features/duty';
import { MoreTab } from '@/features/more';
import { Line5Tab } from '@/features/line5';

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
      <HomeTipsQuiz />
    </>
  );
}

export default function HomePage() {
  return (
    <AuthGate>
      <AppShell>
        {(activeTab) => <TabContent tab={activeTab} />}
      </AppShell>
    </AuthGate>
  );
}
