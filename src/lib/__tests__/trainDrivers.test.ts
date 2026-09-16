/**
 * 열번 조회 — 그날 이 열차번호를 누가 모는가.
 *
 * 사람 이름은 박지 않는다(발령이 나면 바뀐다). 대신 «구조» 를 지킨다.
 *   · 답십리에서 기관사가 바뀌는 열번은 양쪽 사람이 같은 시각에 바통을 넘긴다
 *   · 자정 넘어 새벽에 모는 열번은 전날 시작한 야간근무에서 찾는다
 *   · 공식 시간표에도 행로표에도 없는 번호는 «없는 열번» — 영등포라고 하지 않는다
 *   · 시간표에는 있는데 답십리 기관사가 안 맡으면 «영등포 열번»
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  findTrainDrivers,
  lookupTrain,
  timetableDayKey,
  type Line5Timetable,
} from '../schedule';
import { HOL } from '@/data/holidays';

const DAY = new Date(2026, 8, 16); // 2026-09-16 (수)
const TT = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'public/data/line5-trains.json'), 'utf8'),
) as Line5Timetable;

describe('답십리 기관사 찾기', () => {
  it('답십리에서 바뀌는 열번은 두 사람이 같은 시각에 넘겨준다', () => {
    const rows = findTrainDrivers(5032, DAY);
    const east = rows.find((r) => r.side === 'east');
    const west = rows.find((r) => r.side === 'west');
    expect(east && west).toBeTruthy();
    expect(east!.to === west!.from || west!.to === east!.from).toBe(true);
  });

  it('새벽 열번은 전날 시작한 야간근무에서 찾는다', () => {
    const rows = findTrainDrivers(1014, DAY);
    expect(rows.length).toBeGreaterThan(0);
    const prev = new Date(2026, 8, 15);
    expect(rows.some((r) => r.diaDate && r.diaDate.getTime() === prev.getTime())).toBe(true);
  });

  it('우리 기관사 줄은 행로표를 열 다이아와 날짜를 갖는다', () => {
    for (const no of [5612, 5641, 1014, 5005, 5032]) {
      for (const r of findTrainDrivers(no, DAY)) {
        expect(r.ours).toBe(true);
        expect(r.dia).toBeTruthy();
        expect(r.diaDate).toBeInstanceOf(Date);
        expect(r.from).toMatch(/^\d{2}:\d{2}$/);
      }
    }
  });
});

describe('없는 열번 / 영등포 열번', () => {
  it('아무 번호나 넣으면 영등포가 아니라 «없는 열번»', () => {
    expect(lookupTrain(9999, DAY, TT).status).toBe('none');
    expect(lookupTrain(1234, DAY, TT).status).toBe('none');
  });

  it('시간표에 있는데 답십리 기관사가 안 맡으면 «영등포 열번»', () => {
    const no = Object.keys(TT.weekday).map(Number).find((n) => findTrainDrivers(n, DAY).length === 0);
    expect(no).toBeDefined();
    expect(lookupTrain(no!, DAY, TT).status).toBe('yeongdeungpo');
  });

  it('회송 열번(1xxx)은 승객 시간표에 없어도 우리 기관사가 있으니 있는 열번', () => {
    expect(TT.weekday['1014']).toBeUndefined();
    expect(lookupTrain(1014, DAY, TT).status).toBe('ours');
  });

  it('시간표를 못 불러오면 영등포라고 단정하지 않는다', () => {
    expect(lookupTrain(9999, DAY, null).status).toBe('unknown');
  });

  it('한쪽만 맡은 열번은, 시간표상 반대쪽까지 가면 그쪽을 영등포 기관사로 채운다', () => {
    let checked = 0;
    for (const n of Object.keys(TT.weekday).map(Number)) {
      const r = lookupTrain(n, DAY, TT);
      if (r.status !== 'ours') continue;
      const ours = r.rows.filter((x) => x.ours);
      if (ours.some((x) => x.side === 'full')) continue;
      const sides = new Set(r.rows.map((x) => x.side));
      // 방화 ↔ 하남·마천을 오가는 열번이면 양쪽이 다 채워져 있어야 한다
      if (r.info && r.info.d === '방화' && r.info.o !== '방화') {
        expect(sides.has('west') && sides.has('east')).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('그날 쓰는 공식 시간표', () => {
  it('평일 · 토요일 · 일요일', () => {
    expect(timetableDayKey(new Date(2026, 8, 16))).toBe('weekday');
    expect(timetableDayKey(new Date(2026, 8, 19))).toBe('saturday');
    expect(timetableDayKey(new Date(2026, 8, 20))).toBe('holiday');
  });

  it('평일 공휴일은 휴일 시간표 — 토요일로 새지 않는다', () => {
    // HOL 은 «2026/01/01,2026/02/16,…» 처럼 한 줄 문자열이다
    const weekdayHoliday = [...String(HOL['2026'] ?? '').matchAll(/(\d{4})\/(\d{2})\/(\d{2})/g)]
      .map((m) => new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
      .find((d) => d.getDay() >= 1 && d.getDay() <= 5);
    expect(weekdayHoliday).toBeDefined();
    expect(timetableDayKey(weekdayHoliday!)).toBe('holiday');
  });
});
