'use client';

import { useCallback, useRef } from 'react';
import { useDriverStore } from '@/stores/driver';
import { Briefcase, GraduationCap, ShieldCheck } from 'lucide-react';
import styles from './WorldHub.module.css';

export type WorldId = 'duty' | 'edu' | 'safety';

interface WorldHubProps {
  onEnter: (world: WorldId) => void;
}

const WORLDS: {
  id: WorldId;
  label: string;
  desc: string;
  icon: typeof Briefcase;
  iconClass: string;
  cardClass: string;
}[] = [
  {
    id: 'duty',
    label: '근무',
    desc: '교번 · 일정 · 노선',
    icon: Briefcase,
    iconClass: styles.iconDuty,
    cardClass: styles.cardDuty,
  },
  {
    id: 'edu',
    label: '교육',
    desc: '규정 · 학습 · 평가',
    icon: GraduationCap,
    iconClass: styles.iconEdu,
    cardClass: styles.cardEdu,
  },
  {
    id: 'safety',
    label: '안전',
    desc: '점검 · 보고 · 매뉴얼',
    icon: ShieldCheck,
    iconClass: styles.iconSafety,
    cardClass: styles.cardSafety,
  },
];

export default function WorldHub({ onEnter }: WorldHubProps) {
  const driver = useDriverStore((s) => s.current);
  const name = driver?.n ?? '';
  const gridRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>, worldId: WorldId) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = styles.ripple;
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    btn.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
      onEnter(worldId);
    }, 300);
  }, [onEnter]);

  const topWorlds = WORLDS.slice(0, 2);
  const bottomWorld = WORLDS[2];

  return (
    <div className={styles.hub}>
      <header className={styles.header}>
        {name && <p className={styles.greeting}>{name} 기관사님, 안녕하세요</p>}
        <h1 className={styles.title}>DIA Station</h1>
        <p className={styles.subtitle}>업무 영역을 선택하세요</p>
      </header>

      <div className={styles.grid} ref={gridRef}>
        <div className={styles.topRow}>
          {topWorlds.map((w) => {
            const Icon = w.icon;
            return (
              <button
                key={w.id}
                type="button"
                className={`${styles.card} ${w.cardClass}`}
                onClick={(e) => handleClick(e, w.id)}
                aria-label={w.label}
              >
                <div className={`${styles.iconWrap} ${w.iconClass}`}>
                  <Icon />
                </div>
                <span className={styles.cardTitle}>{w.label}</span>
                <span className={styles.cardDesc}>{w.desc}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.bottomRow}>
          <button
            type="button"
            className={`${styles.card} ${bottomWorld.cardClass}`}
            onClick={(e) => handleClick(e, bottomWorld.id)}
            aria-label={bottomWorld.label}
          >
            <div className={`${styles.iconWrap} ${bottomWorld.iconClass}`}>
              <bottomWorld.icon />
            </div>
            <span className={styles.cardTitle}>{bottomWorld.label}</span>
            <span className={styles.cardDesc}>{bottomWorld.desc}</span>
          </button>
        </div>
      </div>

      <span className={styles.footer}>Train DIA v2</span>
    </div>
  );
}
