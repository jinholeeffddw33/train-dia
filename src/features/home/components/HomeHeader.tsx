'use client';

import { useDriverStore } from '@/stores/driver';
import { DOW } from '@/lib/constants';
import { today } from '@/lib/schedule';
import { ChevronDown, RotateCw } from 'lucide-react';
import HeaderClock from './HeaderClock';
import { getUserRole } from '@/lib/auth';
import styles from '../styles/Home.module.css';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '편안한 밤 되세요 🌙';
  if (h < 9) return '좋은 아침이에요 ☀️';
  if (h < 12) return '오전도 힘내세요 💪';
  if (h < 14) return '점심 맛있게 드세요 🍚';
  if (h < 18) return '오후도 화이팅 🚇';
  if (h < 21) return '좋은 저녁이에요 🌆';
  return '오늘도 고생 많았어요 🌙';
}

interface HomeHeaderProps {
  onDriverClick?: () => void;
}

export default function HomeHeader({ onDriverClick }: HomeHeaderProps) {
  const driver = useDriverStore((s) => s.current);
  const isViewMode = useDriverStore((s) => s.isViewMode);
  const backToMe = useDriverStore((s) => s.backToMe);
  const myDriver = useDriverStore((s) => s.myDriver);
  const td = today();
  const dow = DOW[td.getDay()];
  const dateStr = `${td.getMonth() + 1}월 ${td.getDate()}일 (${dow})`;

  const handleRefresh = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  return (
    <header className={`${styles.headerSection} z-app-header`}>
      <button
        type="button"
        className={styles.refreshBtn}
        onClick={handleRefresh}
        aria-label="새로고침"
        title="새로고침"
      >
        <RotateCw size={13} strokeWidth={2.2} />
      </button>
      <div className={styles.headerTop}>
        {/* 왼쪽: 인사말 + 이름 */}
        <div className={styles.headerLeft}>
          {driver && (
            <span className={styles.headerGreeting}>
              {isViewMode ? `${myDriver?.n ?? '내'} 계정으로 보는 중` : getGreeting()}
            </span>
          )}
          <button
            type="button"
            className={styles.headerNameBtn}
            onClick={onDriverClick}
            aria-label="기관사 선택"
          >
            {driver ? (
              <span className={styles.headerName}>
                {driver.n} <span className={styles.headerRole}>{getUserRole(driver.s)}</span>
                <ChevronDown size={16} className={styles.headerChevron} />
              </span>
            ) : (
              <span className={styles.headerName}>
                기관사 선택 <ChevronDown size={16} className={styles.headerChevron} />
              </span>
            )}
          </button>
          {isViewMode && myDriver && (
            <button
              type="button"
              className={styles.viewModeBadge}
              onClick={backToMe}
              aria-label="내 스케줄로 돌아가기"
            >
              ← 돌아가기 ({myDriver.n})
            </button>
          )}
        </div>
        {/* 오른쪽: 날짜 + 시계 + 사업소 */}
        <div className={styles.headerRight}>
          <span className={styles.headerDate}>{dateStr}</span>
          <div className={styles.clockRow}>
            <HeaderClock />
          </div>
        </div>
      </div>
    </header>
  );
}
