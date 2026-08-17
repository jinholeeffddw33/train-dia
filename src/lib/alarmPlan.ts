/**
 * 근무 알람 계산 SSOT — 2026-08-18
 *
 * "언제 울려야 하는가"를 **한 곳에서만** 정한다. 소비처는 둘이다:
 *   · 웹(브라우저·PWA)  — 30초마다 폴링하며 "지금이 그 시각인가"를 본다 (앱이 열려 있어야만 동작)
 *   · 네이티브 앱       — 이 목록을 통째로 OS 에 **예약**한다 (앱이 꺼져 있어도 울린다)
 *
 * ★ 규칙을 두 벌로 두지 않는 이유 — 나중에 한쪽만 고쳐지기 때문이다.
 *   "기지 열번은 1시간 전 알람도 준다" 같은 규칙이 폴링에만 반영되고 예약에 빠지면,
 *   앱을 켜 둔 사람과 꺼 둔 사람이 **다른 알람**을 받는다. 그건 근무 앱에서 사고다.
 *
 * ★ now 를 인자로 받는 이유 — Date.now() 를 내부에서 부르면 테스트가 시간에 종속된다.
 *   야간 근무(자정 넘김)·기지 출고 같은 경계는 정확히 그 시각을 만들어 검증해야 한다.
 */
import type { Segment } from '@/lib/types';
import { timeToMins } from '@/lib/schedule';
import { DEPOT_OPTIONS, ALARM_LABELS, type AlarmMinute, type FixedTime } from '@/stores/alarm';

/** 하루 = 1440분. 자정을 넘긴 시각을 같은 축에 올릴 때 쓴다. */
const DAY_MINUTES = 1440;
/**
 * 다음 구간 출발이 이전 구간 도착보다 이만큼 이상 "빠르면" 자정을 넘긴 것으로 본다.
 * (예: 이전 도착 23:40, 다음 출발 00:20 → 20분이 1400분보다 작다 → 익일)
 * 4시간(240분)은 기존 폴링 구현이 쓰던 임계를 그대로 옮긴 것이다.
 */
const OVERNIGHT_GAP_MINUTES = 240;

export interface AlarmEvent {
  /** 중복 발화 방지 키. 웹 폴링의 `fired` 목록과 포맷을 맞춘다. */
  key: string;
  /** 울려야 할 절대 시각 */
  at: Date;
  title: string;
  body: string;
}

export interface AlarmPlanInput {
  /** 오늘 근무의 구간 배열 (schedule.g) */
  segments: Segment[] | undefined;
  /** 출근 시각 (schedule.s) */
  scheduleStart: string | undefined;
  /** 선택된 상대 알람 (분 전) */
  selected: AlarmMinute[];
  /** 선택된 고정 시각 알람 */
  fixedTimes: FixedTime[];
  /** 기준 시각 — 이보다 미래인 알람만 계획에 담는다 */
  now: Date;
}

/**
 * 기지 출고 열번인가 — 첫 번째 열차번호 기준.
 * 1000~1499 / 1500~1599 / 2000~2999 가 기지 출고다(도메인 규칙, DOMAIN_RULES.md).
 * 기지 출고는 준비가 더 필요해서 1시간·1시간10분 전 알람이 여기서만 열린다.
 */
export function isDepotTrain(seg: Segment): boolean {
  if (!seg.n || seg.n.length === 0) return false;
  const first = seg.n[0];
  return (first >= 1000 && first <= 1499) || (first >= 1500 && first <= 1599) || (first >= 2000 && first <= 2999);
}

