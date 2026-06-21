'use client';

import { useMemo, useState } from 'react';
import { TrainFront, Bell, BellOff } from 'lucide-react';
import type { Schedule, Person } from '@/lib/types';
import { findExchangePartners, timeToMins } from '@/lib/schedule';
import { LABELS } from '@/lib/constants';
import { useAlarmStore, NORMAL_OPTIONS, DEPOT_OPTIONS, ALARM_LABELS, FIXED_TIME_OPTIONS } from '@/stores/alarm';
import { useDriverStore } from '@/stores/driver';
import styles from '../styles/Home.module.css';

interface RouteTimelineProps {
  schedule: Schedule;
  person: Person;
  date: Date;
  dia?: string;
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

/** 기지 출고 열번 여부 */
/** 기지 출고 열번 여부 — 첫 번째 열차번호가 1000/1500/2000대일 때만 */
function isDepotTrain(n?: number[]): boolean {
  if (!n || n.length === 0) return false;
  const first = n[0];
  return (first >= 1000 && first <= 1499) || (first >= 1500 && first <= 1599) || (first >= 2000 && first <= 2999);
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
export default function RouteTimeline({ schedule, person, date, dia }: RouteTimelineProps) {
  const segs = schedule.g;
  if (!segs || segs.length === 0) return null;

  const multi = segs.length > 1;
  const myDriver = useDriverStore((s) => s.myDriver);
  const isMe = myDriver && person.I === myDriver.I;
  const { selected: alarmSelected, toggle: toggleAlarm, fixedTimes, toggleFixed } = useAlarmStore();
  // DIA 85~91 판별
  const diaNum = dia ? parseInt(dia.replace(/\D/g, '')) : 0;
  const isDia85to91 = diaNum >= 85 && diaNum <= 91;
  const [alarmOpenIdx, setAlarmOpenIdx] = useState<number | null>(null);

  // 야간 여부 (익일 근무 판별)
  const isOvernight = useMemo(() => {
    if (!schedule.s || !schedule.e) return false;
    return timeToMins(schedule.e) <= timeToMins(schedule.s);
  }, [schedule.s, schedule.e]);

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

            {/* 구간 간 대기시간 + 알람 설정 (내 기관사만) */}
            {multi && i < segs.length - 1 && seg.a && segs[i + 1].d && (() => {
              const wait = calcWaitMin(seg.a, segs[i + 1].d);
              if (wait <= 0) return null;

              const nextSeg = segs[i + 1];
              const depot = isDepotTrain(nextSeg.n);
              const nextIdx = i + 1;
              const isOpen = alarmOpenIdx === nextIdx;
              // 익일 근무 판별: 다음 구간 출발이 현재 구간 도착보다 4시간+ 이르면 익일
              const nextDep = timeToMins(nextSeg.d);
              const curArr = timeToMins(seg.a);
              const isNextDay = nextDep < curArr - 240;
              // DIA 85~91 익일 구간: 04:30/04:40 고정 알람
              const useFixedAlarm = isDia85to91 && isNextDay;
              const hasAlarm = useFixedAlarm
                ? fixedTimes.length > 0
                : alarmSelected.length > 0;

              return (
                <div className={styles.rtGapAlarm}>
                  <div className={styles.rtGap}>
                    <span>{formatDuration(wait)} 대기</span>
                  </div>
                  {/* 알람 토글 버튼 — 버튼 4법: 분리 상태선택(미선택=② 무색 솟음 / 선택=③ 3D 채움) */}
                  <button
                    type="button"
                    className={`${hasAlarm ? 'z-cta z-cta-sky' : 'z-glass-pill'} ${styles.alarmToggle} ${hasAlarm ? styles.alarmToggleOn : ''}`}
                    onClick={() => setAlarmOpenIdx(isOpen ? null : nextIdx)}
                    aria-label={`${nextIdx + 1}근무 알람 설정`}
                  >
                    {hasAlarm ? <Bell size={14} /> : <BellOff size={14} />}
                    <span>{hasAlarm
                      ? useFixedAlarm
                        ? `알람 ${fixedTimes.join(', ')}`
                        : `알람 ${alarmSelected.length}개`
                      : '알람'}</span>
                    {isNextDay && <span className={styles.alarmNextDay}>익일</span>}
                  </button>
                  {/* 알람 칩 피커 */}
                  {isOpen && (
                    <div className={styles.alarmPicker}>
                      <div className={styles.alarmPickerLabel}>
                        {nextIdx + 1}근무 출발 알람{isNextDay ? ' (익일)' : ''}
                      </div>
                      {/* DIA 85~91 익일: 04:30/04:40 고정 시각만 */}
                      {useFixedAlarm ? (
                        <div className={styles.alarmChips}>
                          {FIXED_TIME_OPTIONS.map((t) => (
                            <button
                              key={t}
                              type="button"
                              className={`${fixedTimes.includes(t) ? 'z-cta z-cta-sky' : 'z-glass-pill'} ${styles.alarmChip} ${fixedTimes.includes(t) ? styles.alarmChipOn : ''}`}
                              onClick={() => toggleFixed(t)}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      ) : isNextDay && depot ? (
                        /* 익일 기지 출고 (85~91 외): 1시간/1시간10분전만 */
                        <div className={styles.alarmChips}>
                          {DEPOT_OPTIONS.map((m) => (
                            <button
                              key={m}
                              type="button"
                              className={`${alarmSelected.includes(m) ? 'z-cta z-cta-sky' : 'z-glass-pill'} ${styles.alarmChip} ${alarmSelected.includes(m) ? styles.alarmChipOn : ''}`}
                              onClick={() => toggleAlarm(m)}
                            >
                              {ALARM_LABELS[m]}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className={styles.alarmChips}>
                            {NORMAL_OPTIONS.map((m) => (
                              <button
                                key={m}
                                type="button"
                                className={`${alarmSelected.includes(m) ? 'z-cta z-cta-sky' : 'z-glass-pill'} ${styles.alarmChip} ${alarmSelected.includes(m) ? styles.alarmChipOn : ''}`}
                                onClick={() => toggleAlarm(m)}
                              >
                                {ALARM_LABELS[m]}
                              </button>
                            ))}
                          </div>
                          {depot && (
                            <>
                              <div className={styles.alarmPickerLabel}>기지 출고</div>
                              <div className={styles.alarmChips}>
                                {DEPOT_OPTIONS.map((m) => (
                                  <button
                                    key={m}
                                    type="button"
                                    className={`${alarmSelected.includes(m) ? 'z-cta z-cta-sky' : 'z-glass-pill'} ${styles.alarmChip} ${alarmSelected.includes(m) ? styles.alarmChipOn : ''}`}
                                    onClick={() => toggleAlarm(m)}
                                  >
                                    {ALARM_LABELS[m]}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}

    </div>
  );
}
