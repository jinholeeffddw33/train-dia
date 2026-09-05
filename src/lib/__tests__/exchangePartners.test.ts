/**
 * 교대 상대 매칭 — 날짜 경계 회귀 시험.
 *
 * 야간 교번은 하루치 스케줄이 이틀에 걸친다. 새벽 구간은 「교번표에 적힌 날」이 아니라
 * 그 다음 날 아침에 벌어지므로, 아침에 열차를 넘겨주는 사람은 «어제» 야간조다.
 *
 * 예전에는 오늘치 스케줄만 뒤졌다. 그래서
 *   · 평일 아침에는 «오늘» 야간조 이름이 나왔다 — 열차번호는 같아 눈에 안 띄었지만 사람이 틀렸다
 *   · 금요일 아침처럼 어제(목→금)와 오늘(금→토)의 새벽 시간표가 갈리는 날엔
 *     아예 못 찾고 「타소」로 떨어졌다
 *
 * 아래 2026-09-04(금)은 실제로 그렇게 나왔던 날이다. 실시간 화면에서 제5029열차를
 * 몰고 온 사람은 9/3 야간조 김해성이었다.
 */

import { describe, it, expect } from 'vitest';
import { P } from '@/data/cycle';
import { getDia, getType, getSchedule, findExchangePartners } from '@/lib/schedule';

/** 그날 그 교번을 맡은 사람 */
function holderOf(dia: string, date: Date) {
  return P.find((p) => getDia(p, date) === dia);
}

describe('findExchangePartners — 야간조 새벽 구간의 날짜 경계', () => {
  it('금요일 아침 제5029열차를 넘겨주는 사람은 목요일 야간조다 (2026-09-04)', () => {
    const date = new Date(2026, 8, 4);
    const me = holderOf('25', date);
    expect(me).toBeDefined();

    const sc = getSchedule('25', date);
    expect(sc?.g?.[0]?.n?.[0]).toBe(5029); // 1근무 첫 열차

    const partners = findExchangePartners(sc!, me!, date);
    expect(partners[0]?.left).toBe('김해성'); // 「타소」가 아니라 어제 야간조
  });

  it('어제 야간조는 제5029열차로 새벽 구간을 끝낸다 — 오늘 야간조가 아니다', () => {
    const fri = new Date(2026, 8, 4);
    const thu = new Date(2026, 8, 3);

    const lastTrainOfDia65 = (d: Date) => {
      const g = getSchedule('65', d)?.g;
      const seg = g?.[g.length - 1];
      return seg?.n?.[seg.n.length - 1];
    };

    expect(holderOf('65', thu)?.n).toBe('김해성');
    expect(lastTrainOfDia65(thu)).toBe(5029); // 목 야간 → 금 아침
    expect(lastTrainOfDia65(fri)).not.toBe(5029); // 금 야간 → 토 아침(휴일 시간표)
  });

  it('한 달 평일 아침 교대에 「상대 없음」이 생기지 않는다', () => {
    const missing: string[] = [];
    for (let k = 0; k < 30; k++) {
      const d = new Date(2026, 8, 1);
      d.setDate(d.getDate() + k);
      const me = holderOf('25', d);
      if (!me) continue;
      const sc = getSchedule('25', d);
      const first = sc?.g?.[0];
      if (!sc || !first?.n?.length) continue;
      if (first.n[0] >= 1000 && first.n[0] < 3000) continue; // 기지 출고는 교대 없음
      if (getType(getDia(me, d)) === 'rest') continue;
      if (!findExchangePartners(sc, me, d)[0]?.left) {
        missing.push(`${d.getMonth() + 1}/${d.getDate()} ${me.n}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
