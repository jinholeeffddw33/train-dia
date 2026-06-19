'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun } from 'lucide-react';
import styles from '../styles/Home.module.css';

interface WeatherData {
  temp: number;
  humidity: number;
  pty: number;
  sky: number;
  pm: string;
  desc: string;
}

function pickIcon(pty: number, sky: number) {
  if (pty === 1 || pty === 4) return CloudRain;
  if (pty === 2 || pty === 3) return CloudSnow;
  if (sky >= 3) return Cloud;
  if (sky === 2) return CloudSun;
  return Sun;
}

export default function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/weather')
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.data) setData(json.data as WeatherData);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, []);

  if (!data) {
    return (
      <section className={styles.weatherCard} aria-label="날씨 정보">
        <div className={styles.weatherSkeleton}>날씨 불러오는 중…</div>
      </section>
    );
  }

  const Icon = pickIcon(data.pty, data.sky);

  return (
    <section className={styles.weatherCard} aria-label="현재 날씨">
      <div className={styles.weatherLeft}>
        <Icon size={36} className={styles.weatherIcon} aria-hidden />
        <div className={styles.weatherTempWrap}>
          <span className={styles.weatherTemp}>{data.temp}°</span>
          <span className={styles.weatherDesc}>{data.desc}</span>
        </div>
      </div>
      <div className={styles.weatherRight}>
        <div className={styles.weatherStat}>
          <span className={styles.weatherStatLabel}>습도</span>
          <span className={styles.weatherStatValue}>{data.humidity}%</span>
        </div>
        <div className={styles.weatherStat}>
          <span className={styles.weatherStatLabel}>미세먼지</span>
          <span className={styles.weatherStatValue}>{data.pm}</span>
        </div>
      </div>
    </section>
  );
}
