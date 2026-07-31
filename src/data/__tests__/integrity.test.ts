/**
 * 교번·인원 데이터 무결성 검사
 *
 * 왜 필요한가:
 *   cycle.ts 는 발령·퇴직·복귀로 거의 매주 바뀐다. 교번은 171칸 순환 배열의 "인덱스"로
 *   계산되므로, 인원을 하나 끼워넣거나 빼면서 순번이 밀리면 그 뒤 전원의 근무표가 어긋난다.
 *   화면은 멀쩡해 보이기 때문에 사용자 신고 전까지 발견되지 않는다.
 *   여기서 막는 것이 목적이다.
 */
import { describe, it, expect } from 'vitest';
import { P, CYCLE, CL, DB_STD, WEEKDAY_DIAS } from '@/data/cycle';
import { S } from '@/data/schedules';
import { HOL } from '@/data/holidays';
import { getDia, getType, getSchedule, isHoliday } from '@/lib/schedule';

/** 순환 근무 인원(순번이 숫자) — 통상근무(W1~)·내근 등은 제외 */
const CYCLIC = P.filter((p) => /^\d+$/.test(p.I));
/** 통상근무 인원 — 오프셋 w 를 가진 인원만. 내근(W5, d="내근")은 여기에 해당하지 않는다 */
const WEEKDAY = P.filter((p) => typeof p.w === 'number');
/** S 는 평일/휴일 조합별 6개 테이블로 나뉜다 */
const S_TABLES = ['p_ord', 'p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol'] as const;

describe('cycle.ts — 주기 배열', () => {
  it('CYCLE 길이 = CL', () => {
    expect(CYCLE.length).toBe(CL);
  });

  it('CYCLE 에 빈 칸이 없다', () => {
    const empty = CYCLE.map((v, i) => [i, v] as const).filter(([, v]) => !v || !v.trim());
    expect(empty).toEqual([]);
  });

  it('DB_STD 는 유효한 날짜', () => {
    expect(DB_STD instanceof Date).toBe(true);
    expect(Number.isNaN(DB_STD.getTime())).toBe(false);
  });
});

describe('cycle.ts — 인원 명부', () => {
  it('순번(I)이 중복되지 않는다', () => {
    const dup = Object.entries(
      P.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.I]: (acc[p.I] ?? 0) + 1 }), {}),
    ).filter(([, n]) => n > 1);
    expect(dup).toEqual([]);
  });

  it('사번이 중복되지 않는다', () => {
    const withS = P.filter((p) => p.s);
    const dup = Object.entries(
      withS.reduce<Record<string, string[]>>(
        (acc, p) => ({ ...acc, [p.s!]: [...(acc[p.s!] ?? []), `${p.I}번 ${p.n}`] }),
        {},
      ),
    ).filter(([, list]) => list.length > 1);
    expect(dup).toEqual([]);
  });

  it('이름이 비어있지 않다', () => {
    const bad = P.filter((p) => !p.n || !p.n.trim()).map((p) => `${p.I}번(${p.s ?? '사번없음'})`);
    expect(bad).toEqual([]);
  });

  it('사번 형식이 올바르다 (8자리 숫자 또는 결원코드)', () => {
    const bad = P.filter((p) => p.s && !/^(\d{8}|9G\d{6})$/.test(p.s)).map((p) => `${p.I}번 ${p.n} → "${p.s}"`);
    expect(bad).toEqual([]);
  });

  it('초기 교번(d)이 비어있지 않다', () => {
    const bad = P.filter((p) => !p.d || !p.d.trim()).map((p) => `${p.I}번 ${p.n}`);
    expect(bad).toEqual([]);
  });
});

describe('cycle.ts — 순번↔교번 정합성 (핵심)', () => {
  it('순환 인원 수 = CL', () => {
    expect(CYCLIC.length).toBe(CL);
  });

  it('순번이 1..CL 로 빠짐없이 채워져 있다', () => {
    const nums = CYCLIC.map((p) => Number(p.I)).sort((a, b) => a - b);
    const missing = Array.from({ length: CL }, (_, i) => i + 1).filter((n) => !nums.includes(n));
    expect(missing).toEqual([]);
  });

  it('I번 기관사의 초기 교번 = CYCLE[I-1]', () => {
    // 인원을 끼워넣거나 빼면서 순번이 밀리면 여기서 잡힌다.
    const mismatch = CYCLIC.filter((p) => CYCLE[Number(p.I) - 1] !== p.d).map(
      (p) => `${p.I}번 ${p.n}: 명부 "${p.d}" vs CYCLE[${Number(p.I) - 1}] "${CYCLE[Number(p.I) - 1]}"`,
    );
    expect(mismatch).toEqual([]);
  });

  it('통상근무 인원의 교번은 WEEKDAY_DIAS 에 속한다', () => {
    const bad = WEEKDAY.filter((p) => !WEEKDAY_DIAS.includes(p.d)).map((p) => `${p.I} ${p.n} → ${p.d}`);
    expect(bad).toEqual([]);
  });

  it('통상근무 오프셋(w)이 0..3 범위이고 중복되지 않는다', () => {
    const ws = WEEKDAY.map((p) => p.w);
    expect(ws.every((w) => typeof w === 'number' && w! >= 0 && w! <= 3)).toBe(true);
    expect(new Set(ws).size).toBe(ws.length);
  });
});

