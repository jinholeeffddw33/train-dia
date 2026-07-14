'use client';

import { useMemo } from 'react';
import { TrainFront } from 'lucide-react';
import type { Schedule, Person } from '@/lib/types';
import { findExchangePartners } from '@/lib/schedule';
import { LABELS } from '@/lib/constants';
import styles from '../styles/Home.module.css';

interface RouteTimelineProps {
  schedule: Schedule;
  person: Person;
  date: Date;
  dia?: string;
}

/**
 * 구간 운행 — 근무별 한 줄. 행로 약호 뒤에 교대(받음/넘김) 기록.
 * (대기시간·알람 UI 제거, 행로도 제거)
 */
export default function RouteTimeline({ schedule, person, date }: RouteTimelineProps) {
  const partners = useMemo(
    () => findExchangePartners(schedule, person, date),
    [schedule, person, date],
  );
  // 구간별 행로 약호 분리: "답마방기,기방마답" → ["답마방기", "기방마답"]
  const routeParts = useMemo(() => {
    if (!schedule.m || schedule.m.includes('충당여부') || schedule.m.includes('대휴')) return [];
    return schedule.m.split(',').map((p) => p.replace(/\s*\([^)]*\)/g, '').trim()).filter(Boolean);
  }, [schedule.m]);

  const segs = schedule.g;
  if (!segs || segs.length === 0) return null;
  const multi = segs.length > 1;

  return (
    <div className={styles.rt}>
      <div className={styles.rtLabel}>
        <TrainFront size={14} className={styles.rtLabelIcon} />{LABELS.SEGMENT_RUN}
      </div>

      <div className={styles.rtList}>
        {segs.map((seg, i) => {
          const partner = partners[i];
          const firstTrain = seg.n?.[0] ?? 0;
          const lastTrain = seg.n?.[seg.n.length - 1] ?? 0;
          const isFirstDepot = firstTrain >= 1000 && firstTrain < 3000;
          const isLastDepot = lastTrain >= 1000 && lastTrain < 3000;
          return (
            <div key={i} className={styles.rtLine}>
              <span className={styles.rtLineHead}>
                {multi && <span className={styles.rtNum}>{i + 1}근무</span>}
                {routeParts[i] && <span className={styles.rtRoute}>{routeParts[i]}</span>}
              </span>
              <span className={styles.rtLinePartners}>
                {!isFirstDepot && (
                  <span className={styles.rtPartner}>교대받음 <strong>{partner?.left ?? '타소'}</strong></span>
                )}
                {!isLastDepot && (
                  <span className={styles.rtPartner}>교대넘김 <strong>{partner?.right ?? '타소'}</strong></span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
