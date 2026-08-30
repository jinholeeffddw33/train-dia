import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncRosterChanges } from '@/lib/rosterSync';
import { getDbRosterChanges, setDbRosterChanges } from '@/data/rosterChanges';

/**
 * 서버가 보낸 인사 변경을 «앱이 실제로 받아들이는지».
 *
 * 왜 이 테스트가 있나 — 2026-08-30 사고.
 *   검사기가 자리(I)를 필수로 보고 있어서, 관리자가 넣은 직급·업무 변경(자리가 없다)을
 *   앱이 받자마자 전부 버렸다. 저장은 되는데 화면에는 아무 일도 안 일어나,
 *   관리자 화면의 «예약 목록»에는 보이지만 명부에는 반영되지 않는 상태였다.
 *   다른 테스트는 setDbRosterChanges() 를 직접 불러서 이 구간을 건너뛰고 있었다.
 */

const ok = {
  slotMove:  { from: '2027-03-01', I: '55', n: '홍길동', s: '22699999', work: 'driver' },
  dutyOnly:  { from: '2027-03-01', n: '김민정', s: '21715676', work: 'office', duty: 'seomu' },
  rankOnly:  { from: '2027-03-01', n: '신은미', s: '21717671', work: 'office', rank: 'gwajang' },
  leave:     { from: '2027-03-01', n: '김다솜', s: '22000103', work: 'leave' },
};

function mockFetch(changes: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ changes }),
  })));
}

beforeEach(() => {
  setDbRosterChanges([]);
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  setDbRosterChanges([]);
});

describe('인사 변경 내려받기 (rosterSync)', () => {
  it('자리가 없는 변경(직급·업무·휴직)도 버리지 않는다 — 2026-08-30 사고 재발 방지', async () => {
    mockFetch([ok.dutyOnly, ok.rankOnly, ok.leave]);
    await syncRosterChanges();
    expect(getDbRosterChanges()).toHaveLength(3);
    expect(getDbRosterChanges().map((c) => c.s)).toEqual(['21715676', '21717671', '22000103']);
  });

  it('자리를 옮기는 변경도 그대로 받는다', async () => {
    mockFetch([ok.slotMove]);
    await syncRosterChanges();
    expect(getDbRosterChanges()[0]).toMatchObject({ I: '55', n: '홍길동', work: 'driver' });
  });

  it('망가진 줄은 걸러낸다 — 사람·시행일·근무형태가 없으면 안 받는다', async () => {
    mockFetch([
      ok.dutyOnly,
      { from: '2027-03-01', n: '이름만', s: '22600000' },        // work 없음
      { from: '3월1일', n: 'ㄱ', s: '22600001', work: 'office' }, // 날짜 형식 깨짐
      { from: '2027-03-01', n: '', s: '22600002', work: 'office' }, // 이름 없음
      { from: '2027-03-01', n: 'ㄴ', s: '22600003', work: '이상함' }, // 모르는 근무형태
      { from: '2027-03-01', n: 'ㄷ', s: '22600004', work: 'driver', I: '' }, // 자리가 빈 문자열
    ]);
    await syncRosterChanges();
    expect(getDbRosterChanges()).toHaveLength(1);
    expect(getDbRosterChanges()[0].s).toBe('21715676');
  });

  it('통신이 안 되면 조용히 넘어간다 — 명부 때문에 앱이 죽으면 안 된다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(syncRosterChanges()).resolves.toBeUndefined();
    expect(getDbRosterChanges()).toEqual([]);
  });

  it('서버가 에러를 주면 이전 값을 지우지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    await syncRosterChanges();
    expect(getDbRosterChanges()).toEqual([]);
  });
});
