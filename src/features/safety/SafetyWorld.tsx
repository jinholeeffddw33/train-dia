'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAlertStore } from '@/stores/alert';
import Modal from '@/components/common/Modal';
import AlertList from '@/features/alerts/components/AlertList';
import AlertForm from '@/features/alerts/components/AlertForm';
import styles from './SafetyWorld.module.css';

interface SafetyWorldProps {
  onBack: () => void;
}

export default function SafetyWorld({ onBack }: SafetyWorldProps) {
  const [showForm, setShowForm] = useState(false);
  const fetch = useAlertStore((s) => s.fetch);
  const subscribe = useAlertStore((s) => s.subscribe);

  useEffect(() => {
    fetch();
    const unsubscribe = subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetch, subscribe]);

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
        <AlertList />
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setShowForm(true)}
        >
          + 장애 등록
        </button>
      </main>

      <Modal open={showForm} onClose={() => setShowForm(false)}>
        <AlertForm onClose={() => setShowForm(false)} />
      </Modal>
    </div>
  );
}
