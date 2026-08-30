import { describe, it, expect, afterEach } from 'vitest';
import { P, getRoster } from '@/data/cycle';
import {
  ROSTER_CHANGES,
  setDbRosterChanges,
  allChanges,
  activeChanges,
  activeRanks,
  activeWorkTypes,
  isAway,
  departedSabuns,
  joinedUsers,
  type RosterChange,
} from '@/data/rosterChanges';
import { officeUsers, internUsers, rankOf, dutyOf, isJiwonGigwansa, getUserRole } from '@/lib/auth';

/**
 * 관리자 모드(설정 → 관리자 모드 → 명부 관리)에서 넣은 인사 변경이 정확히 얹히는지.
 *
 * 여기가 틀리면 175명이 남의 교번을 본다 — 정적 목록과 DB 를 합치는 규칙,
 * 한 사람이 여러 번 바뀔 때 마지막 것이 이기는지, 시행일 경계를 못 넘는지,
 * 자리를 비울 때 결원이 제대로 앉는지를 못 박는다.
 */

const day = (d: string) => new Date(`${d}T12:00:00+09:00`);
const c = (o: RosterChange): RosterChange => o;

afterEach(() => setDbRosterChanges([]));   // 다른 테스트로 새지 않게 되돌린다

describe('관리자 모드 인사 변경 — 기관사가 된다', () => {
  it('아무것도 안 넣으면 정적 목록 그대로다', () => {
    setDbRosterChanges([]);
    expect(allChanges()).toEqual(ROSTER_CHANGES);
  });

  it('시행일부터 그 자리에 앉는다', () => {
    setDbRosterChanges([c({ from: '2027-03-01', I: '55', n: '홍길동', s: '22699999', work: 'driver' })]);

    expect(getRoster(day('2027-02-28')).find((p) => p.I === '55')?.n).toBe('결원06');
    const after = getRoster(day('2027-03-01')).find((p) => p.I === '55');
    expect(after?.n).toBe('홍길동');
    expect(after?.s).toBe('22699999');
  });

  it('같은 사람·같은 시행일이면 DB 가 정적 목록을 이긴다', () => {
    const stat = ROSTER_CHANGES[0];            // 2026-08-14 · 52번 김대환
    setDbRosterChanges([c({ from: stat.from, I: stat.I, n: stat.n, s: stat.s, work: 'driver' })]);
    expect(allChanges().filter((x) => x.s === stat.s && x.from === stat.from)).toHaveLength(1);
  });

  it('한 자리가 여러 번 바뀌면 마지막 시행분이 이긴다 (넣은 순서와 무관)', () => {
    setDbRosterChanges([
      c({ from: '2027-05-01', I: '55', n: '나중사람', s: '99977777', work: 'driver' }),
      c({ from: '2027-03-01', I: '55', n: '먼저사람', s: '99966666', work: 'driver' }),
    ]);

    expect(getRoster(day('2027-03-01')).find((p) => p.I === '55')?.n).toBe('먼저사람');
    expect(getRoster(day('2027-04-30')).find((p) => p.I === '55')?.n).toBe('먼저사람');
    expect(getRoster(day('2027-05-01')).find((p) => p.I === '55')?.n).toBe('나중사람');
  });

  it('시행된 것만 담기고, 시행일 오름차순이다', () => {
    setDbRosterChanges([
      c({ from: '2027-05-01', I: '56', n: 'ㄴ', s: '99955555', work: 'driver' }),
      c({ from: '2027-03-01', I: '55', n: 'ㄱ', s: '99944444', work: 'driver' }),
    ]);

    const at = activeChanges(day('2027-04-01')).filter((x) => x.s.startsWith('999'));
    expect(at.map((x) => x.n)).toEqual(['ㄱ']);

    const later = activeChanges(day('2027-06-01')).map((x) => x.from);
    expect([...later]).toEqual([...later].sort());
  });

  it('인턴이 기관사가 되면 인턴 명단에서 빠진다', () => {
    setDbRosterChanges([
      c({ from: '2027-03-01', I: '55', n: '조건희', s: '22601134', work: 'driver' }),
    ]);
    expect(internUsers(day('2027-02-28')).some((u) => u.s === '22601134')).toBe(true);
    expect(internUsers(day('2027-03-01')).some((u) => u.s === '22601134')).toBe(false);
    expect(departedSabuns('intern', day('2027-03-01')).has('22601134')).toBe(true);
  });

  it('예약을 얹어도 명부 인원수는 그대로다', () => {
    setDbRosterChanges([c({ from: '2027-03-01', I: '55', n: '홍길동', s: '22699999', work: 'driver' })]);
    expect(getRoster(day('2027-03-01')).length).toBe(P.length);
  });

  it('없는 자리를 가리키는 변경은 명부를 건드리지 않는다', () => {
    const base = getRoster(day('2027-03-01'));
    setDbRosterChanges([c({ from: '2027-03-01', I: '9999', n: '유령', s: '99900000', work: 'driver' })]);
    expect(getRoster(day('2027-03-01'))).toEqual(base);
  });
});

