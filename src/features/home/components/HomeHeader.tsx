'use client';

import { useDriverStore } from '@/stores/driver';
import { DOW } from '@/lib/constants';
import { today } from '@/lib/schedule';
import { Bell, ChevronDown, RotateCw } from 'lucide-react';
import { getUserRole } from '@/lib/auth';
import styles from '../styles/Home.module.css';

function getSubtitle(): string {
  const h = new Date().getHours();
  if (h < 6) return '편안한 밤 되세요';
  if (h < 9) return '오늘도 안전운행 하세요!';
  if (h < 12) return '오전도 힘내세요';
  if (h < 14) return '점심 맛있게 드세요';
  if (h < 18) return '오늘도 안전운행 하세요!';
  if (h < 21) return '오늘도 수고하셨어요';
  return '오늘도 고생 많았어요';
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
  const dateStr = `${String(td.getMonth() + 1).padStart(2, '0')}.${String(td.getDate()).padStart(2, '0')} ${dow}요일`;

  const handleRefresh = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  return (
    <header className={styles.headerSection}>
      <div className={styles.headerTopRow}>
        <button
          type="button"
          className={styles.headerGreetingBtn}
          onClick={onDriverClick}
          aria-label="기관사 선택"
        >
          {driver ? (
            <>
              <span className={styles.headerGreetingText}>
                {isViewMode ? `${myDriver?.n ?? '내'} 계정으로 보는 중` : '안녕하세요,'}
              </span>
              {!isViewMode && (
                <span className={styles.headerNameInline}>
                  {driver.n} <span className={styles.headerRoleInline}>{getUserRole(driver.s)}</span>
                </span>
              )}
              <ChevronDown size={14} className={styles.headerChevronInline} />
            </>
          ) : (
            <>
              <span className={styles.headerGreetingText}>안녕하세요,</span>
              <span className={styles.headerNameInline}>기관사 선택</span>
              <ChevronDown size={14} className={styles.headerChevronInline} />
            </>
          )}
        </button>

        <div className={styles.headerTopActions}>
          <button
            type="button"
            className={styles.headerIconBtn}
            onClick={handleRefresh}
            aria-label="새로고침"
            title="새로고침"
          >
            <RotateCw size={18} strokeWidth={2.1} />
          </button>
          <span className={styles.headerIconBtn} aria-hidden>
            <Bell size={18} strokeWidth={2.1} />
          </span>
        </div>
      </div>

      <h1 className={styles.headerOrgTitle}>답십리 승무사업소</h1>

      <p className={styles.headerSubtitle}>{getSubtitle()}</p>

      <div className={styles.headerMetaRow}>
        <span className={styles.headerDate}>{dateStr}</span>
      </div>

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
    </header>
  );
}
