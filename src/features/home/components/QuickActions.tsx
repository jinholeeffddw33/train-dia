'use client';

import { TrainFront, Search } from 'lucide-react';
import styles from '../styles/Home.module.css';

interface QuickActionsProps {
  onCommuteOpen?: () => void;
  onSubwaySearch?: () => void;
}

export default function QuickActions({ onCommuteOpen, onSubwaySearch }: QuickActionsProps) {
  if (!onCommuteOpen && !onSubwaySearch) return null;

  return (
    <div className={styles.quickActionsBottom}>
      {onCommuteOpen && (
        <button type="button" className={styles.quickBtnBottom} onClick={onCommuteOpen}>
          <TrainFront size={18} strokeWidth={2} />
          <span className={styles.quickLabel}>도착 정보</span>
        </button>
      )}
      {onSubwaySearch && (
        <button type="button" className={styles.quickBtnBottom} onClick={onSubwaySearch}>
          <Search size={18} strokeWidth={2} />
          <span className={styles.quickLabel}>경로 검색</span>
        </button>
      )}
    </div>
  );
}
