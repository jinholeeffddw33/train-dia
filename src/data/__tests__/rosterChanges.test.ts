import { describe, it, expect } from 'vitest';
import { P, getRoster } from '@/data/cycle';
import { ROSTER_CHANGES, departedSabuns } from '@/data/rosterChanges';
import { INTERN_USERS, EXTRA_USERS } from '@/lib/auth';

/** 발령 예약이 시행일 전후로 정확히 갈리는지 — 미리 반영되면 근무자가 틀리게 보인다 */
describe('명부 발령 예약 (rosterChanges)', () => {
  it('예약된 자리(I)가 실제 명부에 있고, 시행 전 이름이 replaces 와 일치한다', () => {
    const bad = ROSTER_CHANGES.filter((c) => {
      const slot = P.find((p) => p.I === c.I);
      return !slot || slot.n !== c.replaces;
    }).map((c) => `${c.n} → I=${c.I} (${c.replaces} 이어야 함)`);
    expect(bad).toEqual([]);
  });

  it('사번이 중복 배정되지 않는다', () => {
    const s = ROSTER_CHANGES.map((c) => c.s);
    expect(s.length).toBe(new Set(s).size);
  });

  it('한 자리에 두 명이 예약되지 않는다', () => {
    const i = ROSTER_CHANGES.map((c) => c.I);
    expect(i.length).toBe(new Set(i).size);
  });

  it('시행일 하루 전에는 결원, 시행일에는 본인이 앉는다', () => {
    for (const c of ROSTER_CHANGES) {
      const day = new Date(`${c.from}T12:00:00+09:00`);
      const before = new Date(day.getTime() - 24 * 3600_000);
      expect(getRoster(before).find((p) => p.I === c.I)?.n).toBe(c.replaces);
      expect(getRoster(day).find((p) => p.I === c.I)?.n).toBe(c.n);
      expect(getRoster(day).find((p) => p.I === c.I)?.s).toBe(c.s);
    }
  });

  it('시행일이 지나면 인턴/내근 목록에서 빠진다 (한 사람이 두 번 잡히지 않음)', () => {
    for (const c of ROSTER_CHANGES.filter((x) => x.leaves)) {
      const day = new Date(`${c.from}T12:00:00+09:00`);
      const src = c.leaves === 'intern' ? INTERN_USERS : EXTRA_USERS;
      expect(src.some((u) => u.s === c.s)).toBe(true);            // 원본에는 아직 있고
      expect(departedSabuns(c.leaves!, day).has(c.s)).toBe(true); // 시행일엔 제외 대상
    }
  });

  it('시행 후에도 명부는 171명 그대로다', () => {
    const last = ROSTER_CHANGES.map((c) => c.from).sort().at(-1)!;
    expect(getRoster(new Date(`${last}T12:00:00+09:00`)).length).toBe(P.length);
  });
});
