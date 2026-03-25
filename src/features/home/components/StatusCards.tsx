'use client';

import { useMemo } from 'react';
import { useDriverStore } from '@/stores/driver';
import { getDia, getType, getSchedule, getLabel, getDiaDisplay, today } from '@/lib/schedule';
import { useSwapStore } from '@/stores/swap';
import { DOW } from '@/lib/constants';
import styles from '../styles/Home.module.css';

interface StatusCardsProps {
  baseDate?: Date;
}

/** 기준일 +1 / +2 카드 */
export default function StatusCards({ baseDate }: StatusCardsProps) {
  const driver = useDriverStore((s) => s.current);
  const swaps = useSwapStore((s) => s.swaps);
  const base = baseDate ?? today();

  const cards = useMemo(() => {
    if (!driver) return [];
    return [1, 2].map((offset) => {
      const d = new Date(base);
      d.setDate(d.getDate() + offset);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const swap = swaps[dateStr];
      const isMySwap = swap && swap.driverId === driver.I;
      const dia = isMySwap ? swap.dia : getDia(driver, d);
      const type = getType(dia);
      const schedule = getSchedule(dia, d);
      return {
        label: offset === 1 ? '내일' : '모레',
        date: `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`,
        dia,
        display: getDiaDisplay(dia),
        type,
        typeName: getLabel(dia),
        time: schedule ? `${schedule.s} ~ ${schedule.e}` : null,
        isSwapped: !!isMySwap,
      };
    });
  }, [driver, base, swaps]);

  if (!driver || cards.length === 0) return null;

  return (
    <div className={styles.statusCards}>
      {cards.map((card) => (
        <div key={card.label} className={`${styles.statusCard} ${styles[`type_${card.type}`]} ${card.isSwapped ? styles.statusCardSwapped : ''}`}>
          <div className={styles.statusCardRow}>
            <div className={styles.statusCardInfo}>
              <span className={styles.statusCardLabel}>
                {card.label}
                {card.isSwapped && <span className={styles.statusSwapTag}>변경</span>}
              </span>
              <span className={styles.statusCardDate}>{card.date}</span>
              {card.time && (
                <span className={styles.statusCardTime}>{card.time}</span>
              )}
            </div>
            <span className={styles.statusCardDia}>{card.display}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
