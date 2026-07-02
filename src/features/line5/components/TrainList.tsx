'use client';

import { memo, useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useTrainStore } from '@/stores/train';
import { buildTrainDriverMap, buildTrainDiaMap, type TrainDiaInfo } from '@/lib/schedule';
import DiaChartModal from '@/components/layout/DiaChartModal';
import {
  LINE5_MAIN,
  LINE5_MACHEON,
  LINE5_HANAM,
  LINE5_TRANSFERS,
  LINE_COLORS,
} from '@/data/line5';
import styles from '../styles/Line5.module.css';

const BRANCH_STATIONS: Record<string, readonly string[]> = {
  main: LINE5_MAIN,
  macheon: ['강동', ...LINE5_MACHEON] as const,
  hanam: ['강동', ...LINE5_HANAM] as const,
};

/** 행선지 축약 (모바일 공간 절약) */
function shortDest(dest: string): string {
  return dest
    .replace(/역$/, '')
    .replace('하남검단산', '하남검단')
    .replace('강일', '하남검단');
}

function TrainList() {
  const data = useTrainStore((s) => s.data);
  const branch = useTrainStore((s) => s.branch);
  const scrollTrigger = useTrainStore((s) => s.scrollTrigger);
  const listRef = useRef<HTMLDivElement>(null);
  const stations = BRANCH_STATIONS[branch] ?? LINE5_MAIN;

  // 실시간 열차 위치 (열차번호 → 현재역/방향) — 답십리 위치 기반 교대용
  const livePos = useMemo(() => {
    const m = new Map<string, { station: string; dir: string }>();
    for (const t of data) m.set(String(t.trainNo), { station: t.statnNm, dir: t.updnLine });
    return m;
  }, [data]);
  // 열차번호 → 답십리 기관사 이름 매핑 (위치 기반 교대 — data 변경 시 재계산)
  const driverMap = useMemo(() => buildTrainDriverMap(new Date(), livePos), [livePos]);
  // 열차번호 → 기관사 다이아 정보 (이름 탭 → 행로표 미리보기)
  const diaMap = useMemo(() => buildTrainDiaMap(new Date(), livePos), [livePos]);

  // 기관사 이름 탭 → 해당 기관사 행로표 모달 열기
  const [selectedDia, setSelectedDia] = useState<TrainDiaInfo | null>(null);
  const openDriverChart = useCallback((trainNo: string) => {
    const info = diaMap.get(trainNo);
    if (info) setSelectedDia(info);
  }, [diaMap]);

  const trainsByStation = useMemo(() => {
    const map = new Map<string, { trainNo: string; direction: string; status: string; dest: string }[]>();
    for (const t of data) {
      const name = t.statnNm.replace(/역$/, '');
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push({
        trainNo: t.trainNo,
        direction: t.updnLine,
        status: t.trainSttus,
        dest: shortDest(t.statnTnm || ''),
      });
    }
    return map;
  }, [data]);

  // 답십리 자동 스크롤 (탭 진입 + 브랜치 변경 + 탭 재클릭 + 첫 데이터 로드)
  const hasScrolled = useRef(false);
  useEffect(() => {
    hasScrolled.current = false;
  }, [branch, scrollTrigger]);

  useEffect(() => {
    if (hasScrolled.current) return;
    if (!listRef.current || data.length === 0) return;
    const dapRow = listRef.current.querySelector('[data-station="답십리"]');
    if (dapRow) {
      requestAnimationFrame(() => {
        dapRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      hasScrolled.current = true;
    }
  }, [scrollTrigger, branch]);

  if (data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>🌙</span>
        <p className={styles.emptyText}>지금은 운행 중인 열차가 없어요</p>
        <p className={styles.emptyHint}>심야 시간에는 열차가 쉬고 있어요</p>
      </div>
    );
  }

  const firstStation = stations[0];
  const lastStation = stations[stations.length - 1];

  return (
    <div className={styles.trackWrap} ref={listRef}>
      {/* 방향 헤더 — 하행 LEFT / 상행 RIGHT */}
      <div className={styles.dirHeader}>
        <div className={styles.dirColDown}>
          <span className={styles.dirArrowDown}>▼</span>
          <span className={styles.dirLabel}>{lastStation}행</span>
        </div>
        <div className={styles.dirColUp}>
          <span className={styles.dirLabel}>{firstStation}행</span>
          <span className={styles.dirArrowUp}>▲</span>
        </div>
      </div>

      {/* 역 트랙 */}
      {stations.map((name, i) => {
        const isFirst = i === 0;
        const isLast = i === stations.length - 1;
        const isDapsimni = name === '답십리';
        const transfers = LINE5_TRANSFERS[name];
        const hasTransfer = !!transfers && !transfers.some((t) => t.includes('지선'));
        const trainsHere = trainsByStation.get(name) ?? [];
        const upTrains = trainsHere.filter((t) => t.direction === '상행');
        const downTrains = trainsHere.filter((t) => t.direction === '하행');

        const trackClass = [
          styles.tkTrack,
          isFirst ? styles.tkTrackFirst : '',
          isLast ? styles.tkTrackLast : '',
        ].filter(Boolean).join(' ');

        const dotClass = [
          styles.tkDot,
          isDapsimni ? styles.tkDotDapsimni : hasTransfer ? styles.tkDotTransfer : '',
        ].filter(Boolean).join(' ');

        return (
          <div
            key={name}
            className={`${styles.tkRow} ${isDapsimni ? styles.tkRowHighlight : ''}`}
            data-station={name}
          >
            {/* 좌측: 하행 열차 (홀수, 빨강) */}
            <div className={styles.tkLeft}>
              {downTrains.map((t) => {
                const driver = driverMap.get(t.trainNo);
                return (
                  <div
                    key={t.trainNo}
                    className={`${styles.tkTrainBox} ${styles.tkTrainDown} ${t.status === '0' ? styles.tkTrainArriving : ''}`}
                  >
                    {t.dest && <span className={styles.tkDest}>{t.dest}</span>}
                    {driver && (
                      <button
                        type="button"
                        className={styles.tkDriverName}
                        onClick={() => openDriverChart(t.trainNo)}
                        aria-label={`${driver} 기관사 행로표 보기`}
                        title={`${driver} 기관사 행로표 보기`}
                      >
                        {driver}
                      </button>
                    )}
                    <span className={`${styles.tkCapsule} ${styles.tkCapsuleDown}`} />
                    <span className={styles.tkTrainNo}>{t.trainNo}</span>
                  </div>
                );
              })}
            </div>

            {/* 중앙: 트랙 (↓하행 | ↑상행) */}
            <div className={trackClass}>
              <span className={styles.tkDirDown} aria-hidden="true">▾</span>
              <div className={dotClass} />
              <span className={styles.tkDirUp} aria-hidden="true">▴</span>
            </div>

            {/* 우측: 역 이름 + 상행 열차 (짝수, 초록) */}
            <div className={styles.tkRight}>
              <span className={`${styles.tkName} ${isDapsimni ? styles.tkNameDapsimni : ''}`}>
                {name}{isDapsimni ? ' ★' : ''}
              </span>
              {hasTransfer && (
                <div className={styles.tkTransfers}>
                  {transfers.map((t) => {
                    const color = LINE_COLORS[t] || '#888';
                    return (
                      <span
                        key={t}
                        className={styles.tkTransferTag}
                        /* STYLE-EXCEPTION: 노선별 고유 컬러 (토큰화 불가능) */
                        style={{ background: color }}
                      >
                        {t}
                      </span>
                    );
                  })}
                </div>
              )}
              {upTrains.map((t) => {
                const driver = driverMap.get(t.trainNo);
                return (
                  <div
                    key={t.trainNo}
                    className={`${styles.tkTrainBox} ${styles.tkTrainUp} ${t.status === '0' ? styles.tkTrainArriving : ''}`}
                  >
                    <span className={`${styles.tkCapsule} ${styles.tkCapsuleUp}`} />
                    <span className={styles.tkTrainNo}>{t.trainNo}</span>
                    {driver && (
                      <button
                        type="button"
                        className={styles.tkDriverName}
                        onClick={() => openDriverChart(t.trainNo)}
                        aria-label={`${driver} 기관사 행로표 보기`}
                        title={`${driver} 기관사 행로표 보기`}
                      >
                        {driver}
                      </button>
                    )}
                    {t.dest && <span className={styles.tkDest}>{t.dest}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 기관사 이름 탭 → 해당 기관사 행로표 미리보기 */}
      <DiaChartModal
        open={selectedDia !== null}
        dia={selectedDia?.dia ?? null}
        date={selectedDia?.date ?? new Date()}
        diaLabel={selectedDia ? `${selectedDia.name} 기관사` : undefined}
        compact
        onClose={() => setSelectedDia(null)}
      />
    </div>
  );
}

/** 매초 라벨 tick 등 부모 재렌더에서 격리 — props 없음, 스토어 구독으로만 갱신 */
export default memo(TrainList);
