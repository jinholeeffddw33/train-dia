'use client';

import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import Modal from '@/components/common/Modal';
import { useSeoulForecast } from '@/features/home/hooks/useWeather';
import styles from './HubWeatherDetail.module.css';

/**
 * HubWeatherDetail — 날씨 카드 클릭 시 열리는 상세 예보 바텀시트.
 * 시간별(24h) + 주간(7일). 데이터는 open 시점에만 on-demand 로드(useSeoulForecast).
 */
export default function HubWeatherDetail({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { forecast, loading, error, retry } = useSeoulForecast(open);

  // 주간 기온 막대: 전체 주의 최저~최고 범위로 각 날 막대 위치 산정
  const { weekMin, weekSpan } = useMemo(() => {
    if (!forecast?.daily.length) return { weekMin: 0, weekSpan: 1 };
    const mins = forecast.daily.map((d) => d.tempMin);
    const maxs = forecast.daily.map((d) => d.tempMax);
    const lo = Math.min(...mins);
    const hi = Math.max(...maxs);
    return { weekMin: lo, weekSpan: Math.max(1, hi - lo) };
  }, [forecast]);

  return (
    <Modal open={open} onClose={onClose} title="서울 날씨 예보">
      <div className={styles.wrap}>
        {loading && !forecast && (
          <div className={styles.state}>날씨 예보를 불러오는 중…</div>
        )}

        {error && !forecast && (
          <div className={styles.state}>
            <p className={styles.stateText}>예보를 불러올 수 없어요.<br />잠시 후 다시 시도해주세요.</p>
            <button type="button" className={styles.retryBtn} onClick={retry}>
              <RefreshCw size={16} strokeWidth={2.4} /> 다시 시도
            </button>
          </div>
        )}

        {forecast && (
          <>
            {/* ── 시간별 (가로 스크롤) ── */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>시간별 예보</h3>
              <div className={styles.hourScroll}>
                {forecast.hourly.map((h) => (
                  <div key={h.time} className={`${styles.hourCell} ${h.isNow ? styles.hourNow : ''}`}>
                    <span className={styles.hourLabel}>{h.hourLabel}</span>
                    <span className={styles.hourIcon} aria-hidden>{h.icon}</span>
                    <span className={styles.hourTemp}>{h.temp}°</span>
                    <span className={styles.hourRain}>
                      {h.precipProb > 0 ? `💧${h.precipProb}%` : ' '}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* ── 주간 ── */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>주간 예보</h3>
              <ul className={styles.weekList}>
                {forecast.daily.map((d) => {
                  const left = ((d.tempMin - weekMin) / weekSpan) * 100;
                  const width = ((d.tempMax - d.tempMin) / weekSpan) * 100;
                  return (
                    <li key={d.date} className={`${styles.dayRow} ${d.isToday ? styles.dayToday : ''}`}>
                      <span className={styles.dayName}>{d.dowLabel}</span>
                      <span className={styles.dayIcon} aria-hidden>{d.icon}</span>
                      <span className={styles.dayRain}>
                        {d.precipProb > 0 ? `${d.precipProb}%` : ' '}
                      </span>
                      <span className={styles.dayLow}>{d.tempMin}°</span>
                      <span className={styles.barTrack}>
                        {/* STYLE-EXCEPTION: 기온 범위는 런타임 계산값 — CSS로 표현 불가 */}
                        <span
                          className={styles.barFill}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        />
                      </span>
                      <span className={styles.dayHigh}>{d.tempMax}°</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <p className={styles.credit}>자료: Open-Meteo · 30분마다 갱신</p>
          </>
        )}
      </div>
    </Modal>
  );
}
