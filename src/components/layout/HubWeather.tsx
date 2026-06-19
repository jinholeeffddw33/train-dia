'use client';

import { useSeoulWeather } from '@/features/home/hooks/useWeather';
import styles from './HubWeather.module.css';

export default function HubWeather() {
  const weather = useSeoulWeather();

  if (!weather) {
    return (
      <div className={styles.card} aria-label="날씨 정보 불러오는 중">
        <div className={styles.skeleton}>날씨 정보를 불러오는 중…</div>
      </div>
    );
  }

  return (
    <div
      className={styles.card}
      aria-label={`서울 날씨 ${weather.condition} ${weather.temp}도${weather.precipProb > 0 ? `, 강수확률 ${weather.precipProb}%` : ''}${weather.dustLabel ? `, 미세먼지 ${weather.dustLabel}` : ''}`}
    >
      <div className={styles.left}>
        <span className={styles.icon} aria-hidden>{weather.icon}</span>
        <div className={styles.tempWrap}>
          <span className={styles.temp}>{weather.temp}°</span>
          <span className={styles.city}>서울</span>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.stat}>
          <span className={styles.dot} aria-hidden>💧</span>
          <span className={styles.statText}>
            강수 <strong>{weather.precipProb}%</strong>
          </span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.dustDot} ${weather.dustLevel ? styles[`dust_${weather.dustLevel}`] : ''}`} aria-hidden />
          <span className={styles.statText}>
            미세먼지 <strong>{weather.dustLabel ?? '정보 없음'}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
