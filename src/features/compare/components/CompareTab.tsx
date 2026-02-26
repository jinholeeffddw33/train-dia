'use client';

import { useState, useMemo } from 'react';
import { useCompareStore } from '@/stores/compare';
import { P as P_RAW } from '@/data/cycle';

const P_SORTED = [...P_RAW].sort((a, b) => a.n.localeCompare(b.n, 'ko'));
import { getDia, getType, getDiaDisplay } from '@/lib/schedule';
import { DOW } from '@/lib/constants';
import Modal from '@/components/common/Modal';
import type { Person } from '@/lib/types';
import styles from '../styles/Compare.module.css';

const COUNT_OPTIONS = [2, 3, 4, 5] as const;

export default function CompareTab() {
  const { count, persons, year, month, setCount, setPerson, prevMonth, nextMonth, resetMonth } = useCompareStore();
  const [selectorTarget, setSelectorTarget] = useState<number | null>(null);

  const daysInMonth = new Date(year, month, 0).getDate();

  const rows = useMemo(() => {
    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dow = DOW[date.getDay()];
      const isSun = date.getDay() === 0;
      const isSat = date.getDay() === 6;

      const dias = persons.map((p) => (p ? getDia(p, date) : null));
      const types = dias.map((dia) => (dia ? getType(dia) : null));
      const disps = dias.map((dia) => (dia ? getDiaDisplay(dia) : ''));

      // 모든 선택된 인원이 쉬는 날이면 하이라이트
      const filledCount = types.filter((t) => t !== null).length;
      const allRest = filledCount >= 2 && types.every((t) => t === null || t === 'rest');

      result.push({ d, dow, isSun, isSat, disps, types, allRest });
    }
    return result;
  }, [persons, year, month, daysInMonth]);

  const handleSelect = (person: Person) => {
    if (selectorTarget !== null) {
      setPerson(selectorTarget, person);
    }
    setSelectorTarget(null);
  };

  const hasAnyPerson = persons.some((p) => p !== null);

  // 동적 grid columns: 날짜 + N명
  const gridCols = `1fr ${'1fr '.repeat(count).trim()}`;

  return (
    <div className={styles.container}>
      {/* 인원 수 선택 */}
      <div className={styles.countSelector}>
        <span className={styles.countLabel}>비교 인원</span>
        <div className={styles.countChips}>
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.countChip} ${count === n ? styles.countChipActive : ''}`}
              onClick={() => setCount(n)}
            >
              {n}명
            </button>
          ))}
        </div>
      </div>

      {/* 기관사 선택 카드 */}
      <div className={styles.selectorRow}>
        {persons.map((person, idx) => (
          <button
            key={idx}
            type="button"
            className={`${styles.personCard} ${person ? styles.personCardFilled : ''}`}
            onClick={() => setSelectorTarget(idx)}
          >
            {person ? (
              <>
                <span className={styles.personCardName}>{person.n}</span>
                <span className={styles.personCardNum}>{person.I}번</span>
              </>
            ) : (
              <span className={styles.personCardEmpty}>{idx + 1} 선택</span>
            )}
          </button>
        ))}
      </div>

      {/* 월 네비게이션 */}
      <div className={styles.nav}>
        <button type="button" className={styles.navBtn} onClick={prevMonth} aria-label="이전 달">‹</button>
        <button type="button" className={styles.navTitle} onClick={resetMonth}>{year}년 {month}월</button>
        <button type="button" className={styles.navBtn} onClick={nextMonth} aria-label="다음 달">›</button>
      </div>

      {/* 비교 테이블 */}
      {hasAnyPerson && (
        <div className={styles.table}>
          <div className={styles.tableHeader} style={{ gridTemplateColumns: gridCols }}>
            <span className={styles.tableHeaderCell}>날짜</span>
            {persons.map((p, idx) => (
              <span key={idx} className={styles.tableHeaderCell}>{p?.n ?? `${idx + 1}`}</span>
            ))}
          </div>
          {rows.map((row) => (
            <div
              key={row.d}
              className={`${styles.tableRow} ${row.allRest ? styles.tableRowMatch : ''}`}
              style={{ gridTemplateColumns: gridCols }}
            >
              <span className={`${styles.tableDate} ${row.isSun ? styles.tableDateSun : ''} ${row.isSat ? styles.tableDateSat : ''}`}>
                {row.d} ({row.dow})
              </span>
              {row.disps.map((disp, idx) => (
                <span key={idx} className={`${styles.tableDia} ${row.types[idx] ? styles[`cmpType_${row.types[idx]}`] : ''}`}>
                  {disp}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 기관사 선택 모달 */}
      <Modal
        open={selectorTarget !== null}
        onClose={() => setSelectorTarget(null)}
        title={`기관사 ${selectorTarget !== null ? selectorTarget + 1 : ''} 선택`}
      >
        <div className={styles.modalList}>
          {P_SORTED.map((p) => (
            <button
              key={p.I}
              type="button"
              className={styles.modalItem}
              onClick={() => handleSelect(p)}
            >
              <span className={styles.modalName}>{p.n}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
