'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useDriverStore } from '@/stores/driver';
import { getDia, getType, getDiaDisplay, today } from '@/lib/schedule';
import { DOW } from '@/lib/constants';
import styles from '../styles/Home.module.css';

interface WeekStripProps {
  selectedDate?: Date;
  onSelectDate?: (date: Date | undefined) => void;
}

/** 14일 주간 스트립 */
export default function WeekStrip({ selectedDate, onSelectDate }: WeekStripProps) {
  const driver = useDriverStore((s) => s.current);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);

  const td = today();

  const days = useMemo(() => {
    if (!driver) return [];
    // 이번 주 일요일부터 2주(14일) 표시
    const sun = new Date(td);
    sun.setDate(sun.getDate() - sun.getDay());
    const result = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(sun);
      d.setDate(d.getDate() + i);
      const dia = getDia(driver, d);
      const type = getType(dia);
      result.push({
        date: d,
        day: d.getDate(),
        dow: DOW[d.getDay()],
        dia,
        display: getDiaDisplay(dia),
        type,
        isToday: d.toDateString() === td.toDateString(),
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
      });
    }
    return result;
  }, [driver]);

  // 오늘 위치로 자동 스크롤
  useEffect(() => {
    if (todayRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = todayRef.current;
      container.scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
    }
  }, [days]);

  if (!driver) return null;

  const handleSelect = (d: { date: Date; isToday: boolean }) => {
    if (!onSelectDate) return;
    // 오늘 클릭 시 선택 해제 (기본 상태 복원)
    if (d.isToday) {
      onSelectDate(undefined);
      return;
    }
    onSelectDate(d.date);
  };

  const isSelected = (d: Date) => {
    if (!selectedDate) return false;
    return d.toDateString() === selectedDate.toDateString();
  };

  // selectedDate가 있으면 오늘 강조 숨김 (선택한 날짜만 강조)
  const hasSelection = selectedDate && selectedDate.toDateString() !== today().toDateString();

  return (
    <section className={styles.weekSection}>
      <h3 className={styles.sectionTitle}>주간 일정</h3>
      <div ref={scrollRef} className={styles.weekScroll}>
        {days.map((d, i) => {
          const selected = isSelected(d.date);
          const showToday = d.isToday && !hasSelection;
          return (
            <button
              key={i}
              type="button"
              ref={d.isToday ? todayRef : undefined}
              className={`${styles.weekDay} ${showToday ? styles.weekDayToday : ''} ${selected ? styles.weekDaySelected : ''} ${styles[`weekType_${d.type}`]}`}
              aria-label={`${d.date.getMonth() + 1}월 ${d.day}일 ${d.dow}요일 ${d.display}`}
              aria-current={d.isToday ? 'date' : undefined}
              onClick={() => handleSelect(d)}
            >
              <span className={`${styles.weekDow} ${d.isWeekend ? styles.weekDowWeekend : ''}`}>
                {d.dow}
              </span>
              <span className={styles.weekDate}>{d.day}</span>
              <span className={styles.weekDia}>{d.display}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
