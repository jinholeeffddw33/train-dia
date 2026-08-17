import { describe, it, expect } from 'vitest';
import { buildAlarmPlan, isDepotTrain } from '@/lib/alarmPlan';
import type { Segment } from '@/lib/types';

/**
 * 근무 알람 규칙 회귀 테스트.
 *
 * 이 규칙은 기관사가 **자다가 받는 알람**을 정한다. 틀리면 지각이거나, 한 시간 일찍 깬다.
 * 그래서 "대충 맞는지"가 아니라 경계마다 시각을 못 박아 확인한다.
 */

/** 2026-08-18(화) 지정 시각의 Date — 테스트가 실행 시점에 흔들리지 않게 고정한다 */
function at(h: number, m: number, day = 18): Date {
  return new Date(2026, 7, day, h, m, 0, 0);
}

/** 일반 열번 구간 (기지 출고 아님) */
function seg(d: string, a: string, n?: number[]): Segment {
  return { d, a, n };
}

describe('isDepotTrain — 기지 출고 판정', () => {
  it('1000·1500·2000번대는 기지 출고다', () => {
    expect(isDepotTrain(seg('05:00', '06:00', [1010]))).toBe(true);
    expect(isDepotTrain(seg('05:00', '06:00', [1550]))).toBe(true);
    expect(isDepotTrain(seg('05:00', '06:00', [2003]))).toBe(true);
  });

  it('일반 운행 열번(5xxx)과 열번 없는 구간은 기지 출고가 아니다', () => {
    expect(isDepotTrain(seg('05:00', '06:00', [5691]))).toBe(false);
    expect(isDepotTrain(seg('05:00', '06:00', []))).toBe(false);
    expect(isDepotTrain(seg('05:00', '06:00'))).toBe(false);
  });

  it('열차번호가 여러 개면 첫 번째로 판정한다', () => {
    expect(isDepotTrain(seg('05:00', '06:00', [1010, 5691]))).toBe(true);
    expect(isDepotTrain(seg('05:00', '06:00', [5691, 1010]))).toBe(false);
  });
});

describe('buildAlarmPlan — 상대 시간 알람', () => {
  const segments = [
    seg('08:00', '12:00', [5691]), // 1근무
    seg('14:00', '18:00', [5672]), // 2근무
  ];

  it('2근무 출발 30분 전에 정확히 울린다', () => {
    const plan = buildAlarmPlan({
      segments,
      scheduleStart: '07:30',
      selected: [30],
      fixedTimes: [],
      now: at(9, 0),
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].at).toEqual(at(13, 30));
    expect(plan[0].title).toContain('2근무 출발');
    expect(plan[0].body).toContain('14:00');
  });

  it('1근무 출발에는 알람을 걸지 않는다 — 출근 시각은 이미 알고 나온다', () => {
    const plan = buildAlarmPlan({
      segments,
      scheduleStart: '07:30',
      selected: [10, 20, 30],
      fixedTimes: [],
      now: at(6, 0), // 1근무(08:00) 알람도 아직 미래인 시각
    });

    // 2근무 것 3개만 나와야 한다 (1근무 07:30/07:40/07:50 은 없다)
    expect(plan).toHaveLength(3);
    expect(plan.every((e) => e.title.startsWith('2근무'))).toBe(true);
  });

  it('이미 지난 알람은 계획에 넣지 않는다', () => {
    const plan = buildAlarmPlan({
      segments,
      scheduleStart: '07:30',
      selected: [30],
      fixedTimes: [],
      now: at(13, 31), // 13:30 을 1분 지난 시점
    });

    expect(plan).toHaveLength(0);
  });

  it('여러 개를 고르면 시간순으로 정렬된다', () => {
    const plan = buildAlarmPlan({
      segments,
      scheduleStart: '07:30',
      selected: [10, 30, 20],
      fixedTimes: [],
      now: at(9, 0),
    });

    expect(plan.map((e) => e.at)).toEqual([at(13, 30), at(13, 40), at(13, 50)]);
  });

  it('구간이 1개뿐이면 상대 알람이 없다', () => {
    const plan = buildAlarmPlan({
      segments: [seg('08:00', '12:00', [5691])],
      scheduleStart: '07:30',
      selected: [30],
      fixedTimes: [],
      now: at(6, 0),
    });

    expect(plan).toHaveLength(0);
  });
});

