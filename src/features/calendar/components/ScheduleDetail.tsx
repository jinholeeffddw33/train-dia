'use client';

import { useMemo } from 'react';
import { useDriverStore } from '@/stores/driver';
import { useMemoStore } from '@/stores/memo';
import { getDia, getType, getSchedule, getLabel, getDiaDisplay, getWorkTime } from '@/lib/schedule';
import { DOW } from '@/lib/constants';
import styles from '../styles/Calendar.module.css';

interface ScheduleDetailProps {
  dateStr: string;
}

export default function ScheduleDetail({ dateStr }: ScheduleDetailProps) {
  const driver = useDriverStore((s) => s.current);
  const { getMemo, setMemo, removeMemo } = useMemoStore();

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dow = DOW[date.getDay()];

  const info = useMemo(() => {
    if (!driver) return null;
    const dia = getDia(driver, date);
    const type = getType(dia);
    const schedule = getSchedule(dia, date);
    return { dia, type, display: getDiaDisplay(dia), label: getLabel(dia), schedule };
  }, [driver, dateStr]);

  const memo = getMemo(dateStr);

  if (!info) return null;

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <span className={styles.detailDate}>{month}월 {day}일 ({dow})</span>
        <span className={`${styles.detailBadge} ${styles[`detailType_${info.type}`]}`}>
          {info.display}
        </span>
        <span className={styles.detailLabel}>{info.label}</span>
      </div>

      {info.schedule && (
        <div className={styles.detailSchedule}>
          <div className={styles.detailTimeRow}>
            <div className={styles.detailTimeItem}>
              <span className={styles.detailTimeLabel}>출근</span>
              <span className={styles.detailTimeValue}>{info.schedule.s}</span>
            </div>
            <div className={styles.detailTimeItem}>
              <span className={styles.detailTimeLabel}>퇴근</span>
              <span className={styles.detailTimeValue}>{info.schedule.e}</span>
            </div>
            <div className={styles.detailTimeItem}>
              <span className={styles.detailTimeLabel}>근무</span>
              <span className={styles.detailTimeValue}>{getWorkTime(info.schedule)}</span>
            </div>
          </div>
          {info.schedule.m && (
            <p className={styles.detailRoute}>{info.schedule.m}</p>
          )}
        </div>
      )}

      {/* 메모 */}
      <div className={styles.memoSection}>
        <label className={styles.memoLabel} htmlFor={`memo-${dateStr}`}>메모</label>
        <textarea
          id={`memo-${dateStr}`}
          className={styles.memoInput}
          placeholder="이 날짜에 대한 메모..."
          value={memo}
          onChange={(e) => {
            const v = e.target.value;
            if (v.trim()) setMemo(dateStr, v);
            else removeMemo(dateStr);
          }}
          rows={2}
        />
      </div>
    </div>
  );
}
