/**
 * 2026 추석 특별 다이아 — 지켜야 할 것.
 *   · 연휴 앞뒤 날짜는 평소 행로표 그대로 (특별 다이아가 새어 나가면 평소 근무가 틀어진다)
 *   · 9/23 저녁은 연결시작, 9/24~27 은 추석표, 쉬는 번호는 운휴로
 *   · 연결의 뜻 — 전날 야간조가 답십리에 넘기는 새벽 열차를 다음 날 누군가 받는다
 *   · 행로표 그림은 전부 실제 파일이 있다
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getSchedule, getRouteImagePath, isSpecialRest, getSpecialDayLabel } from '../schedule';
import { S } from '@/data/schedules';
import { SPECIAL_DAYS } from '@/data/specialDays';
import type { Schedule } from '../types';

const D = (m: number, d: number) => new Date(2026, m - 1, d);

describe('연휴 앞뒤는 평소 그대로', () => {
  it('9/22·9/23 주간과 9/28 은 평소 표', () => {
    expect(getSchedule('3', D(9, 22))).toBe(S.p_ord['3']);
    expect(getSchedule('3', D(9, 23))).toBe(S.p_ord['3']); // 9/23 은 저녁(야간)만 바뀐다
    expect(getSchedule('3', D(9, 28))).toBe(S.p_ord['3']);
    expect(getSchedule('70', D(9, 28))).toBe(S.p_ordord['70']);
    expect(getSpecialDayLabel(D(9, 22))).toBeNull();
    expect(getSpecialDayLabel(D(9, 28))).toBeNull();
  });

  it('9/28 행로표 그림도 평소 그림', () => {
    expect(getRouteImagePath('3', D(9, 28))).toBe('/images/route/p_ord_3.png');
  });
});

describe('추석 다이아', () => {
  it('9/23 저녁은 연결시작 — 퇴근이 9/24 아침으로 늘어난다', () => {
    const sc = getSchedule('62', D(9, 23))!;
    expect(sc).not.toBe(S.p_ordhol['62']);
    expect(sc.s).toBe('17:15');
    expect(sc.e).toBe('08:17');
  });

  it('9/24~27 주간은 1~34 만, 35~43 은 운휴', () => {
    for (const d of [24, 25, 26, 27]) {
      const three = getSchedule('3', D(9, d))!;
      expect(three.s).toBe('06:42');
      expect(three.e).toBe('15:34');
      for (const no of ['35', '38', '39', '43']) {
        expect(isSpecialRest(getSchedule(no, D(9, d))), `${d}일 ${no}`).toBe(true);
      }
    }
  });

  it('9/24~26 야간 62~68 은 운휴, 9/27 은 62 부터 돈다', () => {
    for (const d of [24, 25, 26]) {
      expect(isSpecialRest(getSchedule('62', D(9, d))), `${d}일`).toBe(true);
      expect(isSpecialRest(getSchedule('68', D(9, d))), `${d}일`).toBe(true);
      expect(getSchedule('69', D(9, d))?.g?.length).toBeGreaterThan(0);
    }
    expect(getSchedule('62', D(9, 27))?.g?.length).toBeGreaterThan(0);
  });

  it('9/26·9/27 저녁은 심야 1시간 연장 변경분이 덮인다', () => {
    expect(getSchedule('74', D(9, 26))).not.toBe(getSchedule('74', D(9, 25)));
    expect(getSchedule('74', D(9, 26))?.e).toBe('07:24');
    expect(getSchedule('64', D(9, 27))?.s).toBeTruthy();
    // 연장 변경이 없는 번호는 그날의 추석표 그대로
    expect(getSchedule('69', D(9, 26))).toBe(getSchedule('69', D(9, 25)));
  });

  it('쉬는 번호에는 행로표 그림이 없다', () => {
    expect(getRouteImagePath('35', D(9, 24))).toBeNull();
    expect(getRouteImagePath('62', D(9, 24))).toBeNull();
  });
});

describe('자료 무결성', () => {
  const shifts = Object.entries(SPECIAL_DAYS).flatMap(([date, sd]) =>
    [sd.day, sd.night].filter(Boolean).map((sh) => ({ date, sh: sh! })),
  );

  it('행로 약호의 근무 수와 구간 수가 맞고, 시각 모양이 바르다', () => {
    const bad: string[] = [];
    for (const { date, sh } of shifts) {
      for (const [dia, sc] of Object.entries(sh.table ?? {}) as [string, Schedule][]) {
        const parts = (sc.m ?? '').split(',').filter(Boolean);
        if (parts.length !== (sc.g?.length ?? 0)) bad.push(`${date} ${dia}: 약호 ${parts.length} / 구간 ${sc.g?.length}`);
        if (!/^\d{2}:\d{2}$/.test(sc.s) || !/^\d{2}:\d{2}$/.test(sc.e)) bad.push(`${date} ${dia}: 출퇴근 ${sc.s}/${sc.e}`);
        for (const g of sc.g ?? []) {
          if (!/^\d{2}:\d{2}$/.test(g.d) || !/^\d{2}:\d{2}$/.test(g.a) || !g.n?.length) bad.push(`${date} ${dia}: 구간 ${JSON.stringify(g)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('행로표 그림 파일이 전부 있다', () => {
    const missing: string[] = [];
    for (const { sh } of shifts) {
      for (const p of Object.values(sh.images ?? {})) {
        if (!fs.existsSync(path.join(process.cwd(), 'public', p))) missing.push(p);
      }
    }
    expect(missing).toEqual([]);
  });

  it('연결 — 9/23 저녁조가 답십리에 넘기는 새벽 열차를 9/24 에 누군가 받는다', () => {
    const night = SPECIAL_DAYS['2026-09-23'].night!.table!;
    const next = { ...SPECIAL_DAYS['2026-09-24'].day!.table!, ...night };
    const starts = new Set<number>();
    for (const sc of Object.values(next)) {
      const parts = (sc.m ?? '').split(',');
      (sc.g ?? []).forEach((g, i) => { if (parts[i]?.startsWith('답') && g.n?.length) starts.add(g.n[0]); });
    }
    const dangling: string[] = [];
    for (const [dia, sc] of Object.entries(night)) {
      const parts = (sc.m ?? '').split(',');
      const last = sc.g?.[sc.g.length - 1];
      if (!last?.n?.length || !parts[parts.length - 1]?.endsWith('답')) continue;
      const tr = last.n[last.n.length - 1];
      if (!starts.has(tr)) dangling.push(`${dia}다이아 ${tr}`);
    }
    expect(dangling).toEqual([]);
  });
});
