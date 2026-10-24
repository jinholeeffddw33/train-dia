import { describe, it, expect } from 'vitest';
import { canViewAllComplaints, compareByComplaint, topTypes, type JidoComplaint } from '../lib/jidoComplaint';
import { canViewJido } from '../lib/jidoAccess';

const c = (sabun: string, doorStage: JidoComplaint['doorStage'], doorEvents: number, allEvents = doorEvents): JidoComplaint => ({
  sabun, doorStage, allStage: doorStage, doorEvents, allEvents, praise: 0, injury: 0, mgmt: '',
  types: {}, mainStations: '', mainTimes: '', otherComplaints: '',
});

describe('지도승무 출입문 민원 — 열람 범위', () => {
  it('소장·부소장·지도부장 3명은 전체를 본다', () => {
    for (const s of ['21704630', '21711216', '21711197', '21706793', '21711694']) {
      expect(canViewAllComplaints(s, 'driver')).toBe(true);
    }
  });
  it('관리자 계정은 전체를 본다', () => {
    expect(canViewAllComplaints('030827', 'admin')).toBe(true);
  });
  it('지도승무를 하는 다른 부장도 전체를 본다(2026-10-25)', () => {
    expect(canViewAllComplaints('21709589', 'driver')).toBe(true); // 김진완 부장
    expect(canViewJido('21709589', 'driver')).toBe(true);
  });
  it('기관사는 지도승무도, 전체 민원도 못 본다', () => {
    expect(canViewJido('22500460', 'driver')).toBe(false); // 기관사
    expect(canViewAllComplaints('22500460', 'driver')).toBe(false);
    expect(canViewJido(null, null)).toBe(false);
  });
});

describe('지도승무 출입문 민원 — 정렬', () => {
  it('심각부터, 같은 단계면 출입문 사건이 많은 순, 자료 없는 사람은 맨 뒤', () => {
    const list = [c('a', 3, 1), c('b', 7, 8), c('c', 7, 10), undefined, c('e', 5, 5)];
    const sorted = [...list].sort(compareByComplaint).map((x) => x?.sabun ?? '-');
    expect(sorted).toEqual(['c', 'b', 'e', 'a', '-']);
  });
  it('많은 유형 위로 3개, 0건은 뺀다', () => {
    expect(topTypes({ 신체끼임: 4, 탑승실패: 0, 승하차중: 7, 방송: 1, 교통약자: 3 }))
      .toEqual([{ key: '승하차중', count: 7 }, { key: '신체끼임', count: 4 }, { key: '교통약자', count: 3 }]);
  });
});
