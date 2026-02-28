'use client';

import { useMemo } from 'react';
import { useTrainStore } from '@/stores/train';
import {
  LINE5_MAIN,
  LINE5_MACHEON,
  LINE5_HANAM,
} from '@/data/line5';
import styles from '../styles/Line5.module.css';

const TRAIN_STATUS: Record<string, string> = {
  '0': '도착',
  '1': '출발',
  '2': '진입',
  '3': '전역출발',
};

const BRANCH_STATIONS = {
  main: LINE5_MAIN as readonly string[],
  macheon: LINE5_MACHEON as readonly string[],
  hanam: LINE5_HANAM as readonly string[],
};

export default function TrainList() {
  const { data, branch } = useTrainStore();
  const branchStations = BRANCH_STATIONS[branch];

  const { upTrains, downTrains } = useMemo(() => {
    const stationSet = new Set(branchStations);
    const filtered = data.filter((t) => stationSet.has(t.statnNm));

    return {
      upTrains: filtered.filter((t) => t.updnLine === '상행'),
      downTrains: filtered.filter((t) => t.updnLine === '하행'),
    };
  }, [data, branchStations]);

  if (data.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>🌙</span>
        <p className={styles.emptyText}>지금은 운행 중인 열차가 없어요</p>
        <p className={styles.emptyHint}>심야 시간에는 열차가 쉬고 있어요</p>
      </div>
    );
  }

  return (
    <div className={styles.listContainer}>
      <DirectionGroup
        label="상행 (방화 방면)"
        trains={upTrains}
      />
      <DirectionGroup
        label="하행 (마천·하남 방면)"
        trains={downTrains}
      />
    </div>
  );
}

function DirectionGroup({
  label,
  trains,
}: {
  label: string;
  trains: { statnNm: string; trainNo: string; statnTnm: string; trainSttus: string }[];
}) {
  return (
    <div className={styles.directionGroup}>
      <h3 className={styles.directionLabel}>{label}</h3>
      {trains.length === 0 ? (
        <p className={styles.noTrains}>이 방향엔 열차가 없어요</p>
      ) : (
        <div className={styles.trainCards}>
          {trains.map((t) => (
            <div
              key={t.trainNo}
              className={`${styles.trainCard} ${t.trainSttus === '0' ? styles.trainCardArriving : ''}`}
            >
              <div className={styles.trainCardTop}>
                <span className={styles.trainNo}>{t.trainNo}</span>
                <span className={styles.trainDest}>→ {t.statnTnm}</span>
              </div>
              <div className={styles.trainCardBottom}>
                <span className={styles.trainStation}>{t.statnNm}</span>
                <span className={`${styles.trainStatus} ${styles[`status_${t.trainSttus}`]}`}>
                  {TRAIN_STATUS[t.trainSttus] ?? t.trainSttus}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
