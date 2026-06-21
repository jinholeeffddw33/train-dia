'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Bell, TrainFront, GraduationCap, Shield, Heart, ClipboardCheck, ChevronRight, Coffee } from 'lucide-react';
import { useDriverStore } from '@/stores/driver';
import { getUserRole } from '@/lib/auth';
import { APP_VERSION } from '@/lib/constants';
import { useSafetyUnread } from '@/features/safety/hooks/useSafetyUnread';
import { InstallCard } from '@/features/home';
import HubHero from './HubHero';
import HubWeather from './HubWeather';
import styles from './WorldHub.module.css';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

export type WorldId = 'duty' | 'edu' | 'safety' | 'life' | 'standby';

interface WorldHubProps {
  onEnter: (world: WorldId) => void;
}

interface ServiceDef {
  id: WorldId;
  label: string;
  desc: string;
  Icon: typeof TrainFront;
  iconClass: string;
}

const SERVICES: ServiceDef[] = [
  { id: 'duty',   label: '근무',       desc: '교번 · 일정',     Icon: TrainFront,    iconClass: 'iconDuty' },
  { id: 'edu',    label: '스마트승무원', desc: '규정 · 학습',     Icon: GraduationCap, iconClass: 'iconEdu' },
  { id: 'safety', label: '안전',       desc: '점검 · 매뉴얼',   Icon: Shield,        iconClass: 'iconSafety' },
  { id: 'life',   label: '라이프',     desc: '건강 · 힐링',     Icon: Heart,         iconClass: 'iconLife' },
];

// 시간대별 부제
function getSubtitle(): string {
  const h = new Date().getHours();
  if (h < 6) return '편안한 밤 되세요 🌙';
  if (h < 12) return '오늘도 안전운행 하세요!';
  if (h < 18) return '오후도 화이팅 🚇';
  return '오늘도 고생 많으셨어요';
}

// Lottie 아이콘 (옵션) — 알림 등 별도 용도
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LottieIcon({ src, width = 24 }: { src: string; width?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    fetch(src).then((r) => r.json()).then(setData).catch(() => {});
  }, [src]);
  if (!data) return null;
  return <Lottie animationData={data} loop autoplay style={{ width, height: width }} />;
}

export default function WorldHub({ onEnter }: WorldHubProps) {
  const driver = useDriverStore((s) => s.current);
  const name = driver?.n ?? '';
  const role = getUserRole(driver?.s);
  const { getUnread, alertUnread } = useSafetyUnread();
  const safetyTotal = alertUnread + getUnread('hazard') + getUnread('action') + getUnread('inspect');
  const hasNotice = safetyTotal > 0;

  const handleClick = useCallback((worldId: WorldId) => {
    window.setTimeout(() => onEnter(worldId), 120);
  }, [onEnter]);

  return (
    <div className={styles.hub}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerText}>
          {name && (
            <p className={styles.greeting}>안녕하세요, {name} {role}</p>
          )}
          <h1 className={styles.title}>답십리 승무사업소</h1>
          <p className={styles.subtitle}>{getSubtitle()}</p>
        </div>
        <button
          type="button"
          className={styles.bellBtn}
          aria-label="알림"
          onClick={() => onEnter('safety')}
        >
          <Bell size={22} strokeWidth={2.2} />
          {hasNotice && <span className={styles.bellDot} aria-hidden />}
        </button>
      </header>

      {/* ── Today's Duty Hero ── */}
      <HubHero onClick={() => onEnter('duty')} />

      {/* ── 주요 서비스 ── */}
      <section className={styles.servicesWrap} aria-labelledby="services-title">
        <h2 id="services-title" className={styles.servicesTitle}>주요 서비스</h2>
        <div className={styles.servicesGrid}>
          {SERVICES.map((s) => {
            const Icon = s.Icon;
            const showBadge = s.id === 'safety' && safetyTotal > 0;
            return (
              <button
                key={s.id}
                type="button"
                className={styles.serviceCard}
                onClick={() => handleClick(s.id)}
                aria-label={`${s.label} — ${s.desc}`}
                data-tone={s.id}
                data-press
              >
                <span className={`${styles.serviceIcon} ${styles[s.iconClass]}`}>
                  <Icon size={22} strokeWidth={2.2} />
                </span>
                <div className={styles.serviceText}>
                  <span className={styles.serviceLabel}>{s.label}</span>
                  <span className={styles.serviceDesc}>{s.desc}</span>
                </div>
                {showBadge && (
                  <span className={styles.serviceBadge}>
                    {safetyTotal > 99 ? '99+' : safetyTotal}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 미니 액션 — 대기충당확인 + 카페 바로가기 ── */}
      <div className={styles.miniActions}>
        <button
          type="button"
          className={styles.standbyCard}
          onClick={() => handleClick('standby')}
          aria-label="대기충당확인"
          data-press
        >
          <span className={styles.standbyIcon}>
            <ClipboardCheck size={14} strokeWidth={2.4} />
          </span>
          <span className={styles.standbyLabel}>대기충당확인</span>
          <ChevronRight size={14} className={styles.standbyChevron} aria-hidden />
        </button>

        <a
          href="https://cafe.naver.com/smrthink"
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.standbyCard} ${styles.cafeCard}`}
          aria-label="네이버 카페 바로가기 (새 창)"
          data-press
        >
          <span className={`${styles.standbyIcon} ${styles.cafeIcon}`}>
            <Coffee size={14} strokeWidth={2.4} />
          </span>
          <span className={styles.standbyLabel}>카페 바로가기</span>
          <ChevronRight size={14} className={styles.standbyChevron} aria-hidden />
        </a>
      </div>

      {/* ── Weather (대기충당확인 아래로 이동) ── */}
      <HubWeather />

      <InstallCard />

      <div className={styles.footer}>
        <span className={styles.footerBrand}>Train DIA</span>
        <span className={styles.footerVersion}>{APP_VERSION}</span>
      </div>
    </div>
  );
}
