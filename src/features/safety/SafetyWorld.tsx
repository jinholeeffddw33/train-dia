'use client';

import { Component, type ReactNode, useState, useEffect, useCallback } from 'react';
import { ArrowLeft, TrendingUp, ChevronRight } from 'lucide-react';
import { LINE5_PROFILE_ID } from './constants';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useAlertStore } from '@/stores/alert';
import { useHazardStore } from '@/stores/hazard';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import Modal from '@/components/common/Modal';
import AlertList from '@/features/alerts/components/AlertList';
import AlertForm from '@/features/alerts/components/AlertForm';
import HazardList from './components/HazardList';
import HazardForm from './components/HazardForm';
import HazardDetail from './components/HazardDetail';
import NoticeForm from './components/NoticeForm';
import SafetyDashboard from './components/SafetyDashboard';
import SafetyTipsView from './components/SafetyTipsView';
import Line5GradientProfile from './components/Line5GradientProfile';
import { isAdmin, getUserRole } from '@/lib/auth';
import { useSafetyUnread } from './hooks/useSafetyUnread';
import styles from './SafetyWorld.module.css';

interface SafetyWorldProps {
  onBack: () => void;
}

class SafetyErrorBoundary extends Component<
  { children: ReactNode; onBack: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.wrap}>
          <header className={styles.header}>
            <button
              type="button"
              className={styles.backBtn}
              onClick={this.props.onBack}
              aria-label="돌아가기"
            >
              <ArrowLeft size={20} strokeWidth={2} />
            </button>
            <h1 className={styles.headerTitle}>안전</h1>
          </header>
          <main className={styles.content}>
            <div className={styles.errorState}>
              <p className={styles.errorText}>화면을 불러오지 못했어요</p>
              <p className={styles.errorHint}>잠시 후 다시 시도해주세요</p>
            </div>
          </main>
        </div>
      );
    }
    return this.props.children;
  }
}

type SafetyCategory = 'hazard' | 'action' | 'inspect';
/** 진입한 카드의 표시 정보 — 데이터 카테고리는 같아도 헤더/빈상태 문구는 카드별로 다르게 노출 */
type CardKey = 'incident' | 'driving' | 'train' | 'hazard' | 'notice';
type SafetyView =
  | 'home'
  | 'alert'
  | 'tips'
  | { type: 'list'; category: SafetyCategory; cardKey: CardKey }
  | { type: 'detail'; category: SafetyCategory; cardKey: CardKey; id: string };

/** 카드별 표시 정보 — 헤더 제목과 빈 상태 문구가 카드 라벨과 일치하도록 */
const CARD_DISPLAY: Record<CardKey, { label: string; emptyIcon: string; emptyText: string; emptyHint: string }> = {
  incident: { label: '사례교육', emptyIcon: '⚠️', emptyText: '등록된 사례교육이 없어요', emptyHint: '발생한 사고 사례를 사례교육으로 등록해주세요' },
  driving:  { label: '운전 정보', emptyIcon: '🚆', emptyText: '등록된 운전 정보가 없어요', emptyHint: '서행 구간·운전 변경 사항을 공유해주세요' },
  train:    { label: '열차 정보', emptyIcon: '🚇', emptyText: '등록된 열차 정보가 없어요', emptyHint: '차량 업데이트·변경 사항을 공유해주세요' },
  hazard:   { label: '위험개소', emptyIcon: '📷', emptyText: '등록된 위험개소가 없어요', emptyHint: '발견한 위험개소를 사진으로 공유해주세요' },
  notice:   { label: '공지사항', emptyIcon: '📋', emptyText: '등록된 공지가 없어요', emptyHint: '관리자가 등록한 공지가 여기에 표시됩니다' },
};