describe('관리자 모드 인사 변경 — 기관사에서 빠진다', () => {
  /** 1번 조임현이 퇴사하고 그 자리가 결원50 이 된다 */
  const resign = c({
    from: '2027-03-01', I: '1', n: '조임현', s: '21714375', work: 'resign',
    vacancyName: '결원50', vacancySabun: '9G010950',
  });

  it('시행일부터 그 자리가 결원이 된다', () => {
    setDbRosterChanges([resign]);
    expect(getRoster(day('2027-02-28')).find((p) => p.I === '1')?.n).toBe('조임현');
    const after = getRoster(day('2027-03-01')).find((p) => p.I === '1');
    expect(after?.n).toBe('결원50');
    expect(after?.s).toBe('9G010950');
  });

  it('퇴사하면 내근·인턴 어느 명단에도 들어가지 않는다', () => {
    setDbRosterChanges([resign]);
    expect(joinedUsers('extra', day('2027-03-01')).some((u) => u.s === '21714375')).toBe(false);
    expect(joinedUsers('intern', day('2027-03-01')).some((u) => u.s === '21714375')).toBe(false);
  });

  it('내근으로 가면 내근 명단에 들어오고 직급이 붙는다', () => {
    setDbRosterChanges([c({
      from: '2027-03-01', I: '1', n: '조임현', s: '21714375', work: 'office', rank: 'deputy',
      vacancyName: '결원50', vacancySabun: '9G010950',
    })]);

    expect(officeUsers(day('2027-02-28')).some((u) => u.s === '21714375')).toBe(false);
    expect(officeUsers(day('2027-03-01')).some((u) => u.s === '21714375')).toBe(true);
    expect(rankOf('21714375', day('2027-03-01'))).toBe('deputy');
    expect(getRoster(day('2027-03-01')).find((p) => p.I === '1')?.n).toBe('결원50');
  });

  it('휴직·병가·공로연수도 내근 명단으로 간다 (근무 화면이 필요하므로)', () => {
    for (const work of ['leave', 'sick', 'service'] as const) {
      setDbRosterChanges([c({
        from: '2027-03-01', I: '1', n: '조임현', s: '21714375', work,
        vacancyName: '결원50', vacancySabun: '9G010950',
      })]);
      expect(officeUsers(day('2027-03-01')).some((u) => u.s === '21714375')).toBe(true);
    }
  });

  it('결원 이름을 안 정하면 자리를 건드리지 않는다 (조용히 사라지지 않게)', () => {
    setDbRosterChanges([c({ from: '2027-03-01', I: '1', n: '조임현', s: '21714375', work: 'resign' })]);
    expect(getRoster(day('2027-03-01')).find((p) => p.I === '1')?.n).toBe('조임현');
  });
});

describe('명부에 올릴 자격 — 교번표에 근거가 있는 것만', () => {
  /** 명부 관리 화면의 «기관사» 칸이 쓰는 조건과 같다 */
  const driverColumn = (at: Date) =>
    getRoster(at).filter((p) => !/^결원/.test(p.n) && !!p.d && p.d !== '내근');

  it('교번이 없는 사람은 기관사가 아니다 — 이태원(W5)은 d=내근', () => {
    const w5 = P.find((p) => p.I === 'W5');
    expect(w5?.d).toBe('내근');                                     // 전제가 깨지면 알려야 한다
    expect(driverColumn(day('2026-09-01')).some((p) => p.I === 'W5')).toBe(false);
  });

  it('기관사 칸과 내근 명단에 같은 사람이 두 번 나오지 않는다', () => {
    const at = day('2026-09-01');
    const office = new Set(officeUsers(at).map((u) => u.s));
    const both = driverColumn(at).filter((p) => p.s && office.has(p.s));
    expect(both.map((p) => `${p.I} ${p.n}`)).toEqual([]);
  });

  it('통상근무 기관사(W1~W4)는 교번이 있으므로 남는다', () => {
    const col = driverColumn(day('2026-09-01'));
    for (const I of ['W1', 'W2', 'W3', 'W4']) {
      expect(col.some((p) => p.I === I)).toBe(true);
    }
  });

  it('결원 번호는 교번표에 있는 것뿐이다 — 지어낸 번호가 없다', () => {
    const real = new Set(
      P.map((p) => /^결원(\d+)$/.exec(p.n)).filter(Boolean).map((m) => parseInt(m![1], 10)),
    );
    expect([...real].sort((a, b) => a - b)).toEqual([1, 3, 4, 5, 6, 7, 8, 9, 10, 21, 22, 23, 26, 27, 28]);

    // 지금 비어 있는 결원은 전부 그 안에 있어야 한다
    for (const p of getRoster(day('2026-09-01'))) {
      const m = /^결원(\d+)$/.exec(p.n);
      if (m) expect(real.has(parseInt(m[1], 10))).toBe(true);
    }
  });
});

