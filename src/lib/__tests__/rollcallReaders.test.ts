/**
 * 점호 읽음 대상 — 그날 근무자만 센다.
 * 전 직원으로 세면 «안 읽은 사람» 이 늘 절반을 넘어 숫자가 뜻을 잃는다.
 */
import { describe, it, expect } from 'vitest';
import { workersOn } from '../rollcallReaders';
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
