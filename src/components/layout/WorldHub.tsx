'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useDriverStore } from '@/stores/driver';
import { isIntern } from '@/lib/auth';
import { APP_VERSION } from '@/lib/constants';
import { useSafetyUnread } from '@/features/safety/hooks/useSafetyUnread';
import { InstallCard } from '@/features/home';
import HubTodaySummary from './HubTodaySummary';
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
  const role = driver?.s && isIntern(driver.s) ? '인턴사원님' : '기관사님';
  const { getUnread, alertUnread } = useSafetyUnread();
  const safetyTotal = alertUnread + getUnread('hazard') + getUnread('action') + getUnread('inspect');

  const handleClick = useCallback((_e: React.MouseEvent<HTMLButtonElement>, worldId: WorldId) => {
    // press 피드백을 사용자가 인지할 수 있도록 짧은 딜레이 후 전환
    window.setTimeout(() => onEnter(worldId), 120);
  }, [onEnter]);

  return (
    <div className={styles.hub}>
      <header className={styles.header}>
        {name && <p className={styles.greeting}>{name} {role}, 안녕하세요</p>}
        <h1 className={styles.title}>답십리 승무사업소</h1>
      </header>

      <HubTodaySummary />

      {(() => {
        const duty = WORLDS.find((w) => w.id === 'duty')!;
        const rest = WORLDS.filter((w) => w.id !== 'duty');
        const renderIcon = (w: WorldDef, size: 'hero' | 'small') => {
          const dim = size === 'hero' ? Math.round(w.lottieW * 1.3) : 34;
          if (w.lottie) {
            return <LottieIcon src={w.lottie} className={w.iconClass} width={dim} height={dim} />;
          }
          const svgSize = size === 'hero' ? 60 : 34;
          return (
            <div className={`${styles.iconWrap} ${w.iconClass}`}>
              <svg viewBox="0 0 64 64" width={svgSize} height={svgSize} fill="none">
                <ellipse cx="32" cy="52" rx="16" ry="4" fill="url(#soilGrad)" opacity="0.3" />
                <path d="M32 28V52" stroke="url(#stemGrad)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M32 30C28 24 18 20 14 24c-3 3 0 10 8 12 4 1 8 0 10-2" fill="url(#leafL)" stroke="#22c55e" strokeWidth="1.2" />
                <path d="M32 26C36 20 46 16 50 20c3 3 0 10-8 12-4 1-8 0-10-2" fill="url(#leafR)" stroke="#16a34a" strokeWidth="1.2" />
                <path d="M32 30C28 27 22 25 18 26" stroke="#16a34a" strokeWidth="0.6" opacity="0.4" strokeLinecap="round" />
                <path d="M32 26C36 23 42 21 46 22" stroke="#15803d" strokeWidth="0.6" opacity="0.4" strokeLinecap="round" />
                <circle cx="22" cy="22" r="1.5" fill="#fbbf24" opacity="0.7" />
                <circle cx="44" cy="18" r="1" fill="#fbbf24" opacity="0.5" />
                <circle cx="38" cy="14" r="1.2" fill="#fde68a" opacity="0.6" />
                <defs>
                  <linearGradient id="stemGrad" x1="32" y1="28" x2="32" y2="52" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#22c55e" />
                    <stop offset="1" stopColor="#86efac" stopOpacity="0.5" />
                  </linearGradient>
                  <linearGradient id="leafL" x1="14" y1="20" x2="32" y2="36" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4ade80" />
                    <stop offset="1" stopColor="#22c55e" />
                  </linearGradient>
                  <linearGradient id="leafR" x1="50" y1="16" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#86efac" />
                    <stop offset="1" stopColor="#16a34a" />
                  </linearGradient>
                  <radialGradient id="soilGrad" cx="0.5" cy="0.5" r="0.5">
                    <stop stopColor="#92400e" />
                    <stop offset="1" stopColor="#92400e" stopOpacity="0" />
                  </radialGradient>
                </defs>
              </svg>
            </div>
          );
        };

        return (
          <>
            <button
              type="button"
              className={`${styles.heroCard} ${styles.cardDuty}`}
              onClick={(e) => handleClick(e, duty.id)}
              aria-label={duty.label}
            >
              <div className={styles.heroIcon}>{renderIcon(duty, 'hero')}</div>
              <div className={styles.heroText}>
                <span className={styles.heroTitle}>{duty.label}</span>
                <span className={styles.heroDesc}>{duty.desc}</span>
              </div>
              <span className={styles.heroChevron} aria-hidden>›</span>
            </button>

            <div className={styles.smallGrid}>
              {rest.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`${styles.smallCard} ${w.cardClass}`}
                  onClick={(e) => handleClick(e, w.id)}
                  aria-label={w.label}
                >
                  {w.id === 'safety' && safetyTotal > 0 && (
                    <span className={styles.worldBadge}>{safetyTotal > 99 ? '99+' : safetyTotal}</span>
                  )}
                  {renderIcon(w, 'small')}
                  <span className={styles.smallTitle}>{w.label}</span>
                </button>
              ))}
            </div>
          </>
        );
      })()}

      <InstallCard />

      <div className={styles.footer}>
        <span className={styles.footerBrand}>Train DIA v2</span>
        <span className={styles.footerVersion}>{APP_VERSION}</span>
      </div>
    </div>
  );
}
