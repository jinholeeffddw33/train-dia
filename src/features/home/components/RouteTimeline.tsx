'use client';

import { useMemo } from 'react';
import { TrainFront } from 'lucide-react';
import type { Schedule, Person } from '@/lib/types';
import { findExchangePartners, timeToMins } from '@/lib/schedule';
import { LABELS } from '@/lib/constants';
import styles from '../styles/Home.module.css';

interface RouteTimelineProps {
  schedule: Schedule;
  person: Person;
  date: Date;
}

/** 분 → "N시간 M분" 포맷 */
function formatDuration(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

/** 두 시각 사이 분 차이 계산 */
function calcWaitMin(arr: string, dep: string): number {
  const a = timeToMins(arr);
  const d = timeToMins(dep);
  if (a < 0 || d < 0) return 0;
  let diff = d - a;
  if (diff < 0) diff += 1440;
  return diff;
}

/**
 * 운전행로 구간 타임라인 (v1 renderRoute 포팅)
 * - 구간별 블록 (N근무 / 소요시간)
 * - 출발시간 ─── 열차번호 ─── 도착시간
 * - 교대 상대 표시
 * - 구간 간 대기시간
 * - 원본 약호 텍스트
 */
export default function RouteTimeline({ schedule, person, date }: RouteTimelineProps) {
  const segs = schedule.g;
  if (!segs || segs.length === 0) return null;

  const multi = segs.length > 1;
  const partners = useMemo(
    () => findExchangePartners(schedule, person, date),
    [schedule, person, date],
  );

  // 구간별 행로 약호 분리: "답마방기,기방마답" → ["답마방기", "기방마답"]
  const routeParts = useMemo(() => {
    if (!schedule.m || schedule.m.includes('충당여부') || schedule.m.includes('대휴')) return [];
    return schedule.m.split(',').map(p => p.replace(/\s*\([^)]*\)/g, '').trim()).filter(Boolean);
  }, [schedule.m]);

  return (
    <div className={styles.rt}>
      <div className={styles.rtLabel}>
        <TrainFront size={14} className={styles.rtLabelIcon} />{LABELS.SEGMENT_RUN}
      </div>

      {segs.map((seg, i) => {
        const trains = seg.n ? seg.n.join(' / ') : '';
        const durMins = seg.d && seg.a ? calcWaitMin(seg.d, seg.a) : 0;
        const durStr = formatDuration(durMins);
        const partner = partners[i];

        // 1xxx/2xxx = 기지 입출고 → 교대 없음
        const firstTrain = seg.n?.[0] ?? 0;
        const lastTrain = seg.n?.[seg.n.length - 1] ?? 0;
        const isFirstDepot = firstTrain >= 1000 && firstTrain < 3000;
        const isLastDepot = lastTrain >= 1000 && lastTrain < 3000;

        return (
          <div key={i}>
            <div className={styles.rtBlock}>
              {/* N근무 헤더 + 행로 약호 */}
              {multi && (
                <div className={styles.rtHead}>
                  <span className={styles.rtNum}>
                    {i + 1}근무{routeParts[i] && <> : <span className={styles.rtRoute}>{routeParts[i]}</span></>}
                  </span>
                  {durStr && <span className={styles.rtDur}>{durStr}</span>}
                </div>
              )}
              {/* 단일 구간일 때도 행로 약호 표시 */}
              {!multi && routeParts[0] && (
                <div className={styles.rtHead}>
                  <span className={`${styles.rtNum} ${styles.rtRoute}`}>{routeParts[0]}</span>
                  {durStr && <span className={styles.rtDur}>{durStr}</span>}
                </div>
              )}

              {/* 구간 실행: 출발 → 열차번호 → 도착 */}
              <div className={styles.rtRun}>
                <span className={styles.rtDep}>{seg.d}</span>
                <div className={styles.rtMid}>
                  {trains && <span className={styles.rtTn}>{trains}</span>}
                </div>
                <span className={styles.rtArr}>{seg.a || '-'}</span>
              </div>

              {/* 교대 상대 — 1xxx/2xxx 기지 입출고면 해당 쪽 숨김 */}
              <div className={styles.rtPartnerRow}>
                {!isFirstDepot && (
                  partner?.left ? (
                    <span className={`${styles.rtPartner} ${styles.rtPartnerLeft}`}>
                      교대 <strong>{partner.left}</strong>
                    </span>
                  ) : (
                    <span className={`${styles.rtPartner} ${styles.rtPartnerOther}`}>
                      타소 교대
                    </span>
                  )
                )}
                {!isLastDepot && (
                  partner?.right ? (
                    <span className={`${styles.rtPartner} ${styles.rtPartnerRight}`}>
                      교대 <strong>{partner.right}</strong>
                    </span>
                  ) : (
                    <span className={`${styles.rtPartner} ${styles.rtPartnerOther} ${styles.rtPartnerRight}`}>
                      타소 교대
                    </span>
                  )
                )}
              </div>
            </div>

            {/* 구간 간 대기시간 */}
            {multi && i < segs.length - 1 && seg.a && segs[i + 1].d && (() => {
              const wait = calcWaitMin(seg.a, segs[i + 1].d);
              if (wait <= 0) return null;
              return (
                <div className={styles.rtGap}>
                  <span>{formatDuration(wait)} 대기</span>
                </div>
              );
            })()}
          </div>
        );
      })}

    </div>
  );
}
