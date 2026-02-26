'use client';

import { useMemo } from 'react';
import { useTrainStore } from '@/stores/train';
import { LINE5_MAP, LINE5_ROUTES, LINE5_TRANSFERS } from '@/data/line5';
import styles from '../styles/Line5.module.css';

const ROUTE_COLOR = '#996CAC';

export default function RouteMap() {
  const { data, branch, mapZoom, mapFullscreen, setMapZoom, toggleFullscreen } = useTrainStore();

  // 열차 위치를 역이름 기준으로 매핑
  const trainsByStation = useMemo(() => {
    const map = new Map<string, { trainNo: string; direction: string; status: string; dest: string }[]>();
    for (const t of data) {
      const name = t.statnNm;
      if (!LINE5_MAP[name]) continue;
      const arr = map.get(name) ?? [];
      arr.push({
        trainNo: t.trainNo,
        direction: t.updnLine,
        status: t.trainSttus,
        dest: t.statnTnm,
      });
      map.set(name, arr);
    }
    return map;
  }, [data]);

  // 현재 branch에 해당하는 노선 경로
  const routes = useMemo(() => {
    if (branch === 'main') return [LINE5_ROUTES.main];
    if (branch === 'macheon') return [LINE5_ROUTES.main, LINE5_ROUTES.macheon];
    return [LINE5_ROUTES.main, LINE5_ROUTES.hanam];
  }, [branch]);

  return (
    <div className={`${styles.mapContainer} ${mapFullscreen ? styles.mapFullscreen : ''}`}>
      <div className={styles.mapControls}>
        <button
          type="button"
          className={styles.mapBtn}
          onClick={() => setMapZoom(mapZoom + 0.5)}
          aria-label="확대"
        >
          +
        </button>
        <button
          type="button"
          className={styles.mapBtn}
          onClick={() => setMapZoom(mapZoom - 0.5)}
          aria-label="축소"
        >
          −
        </button>
        <button
          type="button"
          className={styles.mapBtn}
          onClick={toggleFullscreen}
          aria-label={mapFullscreen ? '전체화면 해제' : '전체화면'}
        >
          {mapFullscreen ? '⊠' : '⊞'}
        </button>
      </div>

      <div className={styles.mapScroll}>
        <svg
          viewBox="0 0 960 580"
          className={styles.mapSvg}
          /* STYLE-EXCEPTION: SVG 동적 줌 */
          style={{ transform: `scale(${mapZoom})`, transformOrigin: 'center center' }}
        >
          {/* 노선 경로 라인 */}
          {routes.map((route, ri) =>
            route.slice(0, -1).map((stn, i) => {
              const from = LINE5_MAP[stn];
              const to = LINE5_MAP[route[i + 1]];
              if (!from || !to) return null;
              return (
                <line
                  key={`${ri}-${stn}`}
                  x1={from[0]}
                  y1={from[1]}
                  x2={to[0]}
                  y2={to[1]}
                  stroke={ROUTE_COLOR}
                  strokeWidth={4}
                  strokeLinecap="round"
                />
              );
            }),
          )}

          {/* 역 점 + 이름 */}
          {Object.entries(LINE5_MAP).map(([name, [x, y]]) => {
            const trains = trainsByStation.get(name);
            const isTransfer = !!LINE5_TRANSFERS[name];
            const hasTrain = !!trains?.length;

            return (
              <g key={name}>
                {/* 역 원 */}
                <circle
                  cx={x}
                  cy={y}
                  r={isTransfer ? 8 : 5}
                  fill={hasTrain ? '#F59E0B' : '#1E293B'}
                  stroke={isTransfer ? '#ffffff' : ROUTE_COLOR}
                  strokeWidth={isTransfer ? 2.5 : 2}
                />

                {/* 열차 있으면 펄스 */}
                {hasTrain && (
                  <circle
                    cx={x}
                    cy={y}
                    r={12}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth={1.5}
                    opacity={0.5}
                    className={styles.mapPulse}
                  />
                )}

                {/* 역명 */}
                <text
                  x={x}
                  y={y - 12}
                  textAnchor="middle"
                  className={styles.mapStationName}
                  fontSize={10}
                  fill={hasTrain ? '#F59E0B' : '#94A3B8'}
                >
                  {name}
                </text>

                {/* 열차 번호 */}
                {trains?.map((t, ti) => (
                  <text
                    key={t.trainNo}
                    x={x}
                    y={y + 18 + ti * 12}
                    textAnchor="middle"
                    fontSize={8}
                    fill={t.status === '0' ? '#22C55E' : '#F59E0B'}
                    fontWeight="bold"
                  >
                    {t.trainNo}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
