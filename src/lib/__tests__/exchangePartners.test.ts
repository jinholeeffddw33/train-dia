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
import { getDia, getType, getSchedule, findExchangePartners, JUBAK_SELF } from '@/lib/schedule';

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

/**
 * 주박 — 야간 근무자는 누구나 자정을 넘겨 길게 쉰다. 그래서 「자정 넘김 + 2시간 이상」
 * 만으로 주박을 판정하면 사업소 숙박(답→답, 8~9시간)까지 전부 주박으로 잡혀,
 * 새벽에 실제로 열차를 넘겨준 사람이 「본인」으로 덮어씌워졌다.
 * 진짜 주박은 사업소가 아닌 곳에서 밤을 보내고 아침에 그곳에서 다시 나온다.
 */
describe('findExchangePartners — 주박과 사업소 숙박 구분', () => {
  const date = new Date(2026, 5, 2); // 2026-06-02 (화)

  it('사업소(답십리)에서 자고 새벽에 열차를 받으면 상대 이름이 나온다', () => {
    // 홍운기 dia70: 답하방답 / 답하답 — 22:16 에 5711 을 넘기고 06:46 에 5011 을 받는다.
    // 5011 을 06:46 에 답십리로 몰고 온 사람은 박선기(dia67, 기지에서 05:40 출고).
    const me = holderOf('70', date);
    const sc = getSchedule('70', date);
    expect(sc?.g?.[1]?.n?.[0]).toBe(5011);

    const partners = findExchangePartners(sc!, me!, date);
    expect(partners[1]?.left).toBe('박선기');
    expect(partners[1]?.left).not.toBe(JUBAK_SELF);
  });

  it('원격지(하남검단산)에서 주박하면 본인이 이어받는다', () => {
    // dia91: 답방하 / 하답 — 하남검단산에서 자고 그곳에서 새벽에 다시 나온다.
    const me = holderOf('91', date);
    const sc = getSchedule('91', date);
    expect(sc?.m?.split(',')[0].trim().slice(-1)).toBe('하');

    const partners = findExchangePartners(sc!, me!, date);
    expect(partners[1]?.left).toBe(JUBAK_SELF);
  });

  it('교대 관계가 서로 맞는다 — 내가 넘긴 사람은 나에게서 받는다', () => {
    const broken: string[] = [];
    const sched = new Map<string, ReturnType<typeof getSchedule>>();
    const parts = new Map<string, ReturnType<typeof findExchangePartners>>();
    for (const p of P) {
      const dia = getDia(p, date);
      if (getType(dia) === 'rest') continue;
      const sc = getSchedule(dia, date);
      if (!sc?.g?.length) continue;
      sched.set(p.n, sc);
      parts.set(p.n, findExchangePartners(sc, p, date));
    }
    for (const [name, mine] of parts) {
      sched.get(name)!.g!.forEach((seg, i) => {
        const to = mine[i]?.right;
        if (!to || to === JUBAK_SELF || !seg.n?.length) return;
        const train = seg.n[seg.n.length - 1];
        const osc = sched.get(to), other = parts.get(to);
        if (!osc || !other) return; // 상대가 어제 야간조 — 오늘 표에 없다
        const j = osc.g!.findIndex((s) => s.n?.[0] === train);
        if (j < 0) return;
        if (other[j]?.left !== name) broken.push(`${name} 넘김→${to}(열차${train}) 인데 ${to} 받음=${other[j]?.left ?? '없음'}`);
      });
    }
    expect(broken).toEqual([]);
  });
});
