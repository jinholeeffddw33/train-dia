'use client';

import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import type { TabId } from '@/components/layout/TabBar';
import { HomeHeader, TodayCard, WeekStrip, StatusCards, MonthSummary, DriverSelector } from '@/features/home';
import { CalendarTab } from '@/features/calendar';
import { CompareTab } from '@/features/compare';
import { ContactsTab } from '@/features/contacts';
import { MoreTab } from '@/features/more';
import { Line5Tab } from '@/features/line5';
import { CommuteOverlay } from '@/features/commute';
import { SubwaySearchOverlay } from '@/features/subway';

function TabContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'home':
      return <HomeTab />;
    case 'calendar':
      return <CalendarTab />;
    case 'line':
      return <Line5Tab />;
    case 'compare':
      return <CompareTab />;
    case 'contacts':
      return <ContactsTab />;
    case 'more':
      return <MoreTab />;
    default:
      return null;
  }
}

function HomeTab() {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [commuteOpen, setCommuteOpen] = useState(false);
  const [subwayOpen, setSubwayOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  return (
    <>
      <HomeHeader
        onDriverSelect={() => setSelectorOpen(true)}
        onCommuteOpen={() => setCommuteOpen(true)}
        onSubwaySearch={() => setSubwayOpen(true)}
      />
      <WeekStrip
        selectedDate={selectedDate}
        onSelectDate={(date) => setSelectedDate(date || undefined)}
      />
      <TodayCard selectedDate={selectedDate} />
      <StatusCards />
      <MonthSummary />
      <DriverSelector
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
      />
      <CommuteOverlay
        open={commuteOpen}
        onClose={() => setCommuteOpen(false)}
      />
      <SubwaySearchOverlay
        open={subwayOpen}
        onClose={() => setSubwayOpen(false)}
      />
    </>
  );
}

export default function HomePage() {
  return (
    <AppShell>
      {(activeTab) => <TabContent tab={activeTab} />}
    </AppShell>
  );
}
