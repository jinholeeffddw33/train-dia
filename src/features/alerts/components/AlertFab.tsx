'use client';

import { useState, useEffect } from 'react';
import { useAlertStore } from '@/stores/alert';
import Modal from '@/components/common/Modal';
import AlertList from './AlertList';
import AlertForm from './AlertForm';
import styles from '../styles/Alerts.module.css';

export default function AlertFab() {
  const [view, setView] = useState<'closed' | 'list' | 'form'>('closed');
  const alerts = useAlertStore((s) => s.alerts);
  const alertCount = alerts.length;
  const hasUrgent = alerts.some((a) => a.severity === 'high');
  const hasMedium = !hasUrgent && alerts.some((a) => a.severity === 'medium');
  const hasLow = !hasUrgent && !hasMedium && alertCount > 0;
  const fetch = useAlertStore((s) => s.fetch);
  const subscribe = useAlertStore((s) => s.subscribe);

  // 마운트 시 서버에서 알림 가져오기 + 실시간 구독
  useEffect(() => {
    fetch();
    let unsubscribe = subscribe();

    // PWA 백그라운드 → 포그라운드 복귀 시 재연결
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetch();
        unsubscribe();
        unsubscribe = subscribe();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetch, subscribe]);

  return (
    <>
      {/* FAB 버튼 */}
      <button
        type="button"
        className={`${styles.fab} ${hasUrgent ? styles.fabUrgent : hasMedium ? styles.fabMedium : hasLow ? styles.fabLow : ''}`}
        onClick={() => setView('list')}
        aria-label={`장애 알림 ${alertCount}건${hasUrgent ? ' (긴급)' : ''}`}
      >
        <span className={styles.fabIcon}>⚠</span>
        {alertCount > 0 && (
          <span className={styles.fabBadge}>{alertCount}</span>
        )}
      </button>

      {/* 알림 목록 모달 */}
      <Modal
        open={view === 'list'}
        onClose={() => setView('closed')}
      >
        <AlertList onClose={() => setView('closed')} />
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setView('form')}
        >
          + 장애 등록
        </button>
      </Modal>

      {/* 등록 폼 모달 */}
      <Modal
        open={view === 'form'}
        onClose={() => setView('list')}
      >
        <AlertForm onClose={() => setView('list')} />
      </Modal>
    </>
  );
}