describe('buildAlarmPlan — 기지 출고 전용 옵션', () => {
  it('기지 출고 열번이면 1시간·1시간10분 전 알람이 열린다', () => {
    const plan = buildAlarmPlan({
      segments: [seg('08:00', '12:00', [5691]), seg('14:00', '18:00', [1010])],
      scheduleStart: '07:30',
      selected: [60, 70],
      fixedTimes: [],
      now: at(9, 0),
    });

    expect(plan.map((e) => e.at)).toEqual([at(12, 50), at(13, 0)]);
  });

  it('일반 열번이면 1시간·1시간10분 전 알람은 주지 않는다', () => {
    const plan = buildAlarmPlan({
      segments: [seg('08:00', '12:00', [5691]), seg('14:00', '18:00', [5672])],
      scheduleStart: '07:30',
      selected: [60, 70],
      fixedTimes: [],
      now: at(9, 0),
    });

    expect(plan).toHaveLength(0);
  });

  it('기지 구간이라도 일반 옵션(30분 전)은 그대로 동작한다', () => {
    const plan = buildAlarmPlan({
      segments: [seg('08:00', '12:00', [5691]), seg('14:00', '18:00', [2003])],
      scheduleStart: '07:30',
      selected: [30, 60],
      fixedTimes: [],
      now: at(9, 0),
    });

    expect(plan.map((e) => e.at)).toEqual([at(13, 0), at(13, 30)]);
  });
});

describe('buildAlarmPlan — 야간 근무(자정 넘김)', () => {
  const nightSegments = [
    seg('22:00', '23:40', [5691]), // 1근무
    seg('00:20', '02:00', [5672]), // 2근무 — 자정을 넘겼다
  ];

  it('자정을 넘긴 구간을 다음 날로 계산한다 (그날 00:20 이 아니라 익일 00:20)', () => {
    const plan = buildAlarmPlan({
      segments: nightSegments,
      scheduleStart: '21:30',
      selected: [30],
      fixedTimes: [],
      now: at(22, 0), // 18일 밤
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].at).toEqual(at(23, 50, 18)); // 19일 00:20 의 30분 전 = 18일 23:50
    expect(plan[0].title).toContain('익일');
  });

  it('자정을 넘긴 뒤(새벽)에 계산해도 기준일이 어제로 잡혀 알람이 하루 밀리지 않는다', () => {
    // 19일 00:00 — 근무는 18일 21:30 출근, 알람은 19일 00:20 출발의 10분 전(19일 00:10)
    const plan = buildAlarmPlan({
      segments: nightSegments,
      scheduleStart: '21:30',
      selected: [10],
      fixedTimes: [],
      now: at(0, 0, 19),
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].at).toEqual(at(0, 10, 19));
  });
});

describe('buildAlarmPlan — 고정 시각 알람', () => {
  it('오늘 아직 안 지났으면 오늘 그 시각에 울린다', () => {
    const plan = buildAlarmPlan({
      segments: undefined,
      scheduleStart: undefined,
      selected: [],
      fixedTimes: ['04:30'],
      now: at(2, 0),
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].at).toEqual(at(4, 30));
  });

  it('오늘 이미 지났으면 내일 그 시각으로 넘긴다', () => {
    const plan = buildAlarmPlan({
      segments: undefined,
      scheduleStart: undefined,
      selected: [],
      fixedTimes: ['04:30'],
      now: at(10, 0),
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].at).toEqual(at(4, 30, 19));
  });

  it('두 개를 고르면 둘 다, 시간순으로 나온다', () => {
    const plan = buildAlarmPlan({
      segments: undefined,
      scheduleStart: undefined,
      selected: [],
      fixedTimes: ['04:40', '04:30'],
      now: at(2, 0),
    });

    expect(plan.map((e) => e.at)).toEqual([at(4, 30), at(4, 40)]);
  });

  it('고정 시각과 상대 알람을 같이 켜면 하나의 목록으로 합쳐 정렬한다', () => {
    const plan = buildAlarmPlan({
      segments: [seg('08:00', '12:00', [5691]), seg('14:00', '18:00', [5672])],
      scheduleStart: '07:30',
      selected: [30],
      fixedTimes: ['04:30'],
      now: at(2, 0),
    });

    expect(plan.map((e) => e.at)).toEqual([at(4, 30), at(13, 30)]);
  });
});

describe('buildAlarmPlan — 아무것도 안 켰을 때', () => {
  it('선택이 비어 있으면 계획도 비어 있다', () => {
    const plan = buildAlarmPlan({
      segments: [seg('08:00', '12:00'), seg('14:00', '18:00')],
      scheduleStart: '07:30',
      selected: [],
      fixedTimes: [],
      now: at(9, 0),
    });

    expect(plan).toEqual([]);
  });

  it('근무가 없는 날(segments 없음)에도 고정 시각 알람은 살아 있다', () => {
    const plan = buildAlarmPlan({
      segments: undefined,
      scheduleStart: undefined,
      selected: [30],
      fixedTimes: ['04:30'],
      now: at(2, 0),
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].title).toContain('익일 근무 알람');
  });
});
