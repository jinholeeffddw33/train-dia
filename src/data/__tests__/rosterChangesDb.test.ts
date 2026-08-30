import { describe, it, expect, afterEach } from 'vitest';
import { P, getRoster } from '@/data/cycle';
import {
  ROSTER_CHANGES,
  setDbRosterChanges,
  allChanges,
  activeChanges,
  departedSabuns,
  type RosterChange,
} from '@/data/rosterChanges';

/**
 * 관리자 모드(설정 → 명부 관리)에서 넣은 예약이 명부에 정확히 얹히는지.
 *
 * 여기가 틀리면 175명이 남의 교번을 본다 — 정적 목록과 DB 를 합치는 규칙,
 * 한 자리가 여러 번 바뀔 때 마지막 것이 이기는지, 시행일 경계를 못 넘는지를 못 박는다.
 */

const day = (d: string) => new Date(`${d}T12:00:00+09:00`);
const change = (o: Partial<RosterChange> & { from: string; I: string; n: string; s: string }): RosterChange =>
  ({ replaces: '', ...o });

afterEach(() => setDbRosterChanges([]));   // 다른 테스트로 새지 않게 되돌린다

describe('관리자 모드 명부 예약 (DB 얹기)', () => {
  it('아무것도 안 넣으면 정적 목록 그대로다', () => {
    setDbRosterChanges([]);
    expect(allChanges()).toEqual(ROSTER_CHANGES);
  });

  it('DB 예약이 명부에 반영된다 — 시행일부터', () => {
    setDbRosterChanges([change({ from: '2027-03-01', I: '55', n: '홍길동', s: '22699999' })]);

    const before = getRoster(day('2027-02-28')).find((p) => p.I === '55');
    const after = getRoster(day('2027-03-01')).find((p) => p.I === '55');

    expect(before?.n).toBe('결원06');          // 시행 전에는 원래 값
    expect(after?.n).toBe('홍길동');
    expect(after?.s).toBe('22699999');
  });

  it('같은 자리·같은 시행일이면 DB 가 정적 목록을 이긴다', () => {
    const stat = ROSTER_CHANGES[0];            // 2026-08-14 · 52번 김대환
    setDbRosterChanges([change({ from: stat.from, I: stat.I, n: '덮어쓴사람', s: '22688888' })]);

    const merged = allChanges().filter((c) => c.I === stat.I && c.from === stat.from);
    expect(merged).toHaveLength(1);            // 두 줄이 남으면 어느 쪽이 이길지 알 수 없다
    expect(merged[0].n).toBe('덮어쓴사람');
    expect(getRoster(day(stat.from)).find((p) => p.I === stat.I)?.n).toBe('덮어쓴사람');
  });

  it('한 자리가 여러 번 바뀌면 마지막 시행분이 이긴다 (넣은 순서와 무관)', () => {
    setDbRosterChanges([
      change({ from: '2027-05-01', I: '55', n: '나중사람', s: '22677777' }),
      change({ from: '2027-03-01', I: '55', n: '먼저사람', s: '22666666' }),
    ]);

    expect(getRoster(day('2027-03-01')).find((p) => p.I === '55')?.n).toBe('먼저사람');
    expect(getRoster(day('2027-04-30')).find((p) => p.I === '55')?.n).toBe('먼저사람');
    expect(getRoster(day('2027-05-01')).find((p) => p.I === '55')?.n).toBe('나중사람');
  });

  it('시행된 것만 activeChanges 에 담기고, 시행일 오름차순이다', () => {
    // 사번 앞자리 99 = 실제 직원과 절대 겹치지 않는 시험용
    setDbRosterChanges([
      change({ from: '2027-05-01', I: '56', n: 'ㄴ', s: '99955555' }),
      change({ from: '2027-03-01', I: '55', n: 'ㄱ', s: '99944444' }),
    ]);

    const at = activeChanges(day('2027-04-01')).filter((c) => c.s.startsWith('999'));
    expect(at.map((c) => c.n)).toEqual(['ㄱ']);         // 5월 것은 아직 아니다

    const later = activeChanges(day('2027-06-01')).map((c) => c.from);
    expect([...later]).toEqual([...later].sort());     // 정렬이 깨지면 덮어쓰기 순서가 뒤집힌다
  });

  it('leaves 를 적으면 시행일에 인턴 명단에서 빠진다', () => {
    setDbRosterChanges([
      change({ from: '2027-03-01', I: '55', n: '조건희', s: '22601134', leaves: 'intern' }),
    ]);
    expect(departedSabuns('intern', day('2027-02-28')).has('22601134')).toBe(false);
    expect(departedSabuns('intern', day('2027-03-01')).has('22601134')).toBe(true);
  });

  it('예약을 얹어도 명부 인원수는 그대로다', () => {
    setDbRosterChanges([change({ from: '2027-03-01', I: '55', n: '홍길동', s: '22699999' })]);
    expect(getRoster(day('2027-03-01')).length).toBe(P.length);
  });

  it('없는 자리를 가리키는 예약은 명부를 건드리지 않는다', () => {
    const base = getRoster(day('2027-03-01'));
    setDbRosterChanges([change({ from: '2027-03-01', I: '9999', n: '유령', s: '22600000' })]);
    expect(getRoster(day('2027-03-01'))).toEqual(base);
  });
});
