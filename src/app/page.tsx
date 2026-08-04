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
import AnnounceModal from '@/components/common/AnnounceModal';
import WhatsNewModal from '@/components/common/WhatsNewModal';
import WorldLoading from '@/components/common/WorldLoading';
import AppShell from '@/components/layout/AppShell';
import WorldHub, { type WorldId } from '@/components/layout/WorldHub';
import ComingSoon from '@/components/layout/ComingSoon';
import type { TabId } from '@/components/layout/TabBar';
import { HomeHeader, TodayCard, HomeNotice, DriverSelector } from '@/features/home';
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
const SettingsOverlay = dynamic(() => import('@/features/more/components/SettingsOverlay'), { ssr: false });

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
      <TodayCard selectedDate={selectedDate} onEmptyClick={() => setDriverOpen(true)} />
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
  // 최초 홈은 신분에 따라 다르지만(내근직=일정관리, 기관사=월드허브) 서로 교차 진입 가능
  const [homeOverride, setHomeOverride] = useState<'office' | 'hub' | null>(null);
  // 설정은 앱 전체에서 단일 인스턴스 — 양쪽 홈 헤더의 기어가 이걸 연다
  const [settingsOpen, setSettingsOpen] = useState(false);
  const defaultHome: 'office' | 'hub' = isOfficeUser ? 'office' : 'hub';
  const home: 'office' | 'hub' = homeOverride ?? defaultHome;

  /**
   * 홈 교차 이동 — 기본 홈으로 되돌아가는 경우엔 override 를 두지 않고 해제한다.
   * override 를 'hub'→'office' 로 바꾸면 둘 다 null 이 아니라 useHistoryBack 의
   * key·enabled 가 그대로여서 히스토리가 새로 쌓이지 않는다. 그 상태로 뒤로가기를 누르면
   * override 만 null 이 되는데 기본 홈과 같은 화면이라 "눌러도 아무 일 없음" 이 되고,
   * 앱을 나가려면 두 번 눌러야 했다. null 로 해제하면 히스토리 항목도 함께 정리된다.
   */
  const goHome = useCallback((target: 'office' | 'hub') => {
    setHomeOverride(target === defaultHome ? null : target);
  }, [defaultHome]);

  // manifest shortcuts 진입 — ?world=duty&tab=calendar 를 초기 상태로 반영
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const w = params.get('world');
    const t = params.get('tab');
    if (t && VALID_TABS.includes(t)) setInitialTab(t as TabId);
    if (w && VALID_WORLDS.includes(w)) setWorld(w as WorldId);
  }, []);

  const handleEnter = useCallback((w: WorldId, tab?: TabId) => {
    // View Transition — 월드 진입 크로스페이드 (미지원/모션 감소 시 즉시 전환)
    // tab 을 주면 그 탭으로 바로 연다(허브의 달력 바로가기). AppShell 이 새로 마운트되며
    // initialTab 을 초기값으로 받으므로, 지정이 없으면 기준 탭인 '근무'로 되돌린다.
    startViewTransition(() => {
      setInitialTab(tab ?? 'work');
      setWorld(w);
    });
  }, []);

  const handleBack = useCallback(() => {
    startViewTransition(() => setWorld(null));
    // shortcut 진입 탭은 1회성 — 허브로 나오면 소진 (기준 = 근무 대시보드)
    setInitialTab('work');
  }, []);

  // 월드 진입 시 히스토리 push → 뒤로가기로 WorldHub 복귀
  useHistoryBack(`world-${world}`, handleBack, world !== null);
  // 홈 교차(내근직↔월드허브) — 뒤로가기 시 원래 홈으로 복귀(없으면 앱이 튕겨 나감)
  useHistoryBack('home-override', () => setHomeOverride(null), homeOverride !== null);

  return (
    <>
      <InAppBrowserGate />
      <AuthGate>
        <RefreshGuideModal />
        <CycleChangeModal />
        <InternWelcomeModal />
        <KimMinkyungAwardModal />
        <AnnounceModal />
        <WhatsNewModal />
        <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        {world === null ? (
          home === 'office'
            ? <OfficeDashboard onEnter={handleEnter} onOpenHub={() => goHome('hub')} onOpenSettings={() => setSettingsOpen(true)} />
            : <WorldHub onEnter={handleEnter} onOpenSchedule={() => goHome('office')} onOpenSettings={() => setSettingsOpen(true)} />
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
