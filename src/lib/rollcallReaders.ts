/**
 * 점호 읽음 확인의 «대상» — 그날 근무자.
 *
 * 전 직원이 아니라 그날 일하는 사람만 센다. 휴무·비번은 점호에 오지 않으니,
 * 명부 전체로 세면 «안 읽은 사람» 이 늘 절반을 넘어 숫자가 뜻을 잃는다.
 * 운휴(추석 연휴처럼 그날 그 번호가 안 도는 경우)도 출근하지 않으므로 뺀다.
 *
 * 줄 순서: 주간 근무 → 주간 대기 → 야간 근무 → 야간 대기, 각 묶음 안에서는 출근 시각 순.
 * 대기를 시각 순으로 섞으면 주간 근무 한복판에 대기가 끼어들어 읽기 어렵다(진호 2026-09-21).
 */
import { getRoster } from '@/data/cycle';
import { getDia, getSchedule, getType, isSpecialRest } from '@/lib/schedule';

/** 화면에 묶어 보여 주는 단위 — 주간 근무 · 주간 대기 · 야간 근무 · 야간 대기 */
export type RollCallGroup = 'dayWork' | 'dayStandby' | 'nightWork' | 'nightStandby';

export const ROLLCALL_GROUP_LABEL: Record<RollCallGroup, string> = {
  dayWork: '주간 근무',
  dayStandby: '주간 대기',
  nightWork: '야간 근무',
  nightStandby: '야간 대기',
};

const GROUP_ORDER: RollCallGroup[] = ['dayWork', 'dayStandby', 'nightWork', 'nightStandby'];

/** 교번 → 묶음. 대기는 61번부터가 야간(행로표의 대61~대66). */
export function groupOf(dia: string): RollCallGroup {
  if (dia.startsWith('대')) {
    return parseInt(dia.replace('대', ''), 10) >= 61 ? 'nightStandby' : 'dayStandby';
  }
  return getType(dia) === 'night' ? 'nightWork' : 'dayWork';
}

export interface RollCallWorker {
  sabun: string;
  name: string;
  dia: string;
  /** 출근 시각 'HH:MM' — 행로표에 없으면 null */
  start: string | null;
  group: RollCallGroup;
}

/** 'HH:MM' → 분. 없으면 아주 큰 값(맨 뒤로). */
export function startMinutes(start: string | null): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(start ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60 + 1;
}

/** 그날 일하는 사람 — 주간·야간·대기(휴무·비번·운휴 제외). 묶음 순 → 출근 시각 순 */
export function workersOn(date: Date): RollCallWorker[] {
  const out: RollCallWorker[] = [];
  for (const person of getRoster(date)) {
    const dia = getDia(person, date);
    const type = getType(dia);
    if (type !== 'day' && type !== 'night' && type !== 'standby') continue;
    const sabun = person.s ?? '';
    if (!sabun) continue;
    const sc = getSchedule(dia, date);
    if (isSpecialRest(sc)) continue; // 운휴·대휴 — 그날은 출근하지 않는다
    const start = sc?.s && /^\d{1,2}:\d{2}$/.test(sc.s) ? sc.s : null;
    out.push({ sabun, name: person.n, dia, start, group: groupOf(dia) });
  }
  return out.sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
      startMinutes(a.start) - startMinutes(b.start) ||
      a.dia.localeCompare(b.dia),
  );
}