describe('휴직·병가·공로연수 — 내근 명단 맨 아래로', () => {
  /** 명부 관리 화면이 오른쪽 단을 나누는 기준과 같다 */
  const split = (at: Date) => {
    const now = activeWorkTypes(at);
    const office: string[] = [];
    const away: string[] = [];
    for (const u of officeUsers(at)) {
      const w = now.get(u.s ?? '');
      (w && isAway(w) ? away : office).push(u.n);
    }
    return { office, away };
  };

  it('휴직·병가·공로연수는 «쉬는 사람» 으로 따로 잡힌다', () => {
    for (const work of ['leave', 'sick', 'service'] as const) {
      setDbRosterChanges([c({
        from: '2027-03-01', I: '1', n: '조임현', s: '21714375', work,
        vacancyName: '결원50', vacancySabun: '9G010950',
      })]);
      const { office, away } = split(day('2027-03-01'));
      expect(away).toContain('조임현');
      expect(office).not.toContain('조임현');
    }
  });

  it('업무를 맡은 사람은 «쉬는 사람» 이 아니다', () => {
    setDbRosterChanges([c({
      from: '2027-03-01', I: '1', n: '조임현', s: '21714375', work: 'office', duty: 'seomu',
      vacancyName: '결원50', vacancySabun: '9G010950',
    })]);
    const { office, away } = split(day('2027-03-01'));
    expect(office).toContain('조임현');
    expect(away).not.toContain('조임현');
  });

  it('시행 전에는 아직 기관사다', () => {
    setDbRosterChanges([c({
      from: '2027-03-01', I: '1', n: '조임현', s: '21714375', work: 'sick',
      vacancyName: '결원50', vacancySabun: '9G010950',
    })]);
    expect(split(day('2027-02-28')).away).not.toContain('조임현');
    expect(getRoster(day('2027-02-28')).find((p) => p.I === '1')?.n).toBe('조임현');
  });
});

describe('새로 입사한 직원', () => {
  it('인턴으로 넣으면 인턴 명단에 나타난다', () => {
    setDbRosterChanges([c({ from: '2027-03-01', n: '신입사원', s: '22699001', work: 'intern' })]);
    expect(internUsers(day('2027-02-28')).some((u) => u.s === '22699001')).toBe(false);
    expect(internUsers(day('2027-03-01')).some((u) => u.s === '22699001')).toBe(true);
  });

  it('업무를 맡겨 넣으면 내근 명단에 나타난다', () => {
    setDbRosterChanges([c({ from: '2027-03-01', n: '신입사원', s: '22699001', work: 'office', duty: 'yeongyangsa' })]);
    expect(officeUsers(day('2027-03-01')).some((u) => u.s === '22699001')).toBe(true);
    expect(dutyOf('22699001', day('2027-03-01'))).toBe('yeongyangsa');
  });

  it('기관사로 넣으면 그 결원 자리에 앉는다', () => {
    setDbRosterChanges([c({ from: '2027-03-01', I: '55', n: '신입사원', s: '22699001', work: 'driver' })]);
    expect(getRoster(day('2027-03-01')).find((p) => p.I === '55')?.n).toBe('신입사원');
    expect(getRoster(day('2027-03-01')).length).toBe(P.length);   // 자리 수는 그대로
  });
});

