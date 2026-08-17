import { describe, it, expect } from 'vitest';
import { S } from '@/data/schedules';
import { buildAlarmPlan, isDepotTrain } from '@/lib/alarmPlan';
import { timeToMins } from '@/lib/schedule';
import { NORMAL_OPTIONS, DEPOT_OPTIONS, type AlarmMinute } from '@/stores/alarm';
import type { Schedule } from '@/lib/types';

/**
 * 실데이터 역감사 — 픽스처가 아니라 **진짜 근무표 전체**를 알람 엔진에 먹인다.
 *
 * 왜 따로 두나: 픽스처 테스트(alarmPlan.test.ts)는 내가 만든 입력만 본다.
 * "그 입력이 실제로 오는 모양인가"는 검증하지 못한다 —
 * ZINOSB 에서 픽스처가 서버 계약과 달라 위험 경로를 통째로 비껴간 사고가 있었고,
 * 통계 화면은 픽스처 27건이 전부 초록인데 실데이터를 넣자 부호가 뒤집혀 있었다.
 *
 * 여기서는 값을 하나하나 못 박는 대신 **불변식**을 검사한다.
 * 스케줄 테이블이 바뀌어도(행로표는 시즌마다 교체된다) 계속 유효한 조건들이다.
 */

/** 스케줄 테이블 6종을 전부 펼친다 (평/휴 조합) */
function allSchedules(): { key: string; table: string; sched: Schedule }[] {
  const out: { key: string; table: string; sched: Schedule }[] = [];
  for (const [table, entries] of Object.entries(S)) {
    for (const [key, sched] of Object.entries(entries as Record<string, Schedule>)) {
      out.push({ key, table, sched });
    }
  }
  return out;
}

/** 구간이 2개 이상 = 상대 알람이 걸릴 수 있는 근무 */
function multiSegment() {
  return allSchedules().filter(({ sched }) => (sched.g?.length ?? 0) >= 2);
}

const BASE = new Date(2026, 7, 18, 0, 0, 0, 0); // 근무 당일 자정 — 그날 알람이 전부 미래가 된다

