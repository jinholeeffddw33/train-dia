'use client';

import { useState, useMemo } from 'react';
import { useCompareStore } from '@/stores/compare';
import { P } from '@/data/cycle';
import { getDia, getType, getDiaDisplay } from '@/lib/schedule';
import { DOW } from '@/lib/constants';
import Modal from '@/components/common/Modal';
import type { Person } from '@/lib/types';
import styles from '../styles/Compare.module.css';

export default function CompareTab() {
  const { personA, personB, year, month, setPersonA, setPersonB, prevMonth, nextMonth, resetMonth } = useCompareStore();
  const [selectorTarget, setSelectorTarget] = useState<'A' | 'B' | null>(null);

  const daysInMonth = new Date(year, month, 0).getDate();

  const rows = useMemo(() => {
    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dow = DOW[date.getDay()];
      const isSun = date.getDay() === 0;
      const isSat = date.getDay() === 6;

      const diaA = personA ? getDia(personA, date) : null;
      const diaB = personB ? getDia(personB, date) : null;
      const typeA = diaA ? getType(diaA) : null;
      const typeB = diaB ? getType(diaB) : null;
      const dispA = diaA ? getDiaDisplay(diaA) : '';
      const dispB = diaB ? getDiaDisplay(diaB) : '';

      // 같은 날 둘 다 쉬는 날이면 하이라이트
      const bothRest = typeA === 'rest' && typeB === 'rest';

      result.push({ d, dow, isSun, isSat, dispA, dispB, typeA, typeB, bothRest });
    }
    return result;
  }, [personA, personB, year, month, daysInMonth]);

  const handleSelect = (person: Person) => {
    if (selectorTarget === 'A') setPersonA(person);
    else setPersonB(person);
    setSelectorTarget(null);
  };

  return (
    <div className={styles.container}>
      {/* 기관사 선택 카드 */}
      <div className={styles.selectorRow}>
        <button
          type="button"
          className={`${styles.personCard} ${personA ? styles.personCardFilled : ''}`}
          onClick={() => setSelectorTarget('A')}
        >
          {personA ? (
            <>
              <span className={styles.personCardName}>{personA.n}</span>
              <span className={styles.personCardNum}>{personA.I}번</span>
            </>
          ) : (
            <span className={styles.personCardEmpty}>A 선택</span>
          )}
        </button>

        <span className={styles.vsText}>VS</span>

        <button
          type="button"
          className={`${styles.personCard} ${personB ? styles.personCardFilled : ''}`}
          onClick={() => setSelectorTarget('B')}
        >
          {personB ? (
            <>
              <span className={styles.personCardName}>{personB.n}</span>
              <span className={styles.personCardNum}>{personB.I}번</span>
            </>
          ) : (
            <span className={styles.personCardEmpty}>B 선택</span>
          )}
        </button>
      </div>

      {/* 월 네비게이션 */}
      <div className={styles.nav}>
        <button type="button" className={styles.navBtn} onClick={prevMonth} aria-label="이전 달">‹</button>
        <button type="button" className={styles.navTitle} onClick={resetMonth}>{year}년 {month}월</button>
        <button type="button" className={styles.navBtn} onClick={nextMonth} aria-label="다음 달">›</button>
      </div>

      {/* 비교 테이블 */}
      {(personA || personB) && (
        <div className={styles.table}>
          <div className={styles.tableHeader}>
            <span className={styles.tableHeaderCell}>날짜</span>
            <span className={styles.tableHeaderCell}>{personA?.n ?? 'A'}</span>
            <span className={styles.tableHeaderCell}>{personB?.n ?? 'B'}</span>
          </div>
          {rows.map((row) => (
            <div
              key={row.d}
              className={`${styles.tableRow} ${row.bothRest ? styles.tableRowMatch : ''}`}
            >
              <span className={`${styles.tableDate} ${row.isSun ? styles.tableDateSun : ''} ${row.isSat ? styles.tableDateSat : ''}`}>
                {row.d} ({row.dow})
              </span>
              <span className={`${styles.tableDia} ${row.typeA ? styles[`cmpType_${row.typeA}`] : ''}`}>
                {row.dispA}
              </span>
              <span className={`${styles.tableDia} ${row.typeB ? styles[`cmpType_${row.typeB}`] : ''}`}>
                {row.dispB}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 기관사 선택 모달 */}
      <Modal
        open={selectorTarget !== null}
        onClose={() => setSelectorTarget(null)}
        title={`기관사 ${selectorTarget} 선택`}
      >
        <div className={styles.modalList}>
          {P.map((p) => (
            <button
              key={p.I}
              type="button"
              className={styles.modalItem}
              onClick={() => handleSelect(p)}
            >
              <span className={styles.modalNum}>{p.I}</span>
              <span className={styles.modalName}>{p.n}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
