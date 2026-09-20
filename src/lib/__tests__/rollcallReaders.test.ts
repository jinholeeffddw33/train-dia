/**
 * 점호 읽음 대상 — 그날 근무자만 센다.
 * 전 직원으로 세면 «안 읽은 사람» 이 늘 절반을 넘어 숫자가 뜻을 잃는다.
 */
import { describe, it, expect } from 'vitest';
import { workersOn, startMinutes, groupOf } from '../rollcallReaders';
import { getRoster } from '@/data/cycle';
import { getDia, getType } from '../schedule';

const DAY = new Date(2026, 8, 22); // 2026-09-22 (화)

describe('그날 근무자', () => {
  it('휴무·비번은 빠지고, 주간·야간·대기만 남는다', () => {
    const workers = workersOn(DAY);
    expect(workers.length).toBeGreaterThan(0);
    expect(workers.length).toBeLessThan(getRoster(DAY).length);
    for (const w of workers) {
      expect(['day', 'night', 'standby']).toContain(getType(w.dia));
      expect(w.sabun).toBeTruthy();
      expect(w.name).toBeTruthy();
    }
  });

  it('쉬는 사람은 한 명도 들어 있지 않다', () => {
    const working = new Set(workersOn(DAY).map((w) => w.sabun));
    const resting = getRoster(DAY).filter((p) => getType(getDia(p, DAY)) === 'rest');
    expect(resting.length).toBeGreaterThan(0);
    for (const p of resting) expect(working.has(p.s ?? '')).toBe(false);
  });

  it('추석 연휴처럼 운휴가 많은 날도 근무자를 셀 수 있다', () => {
    expect(workersOn(new Date(2026, 8, 25)).length).toBeGreaterThan(0);
  });
});

describe('줄 순서와 출근 시각', () => {
  it('주간 근무 → 주간 대기 → 야간 근무 → 야간 대기 순으로 묶인다', () => {
    const list = workersOn(DAY);
    const order = ['dayWork', 'dayStandby', 'nightWork', 'nightStandby'];
    const seen = list.map((w) => order.indexOf(w.group));
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    expect(new Set(list.map((w) => w.group)).size).toBe(4); // 평일이면 네 묶음이 다 있다
    expect(list.filter((w) => w.start).length).toBe(list.length); // 근무자는 모두 출근 시각이 있다
  });

  it('묶음 안에서는 출근 시각 순', () => {
    for (const g of ['dayWork', 'dayStandby', 'nightWork', 'nightStandby'] as const) {
      const mins = workersOn(DAY).filter((w) => w.group === g).map((w) => startMinutes(w.start));
      expect([...mins].sort((a, b) => a - b), g).toEqual(mins);
    }
  });

  it('대기는 61번부터 야간 — 대10 은 주간, 대61 은 야간', () => {
    expect(groupOf('대10')).toBe('dayStandby');
    expect(groupOf('대61')).toBe('nightStandby');
    expect(groupOf('34')).toBe('dayWork');
    expect(groupOf('62')).toBe('nightWork');
  });

  it('추석 연휴 운휴 번호는 근무자에서 빠진다', () => {
    const chuseok = new Date(2026, 8, 25);
    const dias = new Set(workersOn(chuseok).map((w) => w.dia));
    for (const off of ['35', '38', '62', '65']) expect(dias.has(off)).toBe(false);
    expect(dias.has('3')).toBe(true);
  });
});
