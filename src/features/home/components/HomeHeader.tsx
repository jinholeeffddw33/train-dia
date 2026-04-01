'use client';

import { useDriverStore } from '@/stores/driver';
import { DOW } from '@/lib/constants';
import { today } from '@/lib/schedule';
import { ChevronDown } from 'lucide-react';
import HeaderClock from './HeaderClock';
import styles from '../styles/Home.module.css';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '늦은 밤이에요 🌙';
  if (h < 9) return '좋은 아침이에요 ☀️';
  if (h < 12) return '오전도 힘내세요 💪';
  if (h < 14) return '점심 맛있게 드세요 🍚';
  if (h < 18) return '오후도 화이팅 🚇';
  if (h < 21) return '오늘도 수고했어요 🌆';
  return '야간 안전운행 하세요 🌙';
}

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
          {driver && <span className={styles.headerGreeting}>{getGreeting()}</span>}
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
              내 계정 보기
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
