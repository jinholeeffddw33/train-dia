'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { startViewTransition } from '@/lib/viewTransition';
import AuthGate from '@/components/common/AuthGate';
import InAppBrowserGate from '@/components/common/InAppBrowserGate';
import RefreshGuideModal from '@/components/common/RefreshGuideModal';
import CycleChangeModal from '@/components/common/CycleChangeModal';
import InternWelcomeModal from '@/components/common/InternWelcomeModal';
import KimMinkyungAwardModal from '@/components/common/KimMinkyungAwardModal';
import WhatsNewModal from '@/components/common/WhatsNewModal';
import WorldLoading from '@/components/common/WorldLoading';
import AppShell from '@/components/layout/AppShell';
import WorldHub, { type WorldId } from '@/components/layout/WorldHub';
import ComingSoon from '@/components/layout/ComingSoon';
import type { TabId } from '@/components/layout/TabBar';
import { HomeHeader, TodayCard, WeekStrip, StatusCards, HomeTipsQuiz, HomeNotice, DriverSelector } from '@/features/home';
import { useAuthStore } from '@/stores/auth';
import { isOffice } from '@/lib/auth';

// ── 코드 스플리팅 — 첫 화면(WorldHub + 근무 홈 탭)만 정적, 나머지 월드/탭은 지연 로드
//    앱이 사실상 CSR(AuthGate 뒤)이라 ssr:false 무방 — 초기 청크에서 각 월드가 빠짐
const loading = () => <WorldLoading />;
const CalendarTab = dynamic(() => import('@/features/calendar/components/CalendarTab'), { ssr: false, loading });
const DutyTab = dynamic(() => import('@/features/duty/components/DutyTab'), { ssr: false, loading });
const MoreTab = dynamic(() => import('@/features/more/components/MoreTab'), { ssr: false, loading });
const Line5Tab = dynamic(() => import('@/features/line5/components/Line5Tab'), { ssr: false, loading });
const EduTab = dynamic(() => import('@/features/edu/components/EduTab'), { ssr: false, loading });
const SafetyWorld = dynamic(() => import('@/features/safety/SafetyWorld'), { ssr: false, loading });
const LifeWorld = dynamic(() => import('@/features/life/LifeWorld'), { ssr: false, loading });
const StandbyCoverageView = dynamic(() => import('@/features/standby/StandbyCoverageView'), { ssr: false, loading });
const OfficeDashboard = dynamic(() => import('@/features/office/OfficeDashboard'), { ssr: false, loading });

function TabContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'work':
      return <HomeTab />; // 오늘의 교번 대시보드 (구 '홈' 내용)
    case 'calendar':
      return <CalendarTab />; // 달력
    case 'line':
      return <Line5Tab />;
    case 'duty':
      return <DutyTab />;
    case 'more':
      return <MoreTab />; // 교체는 이 안에서 진입
    default:
      return <HomeTab />; // 'home'(나가기 액션)은 콘텐츠 없음 → 대시보드 폴백
  }
}

function HomeTab() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [driverOpen, setDriverOpen] = useState(false);

  // 홈 진입 시 오늘 접속 기록 (오늘 1회만 서버에서 처리)
  useEffect(() => {
    fetch('/api/stats', { method: 'POST' }).catch(() => {});
  }, []);

  return (
    <>
      <HomeHeader onDriverClick={() => setDriverOpen(true)} />
      <HomeNotice />
      <WeekStrip
        selectedDate={selectedDate}
        onSelectDate={(date) => setSelectedDate(date || undefined)}
      />
      <TodayCard selectedDate={selectedDate} onEmptyClick={() => setDriverOpen(true)} />
      <StatusCards baseDate={selectedDate} />
      <HomeTipsQuiz />
      <DriverSelector open={driverOpen} onClose={() => setDriverOpen(false)} />
    </>
  );
}

const VALID_WORLDS: readonly string[] = ['duty', 'edu', 'safety', 'life', 'standby'];
const VALID_TABS: readonly string[] = ['work', 'calendar', 'line', 'duty', 'more'];

export default function HomePage() {
  const [world, setWorld] = useState<WorldId | null>(null);
  const [initialTab, setInitialTab] = useState<TabId>('work');
  // 내근직(비승무 직원) 판정 — 로그인 계정 기준(조회 모드 무관). EXTRA/INTERN 사번 = 내근직
  const authUser = useAuthStore((s) => s.user);
  const isOfficeUser = !!authUser && isOffice(authUser.sabun);

  // manifest shortcuts 진입 — ?world=duty&tab=calendar 를 초기 상태로 반영
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const w = params.get('world');
    const t = params.get('tab');
    if (t && VALID_TABS.includes(t)) setInitialTab(t as TabId);
    if (w && VALID_WORLDS.includes(w)) setWorld(w as WorldId);
  }, []);

  const handleEnter = useCallback((w: WorldId) => {
    // View Transition — 월드 진입 크로스페이드 (미지원/모션 감소 시 즉시 전환)
    startViewTransition(() => setWorld(w));
  }, []);

  const handleBack = useCallback(() => {
    startViewTransition(() => setWorld(null));
    // shortcut 진입 탭은 1회성 — 허브로 나오면 소진 (기준 = 근무 대시보드)
    setInitialTab('work');
  }, []);

  // 월드 진입 시 히스토리 push → 뒤로가기로 WorldHub 복귀
  useHistoryBack(`world-${world}`, handleBack, world !== null);

  return (
    <>
      <InAppBrowserGate />
      <AuthGate>
        <RefreshGuideModal />
        <CycleChangeModal />
        <InternWelcomeModal />
        <KimMinkyungAwardModal />
        <WhatsNewModal />
        {world === null ? (
          isOfficeUser
            ? <OfficeDashboard onEnter={handleEnter} />
            : <WorldHub onEnter={handleEnter} />
        ) : world === 'duty' ? (
          <AppShell onBack={handleBack} initialTab={initialTab}>
            {(activeTab) => <TabContent tab={activeTab} />}
          </AppShell>
        ) : world === 'edu' ? (
          <EduTab onBack={handleBack} />
        ) : world === 'safety' ? (
          <SafetyWorld onBack={handleBack} />
        ) : world === 'life' ? (
          <LifeWorld onBack={handleBack} />
        ) : world === 'standby' ? (
          <StandbyCoverageView onBack={handleBack} />
        ) : (
          <ComingSoon worldId={world} onBack={handleBack} />
        )}
      </AuthGate>
    </>
  );
}
