'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useDriverStore } from '@/stores/driver';
import styles from './WorldHub.module.css';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

export type WorldId = 'duty' | 'edu' | 'safety';

interface WorldHubProps {
  onEnter: (world: WorldId) => void;
}

const WORLDS = [
  {
    id: 'duty' as WorldId,
    label: '근무',
    desc: '교번 · 일정 · 노선',
    lottie: '/lottie/duty.json',
    iconClass: styles.iconDuty,
    cardClass: styles.cardDuty,
    lottieSize: 62,
  },
  {
    id: 'edu' as WorldId,
    label: '교육',
    desc: '규정 · 학습 · 평가',
    lottie: '/lottie/edu.json',
    iconClass: styles.iconEdu,
    cardClass: styles.cardEdu,
    lottieSize: 68,
  },
  {
    id: 'safety' as WorldId,
    label: '안전',
    desc: '점검 · 보고 · 매뉴얼',
    lottie: '/lottie/safety.json',
    iconClass: styles.iconSafety,
    cardClass: styles.cardSafety,
    lottieSize: 90,
  },
];

function LottieIcon({ src, className, size = 62 }: { src: string; className: string; size?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    fetch(src)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [src]);

  return (
    <div className={`${styles.iconWrap} ${className}`}>
      {data && (
        <Lottie
          animationData={data}
          loop
          autoplay
          /* STYLE-EXCEPTION: Lottie 파일별 캔버스 비율이 달라 런타임 크기 보정 필요 */
          style={{ width: size, height: size }}
        />
      )}
    </div>
  );
}

export default function WorldHub({ onEnter }: WorldHubProps) {
  const driver = useDriverStore((s) => s.current);
  const name = driver?.n ?? '';

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

      <div className={styles.grid}>
        <div className={styles.topRow}>
          {topWorlds.map((w) => (
            <button
              key={w.id}
              type="button"
              className={`${styles.card} ${w.cardClass}`}
              onClick={(e) => handleClick(e, w.id)}
              aria-label={w.label}
            >
              <LottieIcon src={w.lottie} className={w.iconClass} size={w.lottieSize} />
              <span className={styles.cardTitle}>{w.label}</span>
              <span className={styles.cardDesc}>{w.desc}</span>
            </button>
          ))}
        </div>

        <div className={styles.bottomRow}>
          <button
            type="button"
            className={`${styles.card} ${bottomWorld.cardClass}`}
            onClick={(e) => handleClick(e, bottomWorld.id)}
            aria-label={bottomWorld.label}
          >
            <LottieIcon src={bottomWorld.lottie} className={bottomWorld.iconClass} size={bottomWorld.lottieSize} />
            <span className={styles.cardTitle}>{bottomWorld.label}</span>
            <span className={styles.cardDesc}>{bottomWorld.desc}</span>
          </button>
        </div>
      </div>

      <span className={styles.footer}>Train DIA v2</span>
    </div>
  );
}