/** 그 날 00:00 을 기준으로 minutes 분 뒤의 절대 시각 (minutes 가 1440 을 넘으면 자연히 다음 날) */
function atMinutes(base: Date, minutes: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/** 웹 폴링의 `fired` 키와 같은 날짜 표기 (new Date().toDateString()) */
function dateKeyOf(d: Date): string {
  return d.toDateString();
}

/**
 * 구간별 출발 시각을 **하나의 증가하는 축**으로 편다.
 * 근무표는 시:분만 있어서 23:50 다음의 00:20 이 "더 이른 시각"으로 보인다.
 * 이전 구간 도착보다 크게 뒤로 가면 자정을 넘긴 것으로 보고 +1440 한다.
 * 반환값은 근무 시작일 00:00 기준 분(1440 을 넘을 수 있다).
 */
function unfoldDepartures(segments: Segment[]): number[] {
  return segments.map((seg, i) => {
    let dep = timeToMins(seg.d);
    if (dep < 0) return -1;
    if (i > 0) {
      const prevArr = timeToMins(segments[i - 1].a);
      if (prevArr >= 0 && dep < prevArr - OVERNIGHT_GAP_MINUTES) dep += DAY_MINUTES;
    }
    return dep;
  });
}

/**
 * 지금 이후에 울려야 할 알람 전부를 시간순으로 돌려준다.
 *
 * 상대 알람은 **2근무부터**(i>=1) 건다 — 1근무 출발은 출근 시각이라 이미 알고 나온다.
 * (기존 폴링 구현의 `for (let i = 1; ...)` 을 그대로 옮긴 것)
 */
export function buildAlarmPlan({
  segments,
  scheduleStart,
  selected,
  fixedTimes,
  now,
}: AlarmPlanInput): AlarmEvent[] {
  const events: AlarmEvent[] = [];

  // ── 고정 시각 알람 (DIA 85~91: 04:30 / 04:40) ──────────────────
  // 알람 시계의 상식대로 "다음에 오는 그 시각"을 잡는다. 오늘 04:30 이 이미 지났으면 내일 04:30.
  for (const ft of fixedTimes) {
    const mins = timeToMins(ft);
    if (mins < 0) continue;

    let at = atMinutes(now, mins);
    if (at.getTime() <= now.getTime()) {
      at = atMinutes(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), mins);
    }
    events.push({
      key: `${dateKeyOf(at)}_fixed_${ft}`,
      at,
      title: `익일 근무 알람 (${ft})`,
      body: '출발 준비하세요!',
    });
  }

  // ── 상대 시간 알람 (10/20/30분 전 · 기지는 1시간/1시간10분 전 추가) ──
  if (segments && segments.length >= 2 && selected.length > 0) {
    const departures = unfoldDepartures(segments);

    // 근무 기준일 = 출근 시각이 속한 날. 지금이 자정을 넘긴 새벽이고 근무가 어제 낮에
    // 시작했다면(출근이 정오 이후), 기준일은 어제다 — 안 그러면 하루 뒤에 예약된다.
    const startMins = scheduleStart ? timeToMins(scheduleStart) : -1;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const crossedMidnight = startMins >= 720 && nowMins < 720 && nowMins < startMins;
    const baseDate = crossedMidnight
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      : now;

    for (let i = 1; i < segments.length; i++) {
      const dep = departures[i];
      if (dep < 0) continue;

      const depot = isDepotTrain(segments[i]);

      for (const alarmMin of selected) {
        // 기지 전용 옵션(1시간/1시간10분 전)은 기지 출고 열번에만 준다
        if (DEPOT_OPTIONS.includes(alarmMin) && !depot) continue;

        const at = atMinutes(baseDate, dep - alarmMin);
        if (at.getTime() <= now.getTime()) continue; // 이미 지난 알람은 계획에 없다

        const label = ALARM_LABELS[alarmMin];
        const overnight = dep >= DAY_MINUTES;
        events.push({
          key: `${dateKeyOf(baseDate)}_${i}_${alarmMin}`,
          at,
          title: `${i + 1}근무 출발 ${label}${overnight ? ' (익일)' : ''}`,
          body: `${segments[i].d} 출발 예정 — 준비하세요!`,
        });
      }
    }
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}
