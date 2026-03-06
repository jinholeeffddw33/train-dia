import { describe, it, expect } from 'vitest';
import { getDia, getType, getSchedule, isHoliday, getDiaDisplay, getLabel, getMonthSummary, calcWorkTime, timeToMins, getNextShift } from '../schedule';
import { P, CYCLE, CL } from '@/data/cycle';

describe('getDia — 교번 계산', () => {
  it('DB_STD 기준일에 1번 기관사의 교번은 자신의 초기 교번', () => {
    const person = P[0]; // 1번 기관사
    const dbStd = new Date(2026, 2, 3); // 2026-03-03
    const dia = getDia(person, dbStd);
    expect(dia).toBe(person.d);
  });

  it('171일 뒤에 같은 교번으로 순환', () => {
    const person = P[0];
    const dbStd = new Date(2026, 2, 3);
    const after171 = new Date(2026, 2, 3);
    after171.setDate(after171.getDate() + 171);
    expect(getDia(person, after171)).toBe(getDia(person, dbStd));
  });

  it('null person이면 ~', () => {
    expect(getDia(null, new Date())).toBe('~');
  });

  it('CYCLE 길이는 171', () => {
    expect(CL).toBe(171);
    expect(CYCLE.length).toBe(171);
  });

  it('모든 기관사(171명)가 유효한 교번을 가짐', () => {
    const date = new Date(2026, 1, 15);
    for (const p of P) {
      const dia = getDia(p, date);
      expect(dia).toBeTruthy();
      expect(typeof dia).toBe('string');
    }
  });

  it('연속 7일 교번이 전부 같지 않음 (다양한 근무)', () => {
    const person = P[0];
    const dias = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 1, 10 + i);
      dias.add(getDia(person, d));
    }
    // 7일 연속 완전히 같은 교번은 불가능
    expect(dias.size).toBeGreaterThan(1);
  });
});

describe('getType — 교번 타입 판별', () => {
  it('휴X → rest', () => {
    expect(getType('휴A')).toBe('rest');
    expect(getType('휴1')).toBe('rest');
  });

  it('X~ → rest (비번)', () => {
    expect(getType('62~')).toBe('rest');
    expect(getType('1~')).toBe('rest');
  });

  it('대X → standby', () => {
    expect(getType('대1')).toBe('standby');
    expect(getType('대62')).toBe('standby');
  });

  it('1~44 → day', () => {
    expect(getType('1')).toBe('day');
    expect(getType('22')).toBe('day');
    expect(getType('44')).toBe('day');
  });

  it('62~91 → night', () => {
    expect(getType('62')).toBe('night');
    expect(getType('75')).toBe('night');
    expect(getType('91')).toBe('night');
  });
});

describe('isHoliday — 공휴일 판별', () => {
  it('일요일은 공휴일', () => {
    // 2026-02-01 is Sunday
    expect(isHoliday(new Date(2026, 1, 1))).toBe(true);
  });

  it('토요일은 공휴일', () => {
    // 2026-02-07 is Saturday
    expect(isHoliday(new Date(2026, 1, 7))).toBe(true);
  });

  it('평일은 공휴일 아님 (HOL에 없으면)', () => {
    // 2026-02-02 is Monday
    expect(isHoliday(new Date(2026, 1, 2))).toBe(false);
  });

  it('설날은 공휴일 (2026)', () => {
    // 2026 설날: 2/17~2/19
    expect(isHoliday(new Date(2026, 1, 17))).toBe(true);
  });
});

describe('getDiaDisplay — 교번 표시명', () => {
  it('휴X → 휴무', () => {
    expect(getDiaDisplay('휴A')).toBe('휴무');
  });

  it('X~ → 비번', () => {
    expect(getDiaDisplay('62~')).toBe('비번');
  });

  it('숫자 → 그대로', () => {
    expect(getDiaDisplay('22')).toBe('22');
  });
});

describe('getLabel — 교번 라벨', () => {
  it('근무 타입별 라벨', () => {
    expect(getLabel('1')).toBe('주간');
    expect(getLabel('62')).toBe('야간');
    expect(getLabel('대1')).toBe('대기');
    expect(getLabel('휴A')).toBe('휴무');
    expect(getLabel('62~')).toBe('비번');
  });
});

describe('timeToMins — 시간 변환', () => {
  it('정상 변환', () => {
    expect(timeToMins('08:30')).toBe(510);
    expect(timeToMins('0:00')).toBe(0);
    expect(timeToMins('23:59')).toBe(1439);
  });

  it('잘못된 형식 → -1', () => {
    expect(timeToMins('')).toBe(-1);
    expect(timeToMins('abc')).toBe(-1);
  });
});

describe('calcWorkTime — 근무시간 계산', () => {
  it('주간 (같은 날)', () => {
    expect(calcWorkTime('08:00', '17:00')).toBe('9:00');
  });

  it('야간 (날짜 넘김)', () => {
    expect(calcWorkTime('22:00', '06:00')).toBe('8:00');
  });
});

describe('getMonthSummary — 월간 요약', () => {
  it('171명 중 1번째 기관사 2026년 2월', () => {
    const person = P[0];
    const summary = getMonthSummary(person, 2026, 2);
    const total = summary.dayWork + summary.nightWork + summary.dayStandby + summary.nightStandby;
    // 2월 28일 중 근무일 수는 일부 (나머지는 비번/휴무)
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(28);
  });
});

describe('getSchedule — 스케줄 조회', () => {
  it('휴무 교번은 null', () => {
    expect(getSchedule('휴A', new Date(2026, 1, 2))).toBeNull();
  });

  it('비번 교번은 null', () => {
    expect(getSchedule('62~', new Date(2026, 1, 2))).toBeNull();
  });

  it('주간 교번 1번은 스케줄이 있어야 함', () => {
    const sc = getSchedule('1', new Date(2026, 1, 2)); // 평일
    expect(sc).not.toBeNull();
    if (sc) {
      expect(sc.s).toBeTruthy(); // 출근 시간
      expect(sc.e).toBeTruthy(); // 퇴근 시간
    }
  });
});

describe('getNextShift — 다음 근무일 탐색', () => {
  it('비번/휴무 후 다음 근무일을 찾음', () => {
    const person = P[0];
    const result = getNextShift(person, new Date(2026, 1, 1));
    // 최대 7일 내에 근무일이 있어야 함
    if (result) {
      expect(result.daysAhead).toBeGreaterThan(0);
      expect(result.daysAhead).toBeLessThanOrEqual(7);
    }
  });
});

describe('전수 검증 — 171명 × 30일', () => {
  it('모든 기관사 × 모든 날짜에서 getDia 에러 없음', () => {
    for (const person of P) {
      for (let d = 1; d <= 30; d++) {
        const date = new Date(2026, 1, d);
        const dia = getDia(person, date);
        expect(typeof dia).toBe('string');
        expect(dia.length).toBeGreaterThan(0);
      }
    }
  });

  it('모든 기관사 × 모든 날짜에서 getType 유효한 타입', () => {
    const validTypes = ['day', 'night', 'standby', 'rest'];
    for (const person of P) {
      for (let d = 1; d <= 28; d++) {
        const date = new Date(2026, 1, d);
        const dia = getDia(person, date);
        const type = getType(dia);
        expect(validTypes).toContain(type);
      }
    }
  });
});
