/**
 * 운용계획부장·지원기관사·기지관제 근무 — 사업소 계획표(2026-10 근무계획.xlsx)와 맞는지.
 *
 * 예전 규칙은 «짝수 달마다 본소↔기지 뒤집기» + 다른 짝 구성이라
 * 부장은 짝수 달, 지원기관사는 홀수 달에 본소/기지가 반대로 나왔다.
 */
import { describe, it, expect } from 'vitest';
import { findDutyByName, getDutyInfo } from '../dutySchedule';
import { OFFICE_DUTY_PLAN } from '@/data/officeDutyPlan';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('운용계획부장 근무 — 계획표 그대로', () => {
  it('10/3 A조: 장진수·석영훈은 기지, 김진완·박종길은 본소 (주간)', () => {
    expect(findDutyByName('장진수', d(2026, 10, 3))).toEqual({ location: '기지', shift: '주간' });
    expect(findDutyByName('김진완', d(2026, 10, 3))).toEqual({ location: '본소', shift: '주간' });
    const a = getDutyInfo(d(2026, 10, 3)).assignments.filter((x) => x.group === 'A조');
    expect(a).toContainEqual(expect.objectContaining({ location: '기지', manager: '장진수', crew: '석영훈' }));
    expect(a).toContainEqual(expect.objectContaining({ location: '본소', manager: '김진완', crew: '박종길' }));
  });

  it('10월 B조는 지원기관사 짝이 바뀐다(김창환+반헌준) — 11월엔 원래대로(김창환+이수윤)', () => {
    const oct = getDutyInfo(d(2026, 10, 1)).assignments.filter((x) => x.group === 'B조');
    expect(oct).toContainEqual(expect.objectContaining({ manager: '김창환', crew: '반헌준' }));
    const novDay = Array.from({ length: 30 }, (_, i) => d(2026, 11, i + 1))
      .find((t) => getDutyInfo(t).assignments.some((x) => x.manager === '김창환'))!;
    const nov = getDutyInfo(novDay).assignments.filter((x) => x.group === 'B조');
    expect(nov).toContainEqual(expect.objectContaining({ manager: '김창환', crew: '이수윤' }));
  });

  it('«지원» 근무는 다루지 않는다 — 휴무로 보인다 (10/14 박종길)', () => {
    expect(findDutyByName('박종길', d(2026, 10, 14))).toBe('rest');
  });

  it('기지관제는 늘 기지관제', () => {
    for (let day = 1; day <= 31; day++) {
      const r = findDutyByName('현덕일', d(2026, 10, day));
      if (typeof r !== 'string') expect(r.location).toBe('기지관제');
    }
  });

  it('계획표가 있는 모든 날 — 표의 글자와 화면 값이 같다', () => {
    const GWANJE = new Set(['현덕일', '박용덕', '전동규', '윤경일', '정성한', '이동복', '신제윤', '이승훈']);
    for (const [ym, people] of Object.entries(OFFICE_DUTY_PLAN)) {
      const [y, m] = ym.split('-').map(Number);
      for (const [name, s] of Object.entries(people)) {
        [...s].forEach((c, i) => {
          const r = findDutyByName(name, d(y, m, i + 1));
          if (c === '~') expect(r).toBe('standby');
          else if (c === '.') expect(r).toBe('rest');
          else expect(r).toEqual({
            location: GWANJE.has(name) ? '기지관제' : c === 'A' || c === 'B' ? '본소' : '기지',
            shift: c === 'A' || c === 'a' ? '주간' : '야간',
          });
        });
      }
    }
  });

  it('계획표가 없는 달은 규칙으로 — 매일 두 조가 근무하고 조마다 본소·기지 한 쌍씩', () => {
    for (let day = 1; day <= 31; day++) {
      const info = getDutyInfo(d(2027, 1, day));
      expect(info.assignments).toHaveLength(4);
      for (const g of new Set(info.assignments.map((a) => a.group))) {
        const locs = info.assignments.filter((a) => a.group === g).map((a) => a.location).sort();
        expect(locs).toEqual(['기지', '본소']);
      }
    }
  });
});
