/**
 * 행로표 자료 자체의 앞뒤 맞춤 검사.
 *
 * 한 열차를 두 기관사가 동시에 몰 수는 없다. 그런데 휴평 63다이아에 그런 자리가 있었다.
 * 원본 행로도에서 1근무는 「답방답」(5612·5641, 20:10 답십리 도착)이고 이어지는
 * 20:11~21:01 고덕기지행은 편승인데, 자동 생성이 그 편승을 운전으로 합쳐 도착을 21:01 로
 * 늘리고 원본에 없는 5642 까지 붙였다. 5642 는 78다이아 것이라 두 다이아가 같은 열차를
 * 50분 겹쳐 물었고, 일요일마다 교대 상대가 어긋났다.
 *
 * 편승은 운전이 아니므로 구간에 넣지 않는다 — 62다이아처럼 도착 시각까지만 적는다.
 */

import { describe, it, expect } from 'vitest';
import { S } from '@/data/schedules';
import type { ScheduleTable } from '@/lib/types';

const toMins = (t?: string) => (t && t.includes(':') ? Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]) : -1);

describe('행로표 자료', () => {
  it('같은 열차를 두 다이아가 시간이 겹치게 물지 않는다', () => {
    const clashes: string[] = [];
    for (const [table, dias] of Object.entries(S) as [string, ScheduleTable][]) {
      const byTrain = new Map<number, { dia: string; dep: number; arr: number }[]>();
      for (const [dia, sc] of Object.entries(dias)) {
        for (const seg of sc.g ?? []) {
          if (!seg.n?.length) continue;
          const dep = toMins(seg.d), arr = toMins(seg.a);
          for (const t of seg.n) byTrain.set(t, [...(byTrain.get(t) ?? []), { dia, dep, arr }]);
        }
      }
      for (const [train, es] of byTrain) {
        for (let i = 0; i < es.length; i++) {
          for (let j = i + 1; j < es.length; j++) {
            // 교대는 「앞사람 도착 = 뒷사람 출발」이라 겹치지 않는다. 겹치면 자료가 틀린 것.
            const overlap = Math.min(es[i].arr, es[j].arr) - Math.max(es[i].dep, es[j].dep);
            if (overlap > 2) clashes.push(`${table} 열차${train}: ${es[i].dia}다이아 ↔ ${es[j].dia}다이아 ${overlap}분 겹침`);
          }
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  it('휴평 63다이아 1근무는 답방답 — 편승은 구간에 넣지 않는다', () => {
    const d63 = S.p_holord['63'];
    expect(d63.m?.split(',')[0]).toBe('답방답');
    expect(d63.g?.[0]).toMatchObject({ d: '18:02', a: '20:10', n: [5612, 5641] });
  });

  it('행로 약호의 근무 수와 구간 수가 맞는다', () => {
    const bad: string[] = [];
    for (const [table, dias] of Object.entries(S) as [string, ScheduleTable][]) {
      for (const [dia, sc] of Object.entries(dias)) {
        if (!sc.g?.length || !sc.m) continue;
        if (sc.m.includes('충당여부') || sc.m.includes('대휴')) continue;
        const parts = sc.m.split(',').map((s) => s.replace(/\s*\([^)]*\)/g, '').trim()).filter(Boolean);
        if (parts.length !== sc.g.length) bad.push(`${table} ${dia}다이아: 약호 ${parts.length}개 / 구간 ${sc.g.length}개`);
      }
    }
    expect(bad).toEqual([]);
  });
});
