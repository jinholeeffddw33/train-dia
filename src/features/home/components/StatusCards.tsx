'use client';

import { useMemo } from 'react';
import { useDriverStore } from '@/stores/driver';
import { getDia, getType, getSchedule, getLabel, getDiaDisplay, today } from '@/lib/schedule';
import { DOW } from '@/lib/constants';
import styles from '../styles/Home.module.css';

interface StatusCardsProps {
  baseDate?: Date;
}

/** 기준일 +1 / +2 카드 */
export default function StatusCards({ baseDate }: StatusCardsProps) {
  const driver = useDriverStore((s) => s.current);
  const base = baseDate ?? today();

  const cards = useMemo(() => {
    if (!driver) return [];
    return [1, 2].map((offset) => {
      const d = new Date(base);
      d.setDate(d.getDate() + offset);
      const dia = getDia(driver, d);
      const type = getType(dia);
      const schedule = getSchedule(dia, d);
      return {
        label: offset === 1 ? '다음날' : '다다음날',
        date: `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`,
        dia,
        display: getDiaDisplay(dia),
        type,
        typeName: getLabel(dia),
        time: schedule ? `${schedule.s} ~ ${schedule.e}` : null,
      };
    });
  }, [driver, base]);

  if (!driver || cards.length === 0) return null;

  return (
    <div className={styles.statusCards}>
      {cards.map((card) => (
        <div key={card.label} className={`${styles.statusCard} ${styles[`type_${card.type}`]}`}>
          <div className={styles.statusCardTop}>
            <span className={styles.statusCardLabel}>{card.label}</span>
            <span className={styles.statusCardDate}>{card.date}</span>
          </div>
          <div className={styles.statusCardBottom}>
            <span className={styles.statusCardDia}>{card.display}</span>
            {card.time && (
              <span className={styles.statusCardTime}>{card.time}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
