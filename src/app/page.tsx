'use client';

import { useState, useMemo } from 'react';
import { P } from '@/data/cycle';
import { getDia, getType, getSchedule, getLabel, getDiaDisplay, getColor, getWorkTime, getNextShift, getBannerState, formatTimeUntil, today } from '@/lib/schedule';
import { LABELS, DOW } from '@/lib/constants';
import type { Person } from '@/lib/types';
import styles from './page.module.css';

export default function HomePage() {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showSelector, setShowSelector] = useState(false);

  const now = new Date();
  const td = today();
  const dow = DOW[td.getDay()];
  const dateStr = `${td.getMonth() + 1}/${td.getDate()}(${dow})`;

  const dia = useMemo(() => selectedPerson ? getDia(selectedPerson, td) : null, [selectedPerson]);
  const diaType = useMemo(() => dia ? getType(dia) : null, [dia]);
  const schedule = useMemo(() => dia ? getSchedule(dia, td) : null, [dia]);
  const nextShift = useMemo(
    () => selectedPerson ? getNextShift(selectedPerson, td) : null,
    [selectedPerson],
  );
  const banner = useMemo(
    () => schedule || nextShift ? getBannerState(schedule, nextShift, now) : null,
    [schedule, nextShift],
  );

  return (
    <main className={styles.main}>
      {/* 헤더 */}
      <header className={styles.header}>
        <h1 className={styles.title}>답십리 DIA</h1>
        <span className={styles.date}>{dateStr}</span>
      </header>

      {/* 기관사 선택 */}
      <button
        type="button"
        className={styles.selectorBtn}
        onClick={() => setShowSelector(!showSelector)}
      >
        {selectedPerson ? `${selectedPerson.n} (${selectedPerson.I}번)` : LABELS.SELECT_DRIVER}
      </button>

      {showSelector && (
        <div className={styles.selectorList}>
          {P.map((p) => (
            <button
              key={p.I}
              type="button"
              className={styles.personItem}
              onClick={() => {
                setSelectedPerson(p);
                setShowSelector(false);
              }}
            >
              <span className={styles.personNum}>{p.I}</span>
              <span className={styles.personName}>{p.n}</span>
            </button>
          ))}
        </div>
      )}

      {/* 교번 카드 */}
      {selectedPerson && dia ? (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>{LABELS.TODAY_DIA}</span>
          </div>
          <div className={styles.diaRow}>
            <span
              className={styles.diaBadge}
              style={{ backgroundColor: getColor(diaType!) }}
            >
              {getDiaDisplay(dia)}
            </span>
            <span className={styles.diaType}>{getLabel(dia)}</span>
          </div>

          {schedule && (
            <div className={styles.scheduleInfo}>
              <div className={styles.timeRow}>
                <span>{LABELS.START} {schedule.s}</span>
                <span>{LABELS.END} {schedule.e}</span>
                <span>{LABELS.WORK_TIME} {getWorkTime(schedule)}</span>
              </div>
              {schedule.m && (
                <p className={styles.route}>{schedule.m}</p>
              )}
            </div>
          )}

          {/* 배너 */}
          {banner && (
            <div className={`${styles.banner} ${styles[`banner_${banner.state}`]}`}>
              {banner.state === 'working' && <span>{LABELS.WORK} 중</span>}
              {banner.state === 'done' && <span>{LABELS.GOOD_JOB} 😊</span>}
              {banner.state === 'preparing' && (
                <span>출근 준비 · {formatTimeUntil(banner.minsUntil)}</span>
              )}
              {banner.state === 'idle' && banner.next && (
                <span>{LABELS.NEXT_WORK} · {banner.next.dia} ({formatTimeUntil(banner.minsUntil)})</span>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className={styles.empty}>
          <p>{LABELS.EMPTY_HOME.replace('<br>', '\n')}</p>
        </section>
      )}
    </main>
  );
}
