/**
 * 지도승무 집계 — 분기 1회(모든 기관사)·월 1회(중점관리대상자) 기준으로 누가 채웠는지.
 *
 * 횟수는 «기관사가 받은 횟수»다. 담당부장이 아닌 지도요원이 탔어도 그 기관사의 횟수로 센다.
 */
import type { JidoRide, JidoRosterEntry } from './jidoTypes';

export interface Quarter { year: number; q: 1 | 2 | 3 | 4 }

export function quarterOf(iso: string): Quarter {
  const [y, m] = iso.split('-').map(Number);
  return { year: y, q: (Math.floor((m - 1) / 3) + 1) as Quarter['q'] };
}

export function quarterLabel(q: Quarter): string {
  return `${q.year}년 ${q.q}분기`;
}

export function shiftQuarter(q: Quarter, by: number): Quarter {
  const idx = q.year * 4 + (q.q - 1) + by;
  return { year: Math.floor(idx / 4), q: ((idx % 4) + 1) as Quarter['q'] };
}

/** 분기의 첫날·마지막날, 세 달(YYYY-MM) */
export function quarterRange(q: Quarter): { from: string; to: string; months: string[] } {
  const m0 = (q.q - 1) * 3 + 1;
  const months = [0, 1, 2].map((i) => `${q.year}-${String(m0 + i).padStart(2, '0')}`);
  const last = new Date(q.year, m0 + 2, 0).getDate();
  return { from: `${months[0]}-01`, to: `${months[2]}-${String(last).padStart(2, '0')}`, months };
}

export interface MonthCheck {
  ym: string;          // YYYY-MM
  count: number;
  /** 그 달에 중점관리 기간이 걸쳐 있고, 그 달이 이미 시작됐다 */
  required: boolean;
  /** 그 달이 끝났는데 0회 — 놓친 달 */
  missed: boolean;
}

export interface DriverStatus {
  sabun: string;
  name: string;
  manager: string | null;
  count: number;
  lastDate: string | null;
  lastGuide: string | null;
  /** 분기 1회 채움 */
  done: boolean;
  focus: { reason: string; from: string; to: string; months: MonthCheck[] } | null;
  rides: JidoRide[];
}

const monthEnd = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
};

/**
 * 기관사별 현황. drivers = 지금 명부의 기관사(결원 제외), roster = 담당부장·중점관리.
 * today 는 «아직 안 끝난 달»을 놓친 달로 치지 않으려고 받는다.
 */
export function buildStatus(
  drivers: { s: string; n: string }[],
  roster: Map<string, JidoRosterEntry>,
  rides: JidoRide[],
  quarter: Quarter,
  today: string,
): DriverStatus[] {
  const { from, to, months } = quarterRange(quarter);
  const inQ = rides.filter((r) => r.date >= from && r.date <= to);
  const byDriver = new Map<string, JidoRide[]>();
  for (const r of inQ) {
    const list = byDriver.get(r.driverSabun) ?? [];
    list.push(r);
    byDriver.set(r.driverSabun, list);
  }

  return drivers.map((d) => {
    const mine = (byDriver.get(d.s) ?? []).sort((a, b) => b.date.localeCompare(a.date));
    const info = roster.get(d.s);
    let focus: DriverStatus['focus'] = null;
    if (info?.focusFrom && info.focusTo && info.focusFrom <= to && info.focusTo >= from) {
      const fFrom = info.focusFrom, fTo = info.focusTo;
      focus = {
        reason: info.focusReason ?? '중점관리',
        from: fFrom,
        to: fTo,
        months: months.map((ym) => {
          const count = mine.filter((r) => r.date.startsWith(ym)).length;
          const overlaps = fFrom <= monthEnd(ym) && fTo >= `${ym}-01`;
          const started = `${ym}-01` <= today;
          const required = overlaps && started;
          return { ym, count, required, missed: required && monthEnd(ym) < today && count === 0 };
        }),
      };
    }
    return {
      sabun: d.s,
      name: d.n,
      manager: info?.manager ?? null,
      count: mine.length,
      lastDate: mine[0]?.date ?? null,
      lastGuide: mine[0]?.guideName ?? null,
      done: mine.length > 0,
      focus,
      rides: mine,
    };
  });
}

export interface ManagerGroup {
  manager: string;
  rows: DriverStatus[];
  done: number;
  total: number;
  /** 중점관리자 중 이번 달(또는 지난 달) 기준을 못 채운 사람 수 */
  focusMissing: number;
}

/** 담당부장별 묶음 — 담당이 없는 기관사는 «담당 미지정»으로 */
export function groupByManager(rows: DriverStatus[], managerOrder: string[] = []): ManagerGroup[] {
  const map = new Map<string, DriverStatus[]>();
  for (const r of rows) {
    const k = r.manager || '담당 미지정';
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  const rank = (m: string) => {
    const i = managerOrder.indexOf(m);
    return i < 0 ? (m === '담당 미지정' ? 999 : 500) : i;
  };
  return [...map.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
    .map(([manager, list]) => ({
      manager,
      rows: list.sort((a, b) => Number(a.done) - Number(b.done) || a.name.localeCompare(b.name)),
      done: list.filter((r) => r.done).length,
      total: list.length,
      focusMissing: list.filter((r) => r.focus && focusShort(r.focus.months)).length,
    }));
}

/** 중점관리자 — 기준이 걸린 달 가운데 0회인 달이 있다(진행 중인 이번 달 포함) */
export function focusShort(months: MonthCheck[]): boolean {
  return months.some((m) => m.required && m.count === 0);
}

/** 지도요원별 실적 — 이번 분기에 몇 번 탔는가 */
export function guideCounts(rides: JidoRide[], quarter: Quarter): { guide: string; count: number }[] {
  const { from, to } = quarterRange(quarter);
  const map = new Map<string, number>();
  for (const r of rides) {
    if (r.date < from || r.date > to) continue;
    map.set(r.guideName, (map.get(r.guideName) ?? 0) + 1);
  }
  return [...map.entries()].map(([guide, count]) => ({ guide, count })).sort((a, b) => b.count - a.count);
}
