'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAlertStore } from '@/stores/alert';
import { useHazardStore } from '@/stores/hazard';
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

type SafetyView = 'main' | { type: 'hazard'; id: string };

export default function SafetyWorld({ onBack }: SafetyWorldProps) {
  const [view, setView] = useState<SafetyView>('main');
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [showHazardForm, setShowHazardForm] = useState(false);

  const fetchAlerts = useAlertStore((s) => s.fetch);
  const subscribeAlerts = useAlertStore((s) => s.subscribe);
  const fetchHazards = useHazardStore((s) => s.fetchReports);

  useEffect(() => {
    fetchAlerts();
    fetchHazards();
    const unsubscribe = subscribeAlerts();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchAlerts();
        fetchHazards();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchAlerts, fetchHazards, subscribeAlerts]);

  // 위험요소 상세 화면
  if (view !== 'main' && view.type === 'hazard') {
    return (
      <HazardDetail
        reportId={view.id}
        onBack={() => setView('main')}
      />
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={onBack}
          aria-label="세계 선택으로 돌아가기"
        >
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.title}>안전</h1>
      </header>

      <main className={styles.content}>
        {/* ── 장애 알림 섹션 ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>🚨 장애 알림</h2>
            <button
              type="button"
              className={styles.sectionAddBtn}
              onClick={() => setShowAlertForm(true)}
            >
              + 등록
            </button>
          </div>
          <AlertList />
        </section>

        <div className={styles.sectionDivider} />

        {/* ── 위험요소 섹션 ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>⚠️ 위험요소</h2>
            <button
              type="button"
              className={styles.sectionAddBtn}
              onClick={() => setShowHazardForm(true)}
            >
              + 등록
            </button>
          </div>
          <HazardList onSelect={(id) => setView({ type: 'hazard', id })} />
        </section>
      </main>

      {/* 장애 등록 모달 */}
      <Modal open={showAlertForm} onClose={() => setShowAlertForm(false)}>
        <AlertForm onClose={() => setShowAlertForm(false)} />
      </Modal>

      {/* 위험요소 등록 모달 */}
      <Modal open={showHazardForm} onClose={() => setShowHazardForm(false)}>
        <HazardForm onClose={() => setShowHazardForm(false)} />
      </Modal>
    </div>
  );
}
