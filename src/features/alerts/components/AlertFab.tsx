'use client';

import { useState } from 'react';
import { useAlertStore } from '@/stores/alert';
import Modal from '@/components/common/Modal';
import AlertList from './AlertList';
import AlertForm from './AlertForm';
import styles from '../styles/Alerts.module.css';

export default function AlertFab() {
  const [view, setView] = useState<'closed' | 'list' | 'form'>('closed');
  const alertCount = useAlertStore((s) => s.alerts.length);

  return (
    <>
      {/* FAB 버튼 */}
      <button
        type="button"
        className={styles.fab}
        onClick={() => setView('list')}
        aria-label={`장애 알림 ${alertCount}건`}
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