describe('실데이터 역감사 — 근무표 전체를 엔진에 먹인다', () => {
  it('스케줄 테이블이 실제로 로드된다 (빈 데이터로 통과하는 착시 방지)', () => {
    const all = allSchedules();
    expect(all.length).toBeGreaterThan(100);
    expect(multiSegment().length).toBeGreaterThan(20);
  });

  it('모든 알람은 그 구간 출발보다 앞선다 — 출발 뒤에 울리는 알람이 0건', () => {
    const violations: string[] = [];

    for (const { key, table, sched } of multiSegment()) {
      const plan = buildAlarmPlan({
        segments: sched.g,
        scheduleStart: sched.s,
        selected: [...NORMAL_OPTIONS, ...DEPOT_OPTIONS],
        fixedTimes: [],
        now: BASE,
      });

      for (const event of plan) {
        // key 포맷: `${dateKey}_${segIndex}_${alarmMin}`
        const parts = event.key.split('_');
        const segIdx = Number(parts[parts.length - 2]);
        const alarmMin = Number(parts[parts.length - 1]);
        const seg = sched.g?.[segIdx];
        if (!seg) { violations.push(`${table}/${key}: 존재하지 않는 구간 ${segIdx}`); continue; }

        const depMins = timeToMins(seg.d);
        const alarmMins = event.at.getHours() * 60 + event.at.getMinutes();
        // 자정을 넘긴 구간은 날짜가 하루 뒤이므로 분 비교 대신 "간격"으로 본다
        const gap = alarmMin;
        expect(gap).toBeGreaterThan(0);

        // 알람 시각 + 선택분 = 출발 시각 (mod 1440)
        const expected = ((alarmMins + gap) % 1440 + 1440) % 1440;
        if (expected !== depMins % 1440) {
          violations.push(
            `${table}/${key} ${segIdx}구간: 출발 ${seg.d} 인데 알람이 ${gap}분 전이 아님 ` +
            `(알람 ${event.at.getHours()}:${String(event.at.getMinutes()).padStart(2, '0')})`
          );
        }
      }
    }

    expect(violations.slice(0, 10)).toEqual([]);
  });

  it('기지 전용 알람(1시간·1시간10분 전)은 기지 출고 구간에만 걸린다', () => {
    const violations: string[] = [];

    for (const { key, table, sched } of multiSegment()) {
      const plan = buildAlarmPlan({
        segments: sched.g,
        scheduleStart: sched.s,
        selected: DEPOT_OPTIONS,
        fixedTimes: [],
        now: BASE,
      });

      for (const event of plan) {
        const parts = event.key.split('_');
        const segIdx = Number(parts[parts.length - 2]);
        const seg = sched.g?.[segIdx];
        if (seg && !isDepotTrain(seg)) {
          violations.push(`${table}/${key} ${segIdx}구간(${seg.n?.join(',') ?? '열번없음'}) — 기지가 아닌데 기지 알람`);
        }
      }
    }

    expect(violations.slice(0, 10)).toEqual([]);
  });

  it('알람 시각이 근무일 기준 48시간 안에 있다 — 터무니없는 미래로 튄 계획 0건', () => {
    const outliers: string[] = [];
    const limit = BASE.getTime() + 48 * 60 * 60 * 1000;

    for (const { key, table, sched } of multiSegment()) {
      const plan = buildAlarmPlan({
        segments: sched.g,
        scheduleStart: sched.s,
        selected: [...NORMAL_OPTIONS, ...DEPOT_OPTIONS],
        fixedTimes: [],
        now: BASE,
      });
      for (const event of plan) {
        if (event.at.getTime() > limit) {
          outliers.push(`${table}/${key}: ${event.at.toISOString()} (${event.title})`);
        }
      }
    }

    expect(outliers.slice(0, 10)).toEqual([]);
  });

  it('계획은 항상 시간순이고 중복 키가 없다', () => {
    for (const { sched } of multiSegment().slice(0, 60)) {
      const plan = buildAlarmPlan({
        segments: sched.g,
        scheduleStart: sched.s,
        selected: [...NORMAL_OPTIONS, ...DEPOT_OPTIONS],
        fixedTimes: ['04:30', '04:40'],
        now: BASE,
      });

      const times = plan.map((e) => e.at.getTime());
      expect(times).toEqual([...times].sort((a, b) => a - b));

      const keys = plan.map((e) => e.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('야간 근무(자정을 넘기는 근무)가 실제로 데이터에 있고, 그 알람이 다음 날로 계산된다', () => {
    // 자정을 넘기는 근무를 데이터에서 찾는다 — 없으면 이 테스트의 전제가 무너진 것이다
    const overnight = multiSegment().filter(({ sched }) => {
      const g = sched.g!;
      for (let i = 1; i < g.length; i++) {
        const prevArr = timeToMins(g[i - 1].a);
        const dep = timeToMins(g[i].d);
        if (prevArr >= 0 && dep >= 0 && dep < prevArr - 240) return true;
      }
      return false;
    });

    expect(overnight.length).toBeGreaterThan(0);

    /**
     * 자정을 넘긴 **출발**에는 (익일) 표시가 붙는다.
     *
     * ⚠️ 알람 시각 자체는 당일일 수 있다 — 익일 00:20 출발의 30분 전은 전날 23:50 이다.
     *   (첫 작성 때 "알람 날짜가 바뀔 것"으로 기대했다가 이 테스트가 걸렸다.
     *    코드가 아니라 기대가 틀렸던 것 — 픽스처 테스트도 23:50 을 맞다고 못 박아 두었다)
     */
    const withOvernightLabel = overnight.flatMap(({ sched }) =>
      buildAlarmPlan({
        segments: sched.g,
        scheduleStart: sched.s,
        selected: [30] as AlarmMinute[],
        fixedTimes: [],
        now: BASE,
      }).filter((e) => e.title.includes('익일')),
    );

    expect(withOvernightLabel.length).toBeGreaterThan(0);
    // 익일 출발 알람도 계획 시점(BASE) 이후여야 한다 — 과거로 새는 계획이 없다
    for (const e of withOvernightLabel) {
      expect(e.at.getTime()).toBeGreaterThan(BASE.getTime());
    }
  });
});
