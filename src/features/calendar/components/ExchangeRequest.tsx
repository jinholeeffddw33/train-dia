'use client';

import { useState, useMemo, useCallback } from 'react';
import { X, Calendar, Search } from 'lucide-react';
import { useDriverStore } from '@/stores/driver';
import { getDia, getType, getDiaDisplay } from '@/lib/schedule';
import { DOW } from '@/lib/constants';
import { P } from '@/data/cycle';
import type { Person } from '@/lib/types';
import styles from '../styles/Exchange.module.css';

const WISH_TYPES = ['주간', '야간', '비번', '휴무'] as const;
type WishType = typeof WISH_TYPES[number];

interface ExchangeRequestProps {
  open: boolean;
  onClose: () => void;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`;
}

/** WishType → DiaType/dia 패턴 매칭 */
function matchesWish(dia: string, wish: WishType): boolean {
  const type = getType(dia);
  switch (wish) {
    case '주간': return type === 'day';
    case '야간': return type === 'night' || (type === 'standby' && parseInt(dia.replace('대', '')) >= 61);
    case '비번': return dia.endsWith('~');
    case '휴무': return dia.startsWith('휴');
  }
}

export default function ExchangeRequest({ open, onClose }: ExchangeRequestProps) {
  const driver = useDriverStore((s) => s.current);
  const todayStr = toISODate(new Date());

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [wishes, setWishes] = useState<Record<string, WishType>>({});
  const [memo, setMemo] = useState('');
  const [searched, setSearched] = useState(false);

  // 시작일~종료일 날짜 배열 (최대 7일)
  const dateRange = useMemo(() => {
    const start = fromISODate(startDate);
    const end = fromISODate(endDate);
    if (end < start) return [];
    const dates: Date[] = [];
    const d = new Date(start);
    while (d <= end && dates.length < 7) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate]);

  // 희망 근무 선택
  const handleWish = useCallback((dateKey: string, type: WishType) => {
    setWishes(prev => {
      if (prev[dateKey] === type) {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      }
      return { ...prev, [dateKey]: type };
    });
    setSearched(false);
  }, []);

  // 매칭 검색: 전체 인원 중 해당 기간에 원하는 패턴과 일치하는 사람 찾기
  const matchResults = useMemo(() => {
    if (!searched) return [];
    const wishEntries = Object.entries(wishes);
    if (wishEntries.length === 0) return [];

    return P.filter(p => {
      if (driver && p.I === driver.I) return false; // 자기 자신 제외
      return wishEntries.every(([dateStr, wish]) => {
        const date = fromISODate(dateStr);
        const dia = getDia(p, date);
        return matchesWish(dia, wish);
      });
    });
  }, [searched, wishes, driver]);

  const handleSearch = () => {
    setSearched(true);
  };

  const wishCount = Object.keys(wishes).length;

  if (!open) return null;

  return (
    <div className={styles.overlay}>
      {/* 헤더 */}
      <div className={styles.header}>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
          <X size={22} />
        </button>
        <h2 className={styles.title}>교체 희망</h2>
        <div className={styles.spacer} />
      </div>

      <div className={styles.body}>
        {/* 날짜 선택 */}
        <div className={styles.dateRow}>
          <span className={styles.dateLabel}>희망일</span>
          <label className={styles.dateBtn}>
            <Calendar size={14} />
            <span>{formatShort(fromISODate(startDate))}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value > endDate) setEndDate(e.target.value);
                setSearched(false);
              }}
              className={styles.dateInput}
            />
          </label>
          <span className={styles.dateSep}>~</span>
          <label className={styles.dateBtn}>
            <Calendar size={14} />
            <span>{formatShort(fromISODate(endDate))}</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSearched(false);
              }}
              className={styles.dateInput}
            />
          </label>
        </div>

        {/* 교체 희망 근무 */}
        <h3 className={styles.sectionTitle}>교체 희망 근무</h3>

        <div className={styles.dayList}>
          {dateRange.map((date) => {
            const key = toISODate(date);
            const dia = driver ? getDia(driver, date) : '-';
            const type = getType(dia);
            const display = getDiaDisplay(dia);
            const selected = wishes[key];

            return (
              <div key={key} className={styles.dayRow}>
                <div className={styles.dayInfo}>
                  <span className={styles.dayDate}>{formatShort(date)}</span>
                  <span className={`${styles.dayDia} ${styles[`dia_${type}`]}`}>{display}</span>
                </div>
                <div className={styles.wishBtns}>
                  {WISH_TYPES.map((wt) => (
                    <button
                      key={wt}
                      type="button"
                      className={`${styles.wishBtn} ${selected === wt ? styles[`wish_${wt}`] : ''}`}
                      onClick={() => handleWish(key, wt)}
                    >
                      {wt}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {dateRange.length === 0 && (
          <p className={styles.hint}>시작일과 종료일을 선택하세요</p>
        )}

        {/* 검색 버튼 */}
        {wishCount > 0 && (
          <button
            type="button"
            className={styles.searchBtn}
            onClick={handleSearch}
          >
            <Search size={18} />
            매칭되는 기관사 찾기
          </button>
        )}

        {/* 매칭 결과 */}
        {searched && (
          <div className={styles.resultSection}>
            <h3 className={styles.sectionTitle}>
              매칭 결과 <span className={styles.resultCount}>{matchResults.length}명</span>
            </h3>
            {matchResults.length === 0 ? (
              <p className={styles.noResult}>조건에 맞는 기관사가 없어요</p>
            ) : (
              <div className={styles.resultList}>
                {matchResults.map((p) => (
                  <MatchCard key={p.I} person={p} dateRange={dateRange} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 메모 */}
        <div className={styles.memoSection}>
          <h3 className={styles.sectionTitle}>메모</h3>
          <textarea
            className={styles.memoInput}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="교체 사유나 참고 사항을 적어주세요"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}

/** 매칭된 기관사 카드 */
function MatchCard({ person, dateRange }: { person: Person; dateRange: Date[] }) {
  return (
    <div className={styles.matchCard}>
      <div className={styles.matchHeader}>
        <span className={styles.matchAvatar}>{person.n[0]}</span>
        <span className={styles.matchName}>{person.n}</span>
      </div>
      <div className={styles.matchDias}>
        {dateRange.map((date) => {
          const key = toISODate(date);
          const dia = getDia(person, date);
          const type = getType(dia);
          const display = getDiaDisplay(dia);
          return (
            <div key={key} className={styles.matchDay}>
              <span className={styles.matchDayLabel}>{formatShort(date)}</span>
              <span className={`${styles.matchDayDia} ${styles[`dia_${type}`]}`}>{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
