/**
 * 점호 읽음 확인의 «대상» — 그날 근무자.
 *
 * 전 직원이 아니라 그날 일하는 사람만 센다. 휴무·비번은 점호에 오지 않으니,
 * 명부 전체로 세면 «안 읽은 사람» 이 늘 절반을 넘어 숫자가 뜻을 잃는다.
 * 운휴(추석 연휴처럼 그날 그 번호가 안 도는 경우)도 출근하지 않으므로 뺀다.
 *
 * 줄 순서는 출근 시각이다 — 다이아 번호가 곧 출근 순서라 결과는 «다이아 순» 과 같고,
 * 대기·야간이 섞여도 «지금 몇 시» 기준선을 그을 수 있다.
 */
import { getRoster } from '@/data/cycle';
import { getDia, getSchedule, getType, isSpecialRest } from '@/lib/schedule';

export interface RollCallWorker {
  sabun: string;
  name: string;
  dia: string;
  /** 출근 시각 'HH:MM' — 행로표에 없으면 null */
  start: string | null;
}

/** 'HH:MM' → 분. 없으면 아주 큰 값(맨 뒤로). */
export function startMinutes(start: string | null): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(start ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60 + 1;
}

/** 그날 일하는 사람 — 주간·야간·대기(휴무·비번·운휴 제외), 출근 시각 순 */
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
    out.push({ sabun, name: person.n, dia, start });
  }
  return out.sort((a, b) => startMinutes(a.start) - startMinutes(b.start) || a.dia.localeCompare(b.dia));
}
