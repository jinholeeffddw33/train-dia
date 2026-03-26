'use client';

import { Component, type ReactNode, useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, AlertTriangle, ShieldAlert, Wrench, ClipboardCheck,
} from 'lucide-react';
import { useAlertStore } from '@/stores/alert';
import { useHazardStore } from '@/stores/hazard';
import { useDriverStore } from '@/stores/driver';
import Modal from '@/components/common/Modal';
import AlertList from '@/features/alerts/components/AlertList';
import AlertForm from '@/features/alerts/components/AlertForm';
import HazardList from './components/HazardList';
import HazardForm from './components/HazardForm';
import HazardDetail from './components/HazardDetail';
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

const MENU_ITEMS = [
  { id: 'alert',   label: '장애',   icon: AlertTriangle,  color: 'amber' as const, ready: true },
  { id: 'hazard',  label: '위험',   icon: ShieldAlert,    color: 'red'   as const, ready: true },
  { id: 'action',  label: '조치',   icon: Wrench,         color: 'blue'  as const, ready: false },
  { id: 'inspect', label: '점검',   icon: ClipboardCheck, color: 'green' as const, ready: false },
] as const;

const ICON_COLOR = {
  amber: styles.iconAmber,
  red:   styles.iconRed,
  blue:  styles.iconBlue,
  green: styles.iconGreen,
} as const;

const ICON_BG = {
  amber: styles.iconBgAmber,
  red:   styles.iconBgRed,
  blue:  styles.iconBgBlue,
  green: styles.iconBgGreen,
} as const;

type SafetyView =
  | 'home'
  | 'alert'
  | 'hazard'
  | { type: 'hazard-detail'; id: string };

export default function SafetyWorld({ onBack }: SafetyWorldProps) {
  const [view, setView] = useState<SafetyView>('home');
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [showHazardForm, setShowHazardForm] = useState(false);

  const fetchAlerts = useAlertStore((s) => s.fetch);
  const subscribeAlerts = useAlertStore((s) => s.subscribe);
  const fetchHazards = useHazardStore((s) => s.fetchReports);
  const sabun = useDriverStore((s) => (s.myDriver ?? s.current)?.s ?? '');

  useEffect(() => {
    fetchAlerts();
    fetchHazards(sabun);
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

  const handleMenu = (id: string) => {
    switch (id) {
      case 'alert':  setView('alert'); break;
      case 'hazard': setView('hazard'); break;
      default: break; // 준비 중
    }
  };

  // ── 장애 리스트 화면 ──
  if (view === 'alert') {
    return (
      <div className={styles.wrap}>
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={goHome} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.headerTitle}>장애 알림</h1>
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

  // ── 위험요소 상세 ──
  if (typeof view === 'object' && view.type === 'hazard-detail') {
    return (
      <SafetyErrorBoundary onBack={() => setView('hazard')}>
        <HazardDetail
          reportId={view.id}
          onBack={() => setView('hazard')}
        />
      </SafetyErrorBoundary>
    );
  }

  // ── 위험요소 리스트 화면 ──
  if (view === 'hazard') {
    return (
      <div className={styles.wrap}>
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={goHome} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.headerTitle}>위험요소</h1>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setShowHazardForm(true)}
          >
            + 등록
          </button>
        </header>
        <main className={styles.content}>
          <HazardList onSelect={(id) => setView({ type: 'hazard-detail', id })} />
        </main>
        <Modal open={showHazardForm} onClose={() => setShowHazardForm(false)}>
          <HazardForm onClose={() => setShowHazardForm(false)} />
        </Modal>
      </div>
    );
  }

  // ── 메인 화면 (히어로 + 4아이콘) ──
  return (
    <div className={styles.wrap}>
      {/* 히어로 배너 */}
      <div className={styles.heroBanner}>
        <button type="button" className={styles.heroBackBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div className={styles.heroHaze} />

        <h1 className={styles.heroTitle}>Safety<br />Management</h1>
        <p className={styles.heroSub}>SEOUL METRO · LINE 5</p>
        <p className={styles.heroDesc}>5호선 안전 관리 시스템</p>

        {/* 안전 심볼 + 곡선 */}
        <div className={styles.heroVisual}>
          <svg viewBox="0 0 380 100" className={styles.heroLineSvg} fill="none">
            <path
              d="M-10 50C60 58 120 65 190 50C260 35 320 55 392 48"
              stroke="url(#safetyLineGlow)"
              strokeWidth="16"
              strokeLinecap="round"
              opacity="0.12"
            />
            <path
              d="M-10 50C60 58 120 65 190 50C260 35 320 55 392 48"
              stroke="url(#safetyLineMain)"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="safetyLineMain" x1="0" y1="0" x2="380" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f59e0b" />
                <stop offset="0.5" stopColor="#ef4444" />
                <stop offset="1" stopColor="#f59e0b" />
              </linearGradient>
              <linearGradient id="safetyLineGlow" x1="0" y1="0" x2="380" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fbbf24" />
                <stop offset="1" stopColor="#fca5a5" />
              </linearGradient>
            </defs>
          </svg>

          <div className={styles.heroBigBadge}>
            <div className={styles.heroBigIcon}>
              <ShieldAlert size={36} />
            </div>
          </div>
        </div>

        <div className={styles.heroFade} />
      </div>

      {/* 4개 아이콘 메뉴 */}
      <div className={styles.menuContent}>
        <div className={styles.menuGrid}>
          {MENU_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.menuItem} ${!item.ready ? styles.menuItemDisabled : ''}`}
                onClick={() => item.ready && handleMenu(item.id)}
                disabled={!item.ready}
              >
                <div className={`${styles.menuIcon} ${ICON_BG[item.color]}`}>
                  <Icon size={26} className={ICON_COLOR[item.color]} />
                </div>
                <span className={styles.menuLabel}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
