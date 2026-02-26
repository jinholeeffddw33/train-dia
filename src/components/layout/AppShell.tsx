'use client';

import { useState, useCallback } from 'react';
import TabBar, { type TabId } from './TabBar';
import ToastContainer from '../common/Toast';
import { useAlertStore } from '@/stores/alert';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: (activeTab: TabId) => React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const alertCount = useAlertStore((s) => s.alerts.length);

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div className={styles.shell}>
      <main className={styles.content}>
        {children(activeTab)}
      </main>
      <TabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        alertCount={alertCount}
      />
      <ToastContainer />
    </div>
  );
}
