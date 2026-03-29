'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import AuthGate from '@/components/common/AuthGate';
import AppShell from '@/components/layout/AppShell';
import WorldHub, { type WorldId } from '@/components/layout/WorldHub';
import ComingSoon from '@/components/layout/ComingSoon';
import type { TabId } from '@/components/layout/TabBar';
import { HomeHeader, TodayCard, WeekStrip, StatusCards, HomeTipsQuiz, HomeNotice } from '@/features/home';
import { CalendarTab, ExchangeRequest } from '@/features/calendar';
import { DutyTab } from '@/features/duty';
import { MoreTab } from '@/features/more';
import { Line5Tab } from '@/features/line5';
import { EduTab } from '@/features/edu';
import SafetyWorld from '@/features/safety/SafetyWorld';

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
      <HomeNotice />
      <WeekStrip
        selectedDate={selectedDate}
        onSelectDate={(date) => setSelectedDate(date || undefined)}
      />
      <TodayCard selectedDate={selectedDate} />
      <StatusCards baseDate={selectedDate} />
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

  // WorldHub에서 뒤로가기 → 앱 종료 방지 (2초 내 더블탭으로 종료)
  const lastBackRef = useRef(0);
  const [showExitToast, setShowExitToast] = useState(false);
  const handleExitBack = useCallback(() => {
    const now = Date.now();
    if (now - lastBackRef.current < 2000) {
      // 2초 내 연속 뒤로가기 → 앱 종료 허용
      window.close();
      return;
    }
    lastBackRef.current = now;
    setShowExitToast(true);
    setTimeout(() => setShowExitToast(false), 2000);
    // 히스토리 다시 push하여 스택 유지
    history.pushState({ exitGuard: true }, '');
  }, []);
  useHistoryBack('exit-guard', handleExitBack, world === null);

  return (
    <AuthGate>
      {showExitToast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)', color: '#fff', padding: '10px 20px',
          borderRadius: 8, fontSize: 14, zIndex: 9999, whiteSpace: 'nowrap',
        }}>
          한 번 더 뒤로가기를 누르면 종료됩니다
        </div>
      )}
      {world === null ? (
        <WorldHub onEnter={handleEnter} />
      ) : world === 'duty' ? (
        <AppShell onBack={handleBack}>
          {(activeTab) => <TabContent tab={activeTab} />}
        </AppShell>
      ) : world === 'edu' ? (
        <EduTab onBack={handleBack} />
      ) : world === 'safety' ? (
        <SafetyWorld onBack={handleBack} />
      ) : (
        <ComingSoon worldId={world} onBack={handleBack} />
      )}
    </AuthGate>
  );
}