describe('schedules.ts — 시각표 커버리지', () => {
  /** 휴무·비번이 아닌 실제 근무 교번 */
  const workDias = [...new Set(CYCLE.filter((d) => getType(d) !== 'rest'))];

  /** 당일·익일 공휴일 조합 4가지를 실제 달력에서 한 날짜씩 뽑는다 */
  const sampleDates = (() => {
    const found = new Map<string, Date>();
    for (let i = 0; i < 400 && found.size < 4; i++) {
      const d = new Date(DB_STD);
      d.setDate(d.getDate() + i);
      const tm = new Date(d);
      tm.setDate(tm.getDate() + 1);
      const key = `${isHoliday(d) ? 'H' : 'O'}${isHoliday(tm) ? 'H' : 'O'}`;
      if (!found.has(key)) found.set(key, d);
    }
    return found;
  })();

  it('당일·익일 공휴일 조합 4가지가 달력에 모두 존재한다', () => {
    expect([...sampleDates.keys()].sort()).toEqual(['HH', 'HO', 'OH', 'OO']);
  });

  it('CYCLE 의 모든 근무 교번이 어떤 날짜에도 시각표를 반환한다', () => {
    // 교번 개편으로 새 교번이 생겼는데 시각표를 안 넣으면 근무시간이 빈칸으로 뜬다.
    const missing: string[] = [];
    for (const dia of workDias) {
      for (const [pattern, date] of sampleDates) {
        if (getSchedule(dia, date) === null) missing.push(`${dia} (${pattern})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('시각표의 출퇴근 시각이 HH:MM 형식이다 (운휴·대휴 제외)', () => {
    // s 필드는 겸용이다: 평상시엔 출근시각, 운휴·대휴일 땐 "운휴39" 같은 마커.
    // isSpecialRest()/getSpecialRestLabel() 이 이 규약을 읽는다.
    const bad: string[] = [];
    for (const table of S_TABLES) {
      for (const [dia, v] of Object.entries(S[table])) {
        if (v.s.startsWith('운휴') || v.s.startsWith('대휴')) continue;
        if (!/^\d{1,2}:\d{2}$/.test(v.s) || !/^\d{1,2}:\d{2}$/.test(v.e)) bad.push(`${table}.${dia} → ${v.s}~${v.e}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('운휴·대휴 항목은 마커 뒤에 교번번호가 붙고 퇴근시각이 비어 있다', () => {
    const bad: string[] = [];
    for (const table of S_TABLES) {
      for (const [dia, v] of Object.entries(S[table])) {
        if (!v.s.startsWith('운휴') && !v.s.startsWith('대휴')) continue;
        if (v.s !== `운휴${dia}` && v.s !== `대휴${dia}`) bad.push(`${table}.${dia} → 마커 "${v.s}" 가 교번과 불일치`);
        if (v.e !== '') bad.push(`${table}.${dia} → 퇴근시각이 비어있지 않음 "${v.e}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('모든 시각표 항목에 운전행로(m)가 있다', () => {
    // schedules.ts 주석: "m 필드 필수 — 누락하면 홈 화면 행로 약호 + 방향 배너 깨짐"
    const bad: string[] = [];
    for (const table of S_TABLES) {
      for (const [dia, v] of Object.entries(S[table])) {
        if (!v.m || !String(v.m).trim()) bad.push(`${table}.${dia}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('holidays.ts — 공휴일 목록', () => {
  it('모든 항목이 YYYY/MM/DD 형식이고 실재하는 날짜다', () => {
    const bad: string[] = [];
    for (const [year, csv] of Object.entries(HOL)) {
      for (const raw of String(csv).split(',')) {
        const d = raw.trim();
        if (!d) continue;
        if (!/^\d{4}\/\d{2}\/\d{2}$/.test(d)) { bad.push(`${year}: 형식 "${d}"`); continue; }
        const [y, m, dd] = d.split('/').map(Number);
        const dt = new Date(y, m - 1, dd);
        if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== dd) bad.push(`${year}: 없는 날짜 "${d}"`);
        if (String(y) !== year) bad.push(`${year}: 연도 불일치 "${d}"`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('전수 검증 — 전 인원 × 1년', () => {
  it('모든 기관사 × 365일에서 getDia 가 유효한 문자열을 반환한다', () => {
    const bad: string[] = [];
    for (const p of P) {
      for (let i = 0; i < 365; i++) {
        const d = new Date(DB_STD);
        d.setDate(d.getDate() + i);
        const dia = getDia(p, d);
        if (typeof dia !== 'string' || dia.length === 0) bad.push(`${p.I}번 ${p.n} +${i}일`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('모든 기관사 × 365일에서 getType 이 유효한 타입을 반환한다', () => {
    const valid = ['day', 'night', 'standby', 'rest'];
    const bad: string[] = [];
    for (const p of P) {
      for (let i = 0; i < 365; i++) {
        const d = new Date(DB_STD);
        d.setDate(d.getDate() + i);
        const t = getType(getDia(p, d));
        if (!valid.includes(t)) bad.push(`${p.I}번 ${p.n} +${i}일 → ${t}`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});
