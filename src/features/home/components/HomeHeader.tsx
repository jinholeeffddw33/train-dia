'use client';

import { useDriverStore } from '@/stores/driver';
import { DOW } from '@/lib/constants';
import { today } from '@/lib/schedule';
import { ChevronDown } from 'lucide-react';
import HeaderClock from './HeaderClock';
import styles from '../styles/Home.module.css';

interface HomeHeaderProps {
  onDriverClick?: () => void;
}

export default function HomeHeader({ onDriverClick }: HomeHeaderProps) {
  const driver = useDriverStore((s) => s.current);
  const isViewMode = useDriverStore((s) => s.isViewMode);
  const backToMe = useDriverStore((s) => s.backToMe);
  const td = today();
  const dow = DOW[td.getDay()];
  const dateStr = `${td.getMonth() + 1}월 ${td.getDate()}일 (${dow})`;

  return (
    <header className={styles.headerSection}>
      <div className={styles.headerTop}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.headerNameBtn}
            onClick={onDriverClick}
            aria-label="기관사 선택"
          >
            {driver ? (
              <span className={styles.headerName}>
                {driver.n} <span className={styles.headerRole}>기관사님</span>
                <ChevronDown size={14} className={styles.headerChevron} />
              </span>
            ) : (
              <span className={styles.headerName}>
                기관사 선택 <ChevronDown size={14} className={styles.headerChevron} />
              </span>
            )}
          </button>
          {isViewMode && (
            <button type="button" className={styles.viewModeBadge} onClick={backToMe}>
              조회 중 · 내 보기로 돌아가기
            </button>
          )}
          <span className={styles.headerDate}>{dateStr}</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.clockRow}>
            <HeaderClock />
          </div>
          <span className={styles.headerOrg}>답십리승무사업소</span>
        </div>
      </div>
    </header>
  );
}