/** 카테고리별 리스트 화면 (위험/조치/점검 공통) */
function CategoryListView({
  category, cardKey, label, emptyConfig, sabun,
  onBack, onSelect, onShowForm, showForm, onCloseForm, onCountsChanged,
}: {
  category: SafetyCategory;
  cardKey: CardKey;
  label: string;
  emptyConfig: { icon: string; text: string; hint: string };
  sabun: string;
  onBack: () => void;
  onSelect: (id: string) => void;
  onShowForm: () => void;
  showForm: boolean;
  onCountsChanged?: () => void;
  onCloseForm: () => void;
}) {
  const fetchReports = useHazardStore((s) => s.fetchReports);
  const reports = useHazardStore((s) => s.reports);
  const loading = useHazardStore((s) => s.loadingReports);
  const isInspect = category === 'inspect';
  const adminUser = isAdmin(sabun);
  const [showAdminAlert, setShowAdminAlert] = useState(false);

  useEffect(() => {
    fetchReports(sabun, category);
  }, [fetchReports, sabun, category]);

  const handleAddClick = () => {
    if (isInspect && !adminUser) {
      setShowAdminAlert(true);
      setTimeout(() => setShowAdminAlert(false), 2500);
      return;
    }
    onShowForm();
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.headerTitle}>{label}</h1>
        <button type="button" className={styles.addBtn} onClick={handleAddClick}>
          + 등록
        </button>
      </header>
      {showAdminAlert && (
        <div className={styles.adminAlert}>관리자만 등록할 수 있어요</div>
      )}
      <main className={styles.content}>
        {/* 위험개소 고정 항목 — 제목 클릭 시 5호선 상구배 단면도 상세로 진입 */}
        {cardKey === 'hazard' && (
          <button type="button" className={styles.pinnedCard} onClick={() => onSelect(LINE5_PROFILE_ID)}>
            <span className={styles.pinnedIcon}><TrendingUp size={22} strokeWidth={2.2} /></span>
            <span className={styles.pinnedText}>
              <span className={styles.pinnedTitle}>5호선 상구배 단면도</span>
              <span className={styles.pinnedSub}>20‰ 초과 오르막 구간 · 가로/세로 보기</span>
            </span>
            <ChevronRight size={18} className={styles.pinnedChevron} aria-hidden />
          </button>
        )}
        {loading && reports.length === 0 ? (
          <div className={styles.loadingState}>
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
          </div>
        ) : reports.length === 0 ? (
          cardKey === 'hazard' ? null : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>{emptyConfig.icon}</span>
              <p className={styles.emptyText}>{emptyConfig.text}</p>
              <p className={styles.emptyHint}>{emptyConfig.hint}</p>
            </div>
          )
        ) : (
          <HazardList onSelect={onSelect} category={category} cardKey={cardKey} />
        )}
      </main>
      <Modal open={showForm} onClose={onCloseForm}>
        {cardKey === 'notice' ? (
          <NoticeForm
            onClose={() => {
              onCloseForm();
              fetchReports(sabun, category);
              onCountsChanged?.();
            }}
          />
        ) : (
          <HazardForm
            cardKey={cardKey}
            onClose={() => {
              onCloseForm();
              fetchReports(sabun, category);
              onCountsChanged?.();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

export default function SafetyWorld({ onBack }: SafetyWorldProps) {
  const [view, setView] = useState<SafetyView>('home');
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [showHazardForm, setShowHazardForm] = useState(false);

  const fetchAlerts = useAlertStore((s) => s.fetch);
  const subscribeAlerts = useAlertStore((s) => s.subscribe);
  const alerts = useAlertStore((s) => s.alerts);
  const fetchHazards = useHazardStore((s) => s.fetchReports);
  const driverSabun = useDriverStore((s) => (s.myDriver)?.s ?? '');
  const driverName = useDriverStore((s) => (s.myDriver)?.n ?? '');
  const authSabun = useAuthStore((s) => s.user?.sabun ?? '');
  const authName = useAuthStore((s) => s.user?.name ?? '');
  const sabun = authSabun || driverSabun;
  const userName = authName || driverName;
  const userRole = getUserRole(sabun);
  const { getUnread, getUnreadIds, unreadAlertIds, alertUnread, markAsRead, markAlertAsRead, fetchCounts } = useSafetyUnread();

  useEffect(() => {
    fetchAlerts();
    fetchHazards(sabun);
    fetchCounts();
    const unsubscribe = subscribeAlerts();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchAlerts();
        fetchHazards(sabun);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchAlerts, fetchHazards, subscribeAlerts, sabun]);

  const goHome = useCallback(() => setView('home'), []);

  // 장애 알림 화면 진입 시 현재 모든 알림을 읽음 처리 (종 카운트 남는 버그 방지)
  useEffect(() => {
    if (view === 'alert' && alerts.length > 0) {
      for (const a of alerts) markAlertAsRead(a.id);
    }
  }, [view, alerts, markAlertAsRead]);

  // 뒤로가기: Level 1 — 비-홈 뷰에서 홈으로
  useHistoryBack('safety-l1', goHome, view !== 'home');

  // 뒤로가기: Level 2 — detail에서 list로
  const isDetail = typeof view === 'object' && view.type === 'detail';
  const goToList = useCallback(() => {
    if (typeof view === 'object' && view.type === 'detail') {
      setView({ type: 'list', category: view.category, cardKey: view.cardKey });
    }
  }, [view]);
  useHistoryBack('safety-l2', goToList, isDetail);


  // ── 안전상식 화면 ──
  if (view === 'tips') {
    return <SafetyTipsView onBack={goHome} />;
  }

  // ── 장애 리스트 화면 ──
  if (view === 'alert') {
    return (
      <div className={styles.wrap}>
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={goHome} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.headerTitle}>장애신고</h1>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setShowAlertForm(true)}
          >
            + 등록
          </button>
        </header>
        <main className={styles.content}>
          <AlertList />
        </main>
        <Modal open={showAlertForm} onClose={() => setShowAlertForm(false)}>
          <AlertForm onClose={() => setShowAlertForm(false)} />
        </Modal>
      </div>
    );
  }

  // ── 상세 화면 (위험/조치/점검 공통) ──
  if (typeof view === 'object' && view.type === 'detail') {
    const backToList = () => setView({ type: 'list', category: view.category, cardKey: view.cardKey });
    // 고정 항목 → 5호선 상구배 단면도
    if (view.id === LINE5_PROFILE_ID) {
      return (
        <SafetyErrorBoundary onBack={backToList}>
          <div className={styles.wrap}>
            <header className={styles.header}>
              <button type="button" className={styles.backBtn} onClick={backToList} aria-label="뒤로가기">
                <ArrowLeft size={20} strokeWidth={2} />
              </button>
              <h1 className={styles.headerTitle}>5호선 상구배 단면도</h1>
            </header>
            <main className={styles.content}>
              <Line5GradientProfile />
            </main>
          </div>
        </SafetyErrorBoundary>
      );
    }
    return (
      <SafetyErrorBoundary onBack={backToList}>
        <HazardDetail reportId={view.id} onBack={backToList} />
      </SafetyErrorBoundary>
    );
  }

  // ── 리스트 화면 (위험/조치/점검 공통) ──
  if (typeof view === 'object' && view.type === 'list') {
    const cat = view.category;
    const cardKey = view.cardKey;
    const display = CARD_DISPLAY[cardKey];
    return (
      <CategoryListView
        category={cat}
        cardKey={cardKey}
        label={display.label}
        emptyConfig={{ icon: display.emptyIcon, text: display.emptyText, hint: display.emptyHint }}
        sabun={sabun}
        onBack={goHome}
        onSelect={(id) => { if (id !== LINE5_PROFILE_ID) markAsRead(id); setView({ type: 'detail', category: cat, cardKey, id }); }}
        onShowForm={() => setShowHazardForm(true)}
        showForm={showHazardForm}
        onCloseForm={() => setShowHazardForm(false)}
        onCountsChanged={fetchCounts}
      />
    );
  }

  // ── 메인 화면 (프로토타입 대시보드) ──
  const totalUnread = alertUnread + getUnread('hazard') + getUnread('action') + getUnread('inspect');

  const handleDashboardCategory = (id: 'incident' | 'driving' | 'train' | 'hazard' | 'tips') => {
    if (id === 'hazard') {
      setView({ type: 'list', category: 'hazard', cardKey: 'hazard' });
    } else if (id === 'incident') {
      setView({ type: 'list', category: 'action', cardKey: 'incident' });
    } else if (id === 'driving') {
      setView({ type: 'list', category: 'inspect', cardKey: 'driving' });
    } else if (id === 'train') {
      setView({ type: 'list', category: 'inspect', cardKey: 'train' });
    } else if (id === 'tips') {
      setView('tips');
    }
  };

  /** 대시보드 카드 클릭 시 해당 리포트 상세보기로 바로 진입 */
  const handleOpenReport = (reportId: string, cardKey: CardKey) => {
    if (reportId !== LINE5_PROFILE_ID) markAsRead(reportId);
    let cat: SafetyCategory;
    if (cardKey === 'hazard') cat = 'hazard';
    else if (cardKey === 'incident') cat = 'action';
    else cat = 'inspect';
    // store에 해당 카테고리 데이터를 미리 적재 → HazardDetail 마운트 시 즉시 report 찾기 가능
    fetchHazards(sabun, cat);
    setView({ type: 'detail', category: cat, cardKey, id: reportId });
  };

  /** 종 버튼 클릭 — 우선순위 높은 미확인 정보로 즉시 이동
   *  우선순위: 위험개소 → 사고사례 → 운전/열차 정보 → 장애신고
   *  각 카테고리 안에서는 최신순(API가 created_at DESC로 반환) */
  const handleBellClick = () => {
    const hazardUnread = getUnreadIds('hazard');
    if (hazardUnread.length > 0) {
      handleOpenReport(hazardUnread[0], 'hazard');
      return;
    }
    const actionUnread = getUnreadIds('action');
    if (actionUnread.length > 0) {
      handleOpenReport(actionUnread[0], 'incident');
      return;
    }
    const inspectUnread = getUnreadIds('inspect');
    if (inspectUnread.length > 0) {
      // inspect는 driving/train/notice 세분화되지만 detail 화면은 공통 → driving cardKey로 진입
      handleOpenReport(inspectUnread[0], 'driving');
      return;
    }
    if (unreadAlertIds.length > 0) {
      setView('alert');
      return;
    }
    // 모두 확인 완료 — 아무 동작 없음 (버튼은 disabled 상태)
  };

  return (
    <SafetyDashboard
      onBack={onBack}
      onOpenCategory={handleDashboardCategory}
      onOpenNotice={() => setView({ type: 'list', category: 'inspect', cardKey: 'notice' })}
      onOpenReport={handleOpenReport}
      onBellClick={handleBellClick}
      unreadCount={totalUnread}
      userName={userName}
      userRole={userRole}
      sabun={sabun}
    />
  );
}
