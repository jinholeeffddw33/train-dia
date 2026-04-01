'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useDriverStore } from '@/stores/driver';
import { useSafetyUnread } from '@/features/safety/hooks/useSafetyUnread';
import styles from './WorldHub.module.css';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

export type WorldId = 'duty' | 'edu' | 'safety' | 'life';

interface WorldHubProps {
  onEnter: (world: WorldId) => void;
}

interface WorldDef {
  id: WorldId;
  label: string;
  desc: string;
  lottie: string;
  iconClass: string;
  cardClass: string;
  lottieW: number;
  lottieH?: number;
}

const WORLDS: WorldDef[] = [
  {
    id: 'duty',
    label: '근무',
    desc: '교번 · 일정 · 노선',
    lottie: '/lottie/duty.json',
    iconClass: styles.iconDuty,
    cardClass: styles.cardDuty,
    lottieW: 75,
  },
  {
    id: 'edu',
    label: '스마트승무원',
    desc: '규정 · 학습 · 평가',
    lottie: '/lottie/edu.json',
    iconClass: styles.iconEdu,
    cardClass: styles.cardEdu,
    lottieW: 100,
  },
  {
    id: 'safety',
    label: '안전',
    desc: '점검 · 보고 · 매뉴얼',
    lottie: '/lottie/safety.json',
    iconClass: styles.iconSafety,
    cardClass: styles.cardSafety,
    lottieW: 44,
  },
  {
    id: 'life',
    label: '라이프',
    desc: '건강 · 힐링 · 즐거움',
    lottie: '',
    iconClass: styles.iconLife,
    cardClass: styles.cardLife,
    lottieW: 44,
  },
];

function LottieIcon({ src, className, width = 62, height }: { src: string; className: string; width?: number; height?: number }) {
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
          style={{ width, height: height ?? width }}
        />
      )}
    </div>
  );
}

export default function WorldHub({ onEnter }: WorldHubProps) {
  const driver = useDriverStore((s) => s.current);
  const name = driver?.n ?? '';
  const { getUnread, alertUnread } = useSafetyUnread();
  const safetyTotal = alertUnread + getUnread('hazard') + getUnread('action') + getUnread('inspect');

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

  return (
    <div className={styles.hub}>
      <header className={styles.header}>
        {name && <p className={styles.greeting}>{name} 기관사님, 안녕하세요</p>}
        <h1 className={styles.title}>답십리 승무사업소</h1>
        <p className={styles.subtitle}>업무 영역을 선택하세요</p>
      </header>

      <div className={styles.grid}>
        {WORLDS.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`${styles.card} ${w.cardClass}`}
            onClick={(e) => handleClick(e, w.id)}
            aria-label={w.label}
          >
            {w.id === 'safety' && safetyTotal > 0 && (
              <span className={styles.worldBadge}>{safetyTotal > 99 ? '99+' : safetyTotal}</span>
            )}
            {w.lottie ? (
              <LottieIcon src={w.lottie} className={w.iconClass} width={w.lottieW} height={w.lottieH} />
            ) : (
              <div className={`${styles.iconWrap} ${w.iconClass}`}>
                <svg viewBox="0 0 64 64" width={48} height={48} fill="none">
                  {/* 잎사귀 — 힐링/자연 */}
                  <path d="M32 12C22 12 14 22 14 32c0 12 8 20 18 20" stroke="#ec4899" strokeWidth="2.5" fill="rgba(236,72,153,0.1)" strokeLinecap="round" />
                  <path d="M32 12C42 12 50 22 50 32c0 12-8 20-18 20" stroke="#a855f7" strokeWidth="2.5" fill="rgba(168,85,247,0.08)" strokeLinecap="round" />
                  {/* 줄기 */}
                  <path d="M32 32V52" stroke="url(#leafStem)" strokeWidth="2" strokeLinecap="round" />
                  {/* 하트 */}
                  <path d="M28 26c-2-3-6-3-7 0s1 7 11 12c10-5 12-9 11-12s-5-3-7 0-4 4-4 4-2-1-4-4z" fill="url(#heartGrad)" opacity="0.85" />
                  <defs>
                    <linearGradient id="leafStem" x1="32" y1="32" x2="32" y2="52">
                      <stop stopColor="#a855f7" />
                      <stop offset="1" stopColor="#ec4899" stopOpacity="0.4" />
                    </linearGradient>
                    <linearGradient id="heartGrad" x1="24" y1="24" x2="40" y2="40">
                      <stop stopColor="#ec4899" />
                      <stop offset="1" stopColor="#f472b6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            )}
            <span className={styles.cardTitle}>{w.label}</span>
            <span className={styles.cardDesc}>{w.desc}</span>
          </button>
        ))}
      </div>

      <span className={styles.footer}>Train DIA v2</span>
    </div>
  );
}
