import { describe, it, expect, afterEach } from 'vitest';
import { P } from '@/data/cycle';
import { ROSTER_CHANGES, setDbRosterChanges, type RosterChange } from '@/data/rosterChanges';
import { EXTRA_USERS } from '@/lib/auth';
import { useDriverStore } from '@/stores/driver';

/**
 * 내근 → 기관사 발령(관리자 모드, DB)이 시행된 사람이 앱을 켜면 기관사로 보여야 한다.
 *
 * 앱이 켜질 때 저장된 «나»는 발령 예약을 받기 전에 복원돼 내근(I='0')으로 잡힌다.
 * 예약을 받은 뒤 refreshFromRoster() 가 교번 자리로 다시 찾아야 한다 — 전에는 사번·이름이
 * 같다고 다시 찾지 않아 기관사인데 내근 화면이 떴다(2026-09-22).
 */

afterEach(() => {
  setDbRosterChanges([]);
  useDriverStore.getState().logout();
});

describe('발령 뒤 «나» 다시 찾기', () => {
  it('내근에서 기관사가 된 사람은 명부를 받은 뒤 교번 자리로 바뀐다', () => {
    const office = EXTRA_USERS[EXTRA_USERS.length - 1];
    // 정적 발령이 쓰지 않는 결원 자리 — 쓰는 자리면 정적 발령이 뒤에서 덮어쓴다
    const taken = new Set(ROSTER_CHANGES.map((c) => c.I));
    const slot = P.find((p) => p.n.startsWith('결원') && !taken.has(p.I))!;

    // 1) 명부를 받기 전 — 내근으로 복원된 상태
    setDbRosterChanges([]);
    useDriverStore.getState().setMyDriver(office);
    expect(useDriverStore.getState().myDriver?.I).toBe('0');

    // 2) 발령 예약(이미 시행됨)을 받는다
    const change: RosterChange = { from: '2000-01-01', I: slot.I, n: office.n, s: office.s, work: 'driver' };
    setDbRosterChanges([change]);
    useDriverStore.getState().refreshFromRoster();

    const me = useDriverStore.getState().myDriver;
    expect(me?.I).toBe(slot.I);
    expect(me?.s).toBe(office.s);
    expect(useDriverStore.getState().isViewMode).toBe(false);
  });

  it('다른 사람을 조회 중이면 조회 모드는 그대로 둔다', () => {
    const office = EXTRA_USERS[EXTRA_USERS.length - 1];
    const other = P.find((p) => !p.n.startsWith('결원'))!;
    setDbRosterChanges([]);
    useDriverStore.getState().setMyDriver(office);
    useDriverStore.getState().setCurrent(other);

    useDriverStore.getState().refreshFromRoster();

    expect(useDriverStore.getState().current?.s).toBe(other.s);
    expect(useDriverStore.getState().isViewMode).toBe(true);
  });
});
