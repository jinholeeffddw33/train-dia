'use client';

import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useTrainStore } from '@/stores/train';
import { LINE5_MAP, LINE5_ROUTES, LINE5_TRANSFERS } from '@/data/line5';
import styles from '../styles/Line5.module.css';

const ROUTE_COLOR = '#996CAC';
const COLOR_UP = '#0D9452';    // 상행(짝수) — 초록
const COLOR_DOWN = '#D32F2F';  // 하행(홀수) — 빨강
const COLOR_ARRIVING = '#22C55E'; // 도착 중
const DAPSIMNI_COLOR = '#3B82F6';

/** 열차번호로 방향 색상 결정 (홀수=하선 빨강, 짝수=상선 초록) */
function getTrainColor(trainNo: string, status: string): string {
  if (status === '0') return COLOR_ARRIVING;
  const num = parseInt(trainNo);
  if (isNaN(num)) return '#F59E0B';
  return num % 2 === 0 ? COLOR_UP : COLOR_DOWN;
}

/** 열차번호로 방향 판별 */
function getTrainDir(trainNo: string): 'up' | 'down' {
  const num = parseInt(trainNo);
  return num % 2 === 0 ? 'up' : 'down';
}

export default function RouteMap() {
  const { data, branch, mapZoom, mapFullscreen, setMapZoom, toggleFullscreen } = useTrainStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);

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

  // 운행 열차 수
  const trainCount = data.length;

  // 현재 branch에 해당하는 노선 경로
  const routes = useMemo(() => {
    if (branch === 'main') return [LINE5_ROUTES.main];
    if (branch === 'macheon') return [LINE5_ROUTES.main, LINE5_ROUTES.macheon];
    return [LINE5_ROUTES.main, LINE5_ROUTES.hanam];
  }, [branch]);

  // 전체화면 진입 시 답십리 중앙으로 스크롤
  useEffect(() => {
    if (mapFullscreen && scrollRef.current) {
      requestAnimationFrame(() => {
        const dap = LINE5_MAP['답십리'];
        if (!dap || !scrollRef.current) return;
        const container = scrollRef.current;
        const scale = mapZoom;
        // SVG viewBox 기준 → 실제 픽셀 환산
        const svgEl = container.querySelector('svg');
        if (!svgEl) return;
        const svgRect = svgEl.getBoundingClientRect();
        const scaleX = svgRect.width / 960;
        const scaleY = svgRect.height / 580;
        const targetX = dap[0] * scaleX - container.clientWidth / 2;
        const targetY = dap[1] * scaleY - container.clientHeight / 2;
        container.scrollTo({ left: Math.max(0, targetX), top: Math.max(0, targetY), behavior: 'smooth' });
      });
    }
  }, [mapFullscreen, mapZoom]);

  // ESC로 전체화면 닫기
  useEffect(() => {
    if (!mapFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleFullscreen();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [mapFullscreen, toggleFullscreen]);

  // 전체화면 시 body 스크롤 방지
  useEffect(() => {
    if (mapFullscreen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mapFullscreen]);

  const handleStationClick = useCallback((name: string) => {
    setSelectedStation((prev) => (prev === name ? null : name));
  }, []);

  return (
    <div className={`${styles.mapContainer} ${mapFullscreen ? styles.mapFullscreen : ''}`}>
      {/* 전체화면 헤더 */}
      {mapFullscreen && (
        <div className={styles.mapFsHeader}>
          <span className={styles.mapFsTitle}>5호선 노선도</span>
          {trainCount > 0 && (
            <span className={styles.mapFsBadge}>{trainCount}편성 운행중</span>
          )}
          <button
            type="button"
            className={styles.mapFsClose}
            onClick={toggleFullscreen}
            aria-label="전체화면 닫기"
          >
            ✕
          </button>
        </div>
      )}

      {/* 컨트롤 버튼 */}
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
        {!mapFullscreen && (
          <button
            type="button"
            className={styles.mapBtn}
            onClick={toggleFullscreen}
            aria-label="전체화면"
          >
            ⊞
          </button>
        )}
      </div>

      {/* 범례 */}
      <div className={styles.mapLegend}>
        <span className={styles.mapLegendItem}>
          <span className={styles.mapLegendDot} data-color="up" />
          상행(짝수)
        </span>
        <span className={styles.mapLegendItem}>
          <span className={styles.mapLegendDot} data-color="down" />
          하행(홀수)
        </span>
        <span className={styles.mapLegendItem}>
          <span className={styles.mapLegendDot} data-color="arriving" />
          도착
        </span>
      </div>

      <div className={styles.mapScroll} ref={scrollRef}>
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
            const isDapsimni = name === '답십리';
            const isSelected = selectedStation === name;

            // 상행/하행 분리
            const upTrains = trains?.filter((t) => getTrainDir(t.trainNo) === 'up') ?? [];
            const downTrains = trains?.filter((t) => getTrainDir(t.trainNo) === 'down') ?? [];

            return (
              <g key={name} onClick={() => handleStationClick(name)} cursor="pointer">
                {/* 답십리 글로우 */}
                {isDapsimni && (
                  <>
                    <circle cx={x} cy={y} r={20} fill="none" stroke={DAPSIMNI_COLOR} strokeWidth={1} opacity={0.3} />
                    <circle cx={x} cy={y} r={14} fill="none" stroke={DAPSIMNI_COLOR} strokeWidth={1.5} opacity={0.5} />
                  </>
                )}

                {/* 선택 시 하이라이트 링 */}
                {isSelected && (
                  <circle cx={x} cy={y} r={16} fill="none" stroke="#F59E0B" strokeWidth={2} opacity={0.7} />
                )}

                {/* 역 원 */}
                <circle
                  cx={x}
                  cy={y}
                  r={isDapsimni ? 9 : isTransfer ? 8 : 5}
                  fill={isDapsimni ? 'rgba(59,130,246,0.2)' : hasTrain ? '#F59E0B' : '#1E293B'}
                  stroke={isDapsimni ? DAPSIMNI_COLOR : isTransfer ? '#ffffff' : ROUTE_COLOR}
                  strokeWidth={isDapsimni ? 3 : isTransfer ? 2.5 : 2}
                />

                {/* 열차 있으면 펄스 */}
                {hasTrain && !isDapsimni && (
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
                  y={y - (isDapsimni ? 16 : 12)}
                  textAnchor="middle"
                  className={styles.mapStationName}
                  fontSize={isDapsimni ? 12 : 10}
                  fill={isDapsimni ? DAPSIMNI_COLOR : hasTrain ? '#F59E0B' : '#94A3B8'}
                  fontWeight={isDapsimni ? 'bold' : 'normal'}
                >
                  {name}{isDapsimni ? ' ★' : ''}
                </text>

                {/* 열차 번호 — 상행(짝수) 왼쪽, 하행(홀수) 오른쪽 분리 */}
                {upTrains.map((t, ti) => (
                  <text
                    key={t.trainNo}
                    x={x - 22}
                    y={y + 18 + ti * 12}
                    textAnchor="middle"
                    fontSize={9}
                    fill={getTrainColor(t.trainNo, t.status)}
                    fontWeight="bold"
                  >
                    {t.trainNo}
                  </text>
                ))}
                {downTrains.map((t, ti) => (
                  <text
                    key={t.trainNo}
                    x={x + 22}
                    y={y + 18 + ti * 12}
                    textAnchor="middle"
                    fontSize={9}
                    fill={getTrainColor(t.trainNo, t.status)}
                    fontWeight="bold"
                  >
                    {t.trainNo}
                  </text>
                ))}

                {/* 선택된 역: 목적지 정보 표시 */}
                {isSelected && trains && trains.length > 0 && (
                  <g>
                    <rect
                      x={x - 60}
                      y={y + 22 + Math.max(upTrains.length, downTrains.length) * 12}
                      width={120}
                      height={6 + trains.length * 14}
                      rx={4}
                      fill="rgba(15,23,42,0.9)"
                      stroke="rgba(148,163,184,0.3)"
                      strokeWidth={1}
                    />
                    {trains.map((t, ti) => (
                      <text
                        key={`info-${t.trainNo}`}
                        x={x}
                        y={y + 34 + Math.max(upTrains.length, downTrains.length) * 12 + ti * 14}
                        textAnchor="middle"
                        fontSize={9}
                        fill={getTrainColor(t.trainNo, t.status)}
                      >
                        {t.trainNo} → {t.dest}
                      </text>
                    ))}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 비전체화면: 전체화면 안내 */}
      {!mapFullscreen && trainCount > 0 && (
        <div className={styles.mapFooter}>
          <span className={styles.mapFooterText}>{trainCount}편성 운행중</span>
          <button
            type="button"
            className={styles.mapFooterBtn}
            onClick={toggleFullscreen}
          >
            크게 보기
          </button>
        </div>
      )}
    </div>
  );
}