describe('관리자 모드 인사 변경 — 업무', () => {
  it('기관사가 업무를 맡으면 내근 명단으로 오고 업무가 붙는다', () => {
    setDbRosterChanges([c({
      from: '2027-03-01', I: '1', n: '조임현', s: '21714375', work: 'office', duty: 'jido_gisa',
      vacancyName: '결원50', vacancySabun: '9G010950',
    })]);
    expect(dutyOf('21714375', day('2027-02-28'))).toBe(null);
    expect(dutyOf('21714375', day('2027-03-01'))).toBe('jido_gisa');
    expect(officeUsers(day('2027-03-01')).some((u) => u.s === '21714375')).toBe(true);
  });

  it('업무를 지원기관사로 바꾸면 그 권한이 따라온다', () => {
    // 박종길(21711719)은 처음부터 지원기관사, 김다솜(22000103)은 아니다
    expect(isJiwonGigwansa('22000103')).toBe(false);
    setDbRosterChanges([c({ from: '2027-03-01', n: '김다솜', s: '22000103', work: 'office', duty: 'jiwon_gisa' })]);
    expect(dutyOf('22000103', day('2027-03-01'))).toBe('jiwon_gisa');
  });

  it('지원기관사가 기관사로 가면 그 권한이 사라진다', () => {
    expect(dutyOf('21711719', day('2027-02-28'))).toBe('jiwon_gisa');
    setDbRosterChanges([c({ from: '2027-03-01', I: '55', n: '박종길', s: '21711719', work: 'driver' })]);
    expect(dutyOf('21711719', day('2027-03-01'))).toBe(null);
  });

  it('내근이 아니면 업무가 남지 않는다 — «퇴사한 서무» 가 생기지 않게', () => {
    setDbRosterChanges([c({
      from: '2027-03-01', I: '1', n: '조임현', s: '21714375', work: 'resign', duty: 'seomu',
      vacancyName: '결원50', vacancySabun: '9G010950',
    })]);
    expect(dutyOf('21714375', day('2027-03-01'))).toBe(null);
  });
});

describe('관리자 모드 인사 변경 — 직급', () => {
  it('직급을 바꾸면 호칭이 따라온다', () => {
    // 신은미(대리) → 과장
    expect(rankOf('21717671', day('2027-02-28'))).toBe('daeri');
    setDbRosterChanges([c({ from: '2027-03-01', n: '신은미', s: '21717671', work: 'office', rank: 'gwajang' })]);
    expect(rankOf('21717671', day('2027-03-01'))).toBe('gwajang');
    expect(getUserRole('21717671')).toBeTruthy();
  });

  it('기관사가 되면 직급이 사라진다 — «기관사 부장님» 이 생기지 않게', () => {
    // 이현구(부장) 가 기관사가 되는 경우
    expect(rankOf('21711694', day('2027-02-28'))).toBe('manager');
    setDbRosterChanges([c({ from: '2027-03-01', I: '55', n: '이현구', s: '21711694', work: 'driver' })]);
    expect(rankOf('21711694', day('2027-03-01'))).toBe(null);
    expect(activeRanks(day('2027-03-01')).get('21711694')).toBe(null);
  });

  it('직급이 있는 사람이 업무를 맡아도 직급이 남는다 — 이름 옆에 둘 다 보여야 한다', () => {
    // 김봉철은 부장. 업무만 지도부장으로 정해 준다(직급은 안 건드림)
    expect(rankOf('21707406', day('2027-02-28'))).toBe('manager');
    setDbRosterChanges([c({
      from: '2027-03-01', n: '김봉철', s: '21707406', work: 'office', duty: 'jido_bujang',
    })]);
    expect(rankOf('21707406', day('2027-03-01'))).toBe('manager');   // 부장 그대로
    expect(dutyOf('21707406', day('2027-03-01'))).toBe('jido_bujang');
  });

  it('업무가 있는 사람의 직급만 바꿔도 업무가 남는다', () => {
    // 박종길은 지원기관사. 직급만 차장으로 준다
    expect(dutyOf('21711719', day('2027-02-28'))).toBe('jiwon_gisa');
    setDbRosterChanges([c({ from: '2027-03-01', n: '박종길', s: '21711719', work: 'office', rank: 'deputy' })]);
    expect(rankOf('21711719', day('2027-03-01'))).toBe('deputy');
    expect(dutyOf('21711719', day('2027-03-01'))).toBe('jiwon_gisa');   // 업무 그대로
  });

  it('직급만 바꾸는 변경은 교번 자리를 건드리지 않는다', () => {
    const base = getRoster(day('2027-03-01'));
    setDbRosterChanges([c({ from: '2027-03-01', n: '신은미', s: '21717671', work: 'office', rank: 'manager' })]);
    expect(getRoster(day('2027-03-01'))).toEqual(base);
  });
});
