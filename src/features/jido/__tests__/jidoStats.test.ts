/**
 * 지도승무 집계 — 분기 1회(모든 기관사)·월 1회(중점관리대상자)
 */
import { describe, it, expect } from 'vitest';
import { buildStatus, groupByManager, guideCounts, quarterOf, quarterRange, shiftQuarter, focusShort } from '../lib/jidoStats';
import { toISODate } from '../lib/parseJidoExcel';
import type { JidoRide, JidoRosterEntry } from '../lib/jidoTypes';

let id = 0;
const ride = (date: string, driverSabun: string, guideName: string): JidoRide => ({
  id: ++id, date, driverSabun, driverName: driverSabun, guideSabun: null, guideName,
  trainNo: '', formation: '', fromStation: '', toStation: '', source: 'manual', createdBy: null,
});

const drivers = [{ s: 'A', n: '가' }, { s: 'B', n: '나' }, { s: 'C', n: '다' }];
const roster = new Map<string, JidoRosterEntry>([
  ['A', { driverSabun: 'A', driverName: '가', manager: '장진수', focusReason: null, focusFrom: null, focusTo: null }],
  ['B', { driverSabun: 'B', driverName: '나', manager: '장진수', focusReason: '신규자', focusFrom: '2026-08-19', focusTo: '2027-08-18' }],
]);

describe('분기', () => {
  it('분기 계산·이동', () => {
    expect(quarterOf('2026-10-02')).toEqual({ year: 2026, q: 4 });
    expect(shiftQuarter({ year: 2026, q: 1 }, -1)).toEqual({ year: 2025, q: 4 });
    expect(quarterRange({ year: 2026, q: 3 })).toEqual({ from: '2026-07-01', to: '2026-09-30', months: ['2026-07', '2026-08', '2026-09'] });
  });
});

describe('기관사별 현황', () => {
  const rides = [
    ride('2026-07-10', 'A', '김창환'),     // 담당이 아니어도 A 의 횟수
    ride('2026-08-20', 'B', '장진수'),
    ride('2026-09-30', 'B', '이현구'),
    ride('2026-06-30', 'C', '이선길'),     // 지난 분기 — 세지 않는다
  ];
  const st = buildStatus(drivers, roster, rides, { year: 2026, q: 3 }, '2026-10-02');

  it('분기 1회 — 담당이 아닌 지도요원이 타도 그 기관사의 횟수', () => {
    expect(st.find((x) => x.sabun === 'A')).toMatchObject({ count: 1, done: true, lastGuide: '김창환' });
    expect(st.find((x) => x.sabun === 'C')).toMatchObject({ count: 0, done: false });
  });

  it('중점관리 — 지정 기간에 걸친 달만 월 1회 기준, 끝난 달 0회는 놓친 달', () => {
    const b = st.find((x) => x.sabun === 'B')!;
    expect(b.focus?.months.map((m) => [m.ym, m.required, m.count, m.missed])).toEqual([
      ['2026-07', false, 0, false],   // 8/19 지정 전
      ['2026-08', true, 1, false],
      ['2026-09', true, 1, false],
    ]);
    expect(focusShort(b.focus!.months)).toBe(false);
  });

  it('이번 달(아직 안 끝남) 0회는 «놓침»이 아니라 «아직»', () => {
    const now = buildStatus(drivers, roster, [], { year: 2026, q: 4 }, '2026-10-02').find((x) => x.sabun === 'B')!;
    expect(now.focus?.months[0]).toMatchObject({ ym: '2026-10', required: true, count: 0, missed: false });
    expect(now.focus?.months[1]).toMatchObject({ ym: '2026-11', required: false });
    expect(focusShort(now.focus!.months)).toBe(true);
  });

  it('담당부장별 묶음·지도요원별 횟수', () => {
    const g = groupByManager(st, ['장진수']);
    expect(g[0]).toMatchObject({ manager: '장진수', done: 2, total: 2 });
    expect(g.find((x) => x.manager === '담당 미지정')).toMatchObject({ done: 0, total: 1 });
    expect(guideCounts(rides, { year: 2026, q: 3 })).toEqual([
      { guide: '김창환', count: 1 }, { guide: '장진수', count: 1 }, { guide: '이현구', count: 1 },
    ]);
  });
});

describe('엑셀 날짜 읽기', () => {
  it('자정에서 몇 초 모자란 시각도 그날로', () => {
    expect(toISODate(new Date(2026, 6, 9, 23, 59, 52))).toBe('2026-07-10');
    expect(toISODate(new Date(2026, 6, 10, 0, 0, 0))).toBe('2026-07-10');
    expect(toISODate('2026.09.30')).toBe('2026-09-30');
    expect(toISODate(46295)).toBe('2026-09-30');
  });
});
