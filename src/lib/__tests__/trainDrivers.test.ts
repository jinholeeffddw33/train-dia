/**
 * 열번 조회(findTrainDrivers) — 그날 이 열차번호를 누가 모는가.
 *
 * 사람 이름은 박지 않는다(발령이 나면 바뀐다). 대신 «구조» 를 지킨다.
 *   · 답십리에서 기관사가 바뀌는 열번은 양쪽 사람이 같은 시각에 바통을 넘긴다
 *   · 자정 넘어 새벽에 모는 열번은 전날 시작한 야간근무에서 찾는다
 *   · 답십리 기관사가 맡지 않은 쪽은 영등포 기관사다
 */
import { describe, it, expect } from 'vitest';
import { findTrainDrivers } from '../schedule';
import { S } from '@/data/schedules';
import type { Schedule } from '@/lib/types';

const DAY = new Date(2026, 8, 16); // 2026-09-16 (수)

describe('열번 조회', () => {
  it('답십리에서 바뀌는 열번은 두 사람이 같은 시각에 넘겨준다', () => {
    const rows = findTrainDrivers(5032, DAY).filter((r) => r.ours);
    const east = rows.find((r) => r.side === 'east');
    const west = rows.find((r) => r.side === 'west');
    expect(east && west).toBeTruthy();
    // 한 사람이 답십리에 도착한 시각 = 다음 사람이 답십리에서 출발한 시각
    expect(east!.to === west!.from || west!.to === east!.from).toBe(true);
    expect(findTrainDrivers(5032, DAY).some((r) => !r.ours)).toBe(false);
  });

  it('새벽 열번은 전날 시작한 야간근무에서 찾는다', () => {
    const rows = findTrainDrivers(1014, DAY).filter((r) => r.ours);
    expect(rows.length).toBeGreaterThan(0);
    const prev = new Date(2026, 8, 15);
    expect(rows.some((r) => r.diaDate && r.diaDate.getTime() === prev.getTime())).toBe(true);
  });

  it('답십리 기관사가 모르는 열번은 영등포 기관사 한 줄', () => {
    const rows = findTrainDrivers(9999, DAY);
    expect(rows).toHaveLength(1);
    expect(rows[0].ours).toBe(false);
    expect(rows[0].name).toBe('영등포 기관사');
    expect(rows[0].side).toBe('full');
  });

  it('우리 기관사 줄은 행로표를 열 다이아와 날짜를 갖는다', () => {
    for (const no of [5612, 5641, 1014, 5005, 5032]) {
      for (const r of findTrainDrivers(no, DAY).filter((x) => x.ours)) {
        expect(r.dia).toBeTruthy();
        expect(r.diaDate).toBeInstanceOf(Date);
        expect(r.from).toMatch(/^\d{2}:\d{2}$/);
      }
    }
  });

  it('한쪽만 맡은 열번이면 나머지 쪽은 영등포로 채운다', () => {
    // 그날 행로표에 나오는 열번을 모두 훑어, 한쪽만 맡은 경우 반대쪽이 영등포인지 본다
    const seen = new Set<number>();
    for (const table of Object.values(S)) {
      for (const sc of Object.values(table) as Schedule[]) {
        for (const g of sc.g ?? []) for (const n of g.n ?? []) seen.add(n);
      }
    }
    let checked = 0;
    for (const no of seen) {
      const rows = findTrainDrivers(no, DAY);
      const ours = rows.filter((r) => r.ours);
      if (ours.length === 0 || ours.some((r) => r.side === 'full')) continue;
      const sides = new Set(rows.map((r) => r.side));
      expect(sides.has('west') && sides.has('east')).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});
