'use client';

import { LINE_COLORS } from '@/data/line5';
import styles from '../styles/Subway.module.css';

const LANE_NAMES: Record<number, string> = {
  1: '1호선', 2: '2호선', 3: '3호선', 4: '4호선', 5: '5호선',
  6: '6호선', 7: '7호선', 8: '8호선', 9: '9호선',
  100: '공항철도', 101: '경의중앙', 104: '경춘선',
  110: '수인분당', 112: '신분당', 116: '우이신설',
};

interface Segment {
  type: 'ride' | 'transfer';
  laneId?: number;
  from?: string;
  to?: string;
  time?: number;
  stopCount?: number;
  destination?: string;
  departure?: string;
  arrival?: string;
}

interface Route {
  totalTime: number;
  travelTime: number;
  walkTime: number;
  transfers: number;
  fare: number;
  departure: string;
  arrival: string;
  segments: Segment[];
}

export default function RouteResult({ route, index }: { route: Route; index: number }) {
  const lineName = (laneId: number) => LANE_NAMES[laneId] ?? `${laneId}호선`;
  const lineColor = (laneId: number) => LINE_COLORS[lineName(laneId)] ?? '#996CAC';

  return (
    <div className={styles.routeCard}>
      <div className={styles.routeHeader}>
        <span className={styles.routeIndex}>경로 {index + 1}</span>
        <span className={styles.routeTime}>{route.totalTime}분</span>
      </div>

      <div className={styles.routeMeta}>
        <span>이동 {route.travelTime}분</span>
        {route.walkTime > 0 && <span>환승도보 {route.walkTime}분</span>}
        <span>환승 {route.transfers}회</span>
        <span>{route.fare?.toLocaleString()}원</span>
      </div>

      <div className={styles.routeTimeline}>
        <span className={styles.routeDep}>{route.departure?.slice(0, 5)}</span>
        <span className={styles.routeArr}>{route.arrival?.slice(0, 5)}</span>
      </div>

      {/* 구간 */}
      <div className={styles.segments}>
        {route.segments.map((seg, i) => {
          if (seg.type === 'transfer') {
            return (
              <div key={`t-${i}`} className={styles.segTransfer}>
                환승 {seg.time}분
              </div>
            );
          }

          const color = seg.laneId ? lineColor(seg.laneId) : '#996CAC';
          const name = seg.laneId ? lineName(seg.laneId) : '';

          return (
            <div key={`r-${i}`} className={styles.segRide}>
              {/* STYLE-EXCEPTION: 노선별 동적 컬러 */}
              <div className={styles.segLine} style={{ backgroundColor: color }} />
              <div className={styles.segInfo}>
                <div className={styles.segLineInfo}>
                  {/* STYLE-EXCEPTION: 노선별 동적 컬러 */}
                  <span className={styles.segLineName} style={{ color }}>{name}</span>
                  {seg.destination && (
                    <span className={styles.segDest}>{seg.destination} 방면</span>
                  )}
                </div>
                <div className={styles.segStations}>
                  {seg.from} → {seg.to}
                </div>
                <div className={styles.segDetail}>
                  {seg.stopCount}역 · {seg.time}분
                  {seg.departure && ` · ${seg.departure.slice(0, 5)} 출발`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
