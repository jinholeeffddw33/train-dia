'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useTrainStore } from '@/stores/train';
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

export default function TrainList() {
  const { data, branch, scrollTrigger } = useTrainStore();
  const listRef = useRef<HTMLDivElement>(null);
  const stations = BRANCH_STATIONS[branch] ?? LINE5_MAIN;

  const trainsByStation = useMemo(() => {
    const map = new Map<string, { trainNo: string; direction: string; status: string }[]>();
    for (const t of data) {
      const name = t.statnNm.replace(/역$/, '');
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push({
        trainNo: t.trainNo,
        direction: t.updnLine,
        status: t.trainSttus,
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
  }, [branch, data.length, scrollTrigger]);

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
      {/* 방향 헤더 */}
      <div className={styles.dirHeader}>
        <span className={styles.dirUp}>▲ {firstStation} 방면</span>
        <span className={styles.dirDown}>{lastStation} 방면 ▼</span>
      </div>

      {/* 역 트랙 */}
      {stations.map((name, i) => {
        const isFirst = i === 0;
        const isLast = i === stations.length - 1;
        const isDapsimni = name === '답십리';
        const transfers = LINE5_TRANSFERS[name];
        const hasTransfer = !!transfers && !transfers.some((t) => t.includes('지선'));
        const trainsHere = trainsByStation.get(name) ?? [];
        const upTrains = trainsHere.filter((t) => t.direction === '상행' || t.direction === '0');
        const downTrains = trainsHere.filter((t) => t.direction === '하행' || t.direction === '1');

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
            {/* 좌측: 상행 열차 */}
            <div className={styles.tkLeft}>
              {upTrains.map((t) => (
                <div
                  key={t.trainNo}
                  className={`${styles.tkTrainBox} ${styles.tkTrainUp} ${t.status === '0' ? styles.tkTrainArriving : ''}`}
                >
                  <span className={`${styles.tkCapsule} ${styles.tkCapsuleUp}`} />
                  <span className={styles.tkTrainNo}>{t.trainNo}</span>
                </div>
              ))}
            </div>

            {/* 중앙: 트랙 */}
            <div className={trackClass}>
              <div className={dotClass} />
            </div>

            {/* 우측: 역 이름 + 환승 + 하행 열차 */}
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
              {downTrains.map((t) => (
                <div
                  key={t.trainNo}
                  className={`${styles.tkTrainBox} ${styles.tkTrainDown} ${t.status === '0' ? styles.tkTrainArriving : ''}`}
                >
                  <span className={styles.tkTrainNo}>{t.trainNo}</span>
                  <span className={`${styles.tkCapsule} ${styles.tkCapsuleDown}`} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
