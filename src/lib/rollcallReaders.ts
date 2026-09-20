/**
 * 점호 읽음 확인의 «대상» — 그날 근무자.
 *
 * 전 직원이 아니라 그날 일하는 사람만 센다. 휴무·비번은 점호에 오지 않으니,
 * 명부 전체로 세면 «안 읽은 사람» 이 늘 절반을 넘어 숫자가 뜻을 잃는다.
 */
import { getRoster } from '@/data/cycle';
import { getDia, getType } from '@/lib/schedule';

export interface RollCallWorker {
  sabun: string;
  name: string;
  dia: string;
}

/** 그날 일하는 사람 — 주간·야간·대기(휴무·비번 제외) */
export function workersOn(date: Date): RollCallWorker[] {
  return getRoster(date)
    .map((p) => ({ person: p, dia: getDia(p, date) }))
    .filter(({ dia }) => {
      const t = getType(dia);
      return t === 'day' || t === 'night' || t === 'standby';
    })
    .map(({ person, dia }) => ({ sabun: person.s ?? '', name: person.n, dia }))
    .filter((w) => w.sabun);
}
