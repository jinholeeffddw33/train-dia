'use client';

import { useDriverStore } from '@/stores/driver';
import { Briefcase, GraduationCap, ShieldCheck } from 'lucide-react';
import styles from './WorldHub.module.css';

export type WorldId = 'duty' | 'edu' | 'safety';

interface WorldHubProps {
  onEnter: (world: WorldId) => void;
}

const WORLDS = [
  {
    id: 'duty' as WorldId,
    label: '근무',
    desc: '교번 · 일정 · 노선',
    icon: Briefcase,
    iconClass: styles.iconDuty,
    active: true,
  },
  {
    id: 'edu' as WorldId,
    label: '교육',
    desc: '규정 · 학습 · 평가',
    icon: GraduationCap,
    iconClass: styles.iconEdu,
    active: false,
  },
  {
    id: 'safety' as WorldId,
    label: '안전',
    desc: '점검 · 보고 · 매뉴얼',
    icon: ShieldCheck,
    iconClass: styles.iconSafety,
    active: false,
  },
] as const;

export default function WorldHub({ onEnter }: WorldHubProps) {
  const driver = useDriverStore((s) => s.current);
  const name = driver?.n ?? '';

  const topWorlds = WORLDS.slice(0, 2);
  const bottomWorld = WORLDS[2];

  return (
    <div className={styles.hub}>
      <header className={styles.header}>
        {name && <p className={styles.greeting}>{name} 기관사님</p>}
        <h1 className={styles.title}>어디로 갈까요?</h1>
        <p className={styles.subtitle}>원하는 세계를 선택하세요</p>
      </header>

      <div className={styles.grid}>
        {/* 상단 2개 */}
        <div className={styles.topRow}>
          {topWorlds.map((w) => {
            const Icon = w.icon;
            return (
              <button
                key={w.id}
                type="button"
                className={`${styles.card} ${w.active ? styles.cardActive : styles.cardDisabled}`}
                onClick={() => w.active && onEnter(w.id)}
                disabled={!w.active}
                aria-label={`${w.label} ${w.active ? '' : '(준비 중)'}`}
              >
                {!w.active && <span className={styles.badge}>준비 중</span>}
                <div className={`${styles.iconWrap} ${w.iconClass}`}>
                  <Icon />
                </div>
                <span className={styles.cardTitle}>{w.label}</span>
                <span className={styles.cardDesc}>{w.desc}</span>
              </button>
            );
          })}
        </div>

        {/* 하단 1개 (중앙 정렬) */}
        <div className={styles.bottomRow}>
          <button
            type="button"
            className={`${styles.card} ${bottomWorld.active ? styles.cardActive : styles.cardDisabled}`}
            onClick={() => bottomWorld.active && onEnter(bottomWorld.id)}
            disabled={!bottomWorld.active}
            aria-label={`${bottomWorld.label} ${bottomWorld.active ? '' : '(준비 중)'}`}
          >
            {!bottomWorld.active && <span className={styles.badge}>준비 중</span>}
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
