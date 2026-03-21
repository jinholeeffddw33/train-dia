'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { useTrainStore } from '@/stores/train';
import { buildTrainDriverMap } from '@/lib/schedule';
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

export default function TrainList() {
  const { data, branch, scrollTrigger } = useTrainStore();
  const listRef = useRef<HTMLDivElement>(null);
  const stations = BRANCH_STATIONS[branch] ?? LINE5_MAIN;

  // 열차번호 → 답십리 기관사 이름 매핑 (1분마다 갱신)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const driverMap = useMemo(() => buildTrainDriverMap(now), [now]);

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
                    {driver && <span className={styles.tkDriverName}>{driver}</span>}
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
                    {driver && <span className={styles.tkDriverName}>{driver}</span>}
                    {t.dest && <span className={styles.tkDest}>{t.dest}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
