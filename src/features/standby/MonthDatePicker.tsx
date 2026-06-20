'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './StandbyCoverage.module.css';

interface Props {
  /** 선택된 날짜 (YYYY-MM-DD) */
  value: string;
  onChange: (dateStr: string) => void;
  /** 추천 날짜 (YYYY-MM-DD) — 작은 점으로 표시 */
  recommended?: string;
}

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}
function todayStr(): string {
  const t = new Date();
  return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

export default function MonthDatePicker({ value, onChange, recommended }: Props) {
  // 표시 중인 달 — 선택값 기준으로 시작
  const initial = useMemo(() => {
    const [y, m] = value.split('-').map(Number);
    return { y: y || new Date().getFullYear(), m: m || new Date().getMonth() + 1 };
  }, [value]);
  const [view, setView] = useState(initial);

  const today = todayStr();

  const goPrev = useCallback(() => {
    setView((v) => (v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 }));
  }, []);
  const goNext = useCallback(() => {
    setView((v) => (v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 }));
  }, []);

  const cells = useMemo(() => {
    const firstDow = new Date(view.y, view.m - 1, 1).getDay();
    const daysInMonth = new Date(view.y, view.m, 0).getDate();
    const list: Array<{ key: string; d: number | null; dateStr?: string; dow?: number }> = [];
    for (let i = 0; i < firstDow; i++) list.push({ key: `e${i}`, d: null });
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ key: ymd(view.y, view.m, d), d, dateStr: ymd(view.y, view.m, d), dow: (firstDow + d - 1) % 7 });
    }
    return list;
  }, [view]);

  return (
    <div className={styles.mdp}>
      {/* 월 이동 헤더 */}
      <div className={styles.mdpHeader}>
        <button type="button" className={styles.mdpNavBtn} onClick={goPrev} aria-label="이전 달">
          <ChevronLeft size={20} strokeWidth={2.4} />
        </button>
        <span className={styles.mdpMonthLabel}>{view.y}년 {view.m}월</span>
        <button type="button" className={styles.mdpNavBtn} onClick={goNext} aria-label="다음 달">
          <ChevronRight size={20} strokeWidth={2.4} />
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className={styles.mdpGrid}>
        {DOW_LABELS.map((dow, i) => (
          <div
            key={dow}
            className={`${styles.mdpDow} ${i === 0 ? styles.mdpSun : ''} ${i === 6 ? styles.mdpSat : ''}`}
          >
            {dow}
          </div>
        ))}

        {/* 날짜 셀 */}
        {cells.map((cell) =>
          cell.d === null ? (
            <div key={cell.key} className={styles.mdpEmpty} />
          ) : (
            <button
              key={cell.key}
              type="button"
              className={[
                styles.mdpCell,
                cell.dateStr === value ? styles.mdpCellSelected : '',
                cell.dateStr === today ? styles.mdpCellToday : '',
                cell.dow === 0 ? styles.mdpSun : '',
                cell.dow === 6 ? styles.mdpSat : '',
              ].filter(Boolean).join(' ')}
              onClick={() => cell.dateStr && onChange(cell.dateStr)}
              aria-label={`${view.m}월 ${cell.d}일`}
              aria-pressed={cell.dateStr === value}
              aria-current={cell.dateStr === today ? 'date' : undefined}
            >
              {cell.d}
              {cell.dateStr === recommended && cell.dateStr !== value && (
                <span className={styles.mdpRecommendDot} aria-hidden />
              )}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
