import { describe, it, expect } from 'vitest';
import { canViewInfoOf, canViewOthersInfo } from '../lib/myInfoAccess';
import { stageOf, nextStageGoal, stageRule } from '../lib/complaintStages';

const CHIEF = '21704630';      // 소장
const VICE = '21711216';       // 부소장
const DRIVER_A = '21714375';   // 일반 기관사
const DRIVER_B = '21714669';

describe('내 정보 열람 권한 — 개인정보라 본인만, 다른 사람은 소장·부소장·관리자 계정만', () => {
  it('본인은 자기 것을 본다', () => {
    expect(canViewInfoOf({ sabun: DRIVER_A, role: 'driver' }, DRIVER_A)).toBe(true);
  });
  it('일반 기관사는 다른 사람 것을 못 본다', () => {
    expect(canViewInfoOf({ sabun: DRIVER_A, role: 'driver' }, DRIVER_B)).toBe(false);
    expect(canViewOthersInfo(DRIVER_A, 'driver')).toBe(false);
  });
  it('소장·부소장은 다른 사람 것을 본다', () => {
    expect(canViewInfoOf({ sabun: CHIEF, role: 'driver' }, DRIVER_B)).toBe(true);
    expect(canViewInfoOf({ sabun: VICE, role: 'driver' }, DRIVER_B)).toBe(true);
  });
  it('관리자 계정(role=admin)은 다른 사람 것을 본다', () => {
    expect(canViewInfoOf({ sabun: '030827', role: 'admin' }, DRIVER_B)).toBe(true);
  });
  it('사번이 없으면 아무것도 못 본다', () => {
    expect(canViewInfoOf({ sabun: null, role: 'admin' }, DRIVER_B)).toBe(false);
    expect(canViewInfoOf({ sabun: '', role: 'driver' }, '')).toBe(false);
  });
});

describe('민원 7단계 — 보고서 5-2·5-3쪽 기준', () => {
  it('출입문 기준', () => {
    expect(stageOf('door', 0, 1)).toBe(1);
    expect(stageOf('door', 0, 0)).toBe(2);
    expect(stageOf('door', 2, 0)).toBe(3);
    expect(stageOf('door', 3, 2)).toBe(4);
    expect(stageOf('door', 5, 0)).toBe(5);
    expect(stageOf('door', 7, 0)).toBe(6);
    expect(stageOf('door', 10, 0)).toBe(7);
  });
  it('전체 불만 기준은 경계가 다르다(5~6 경계, 7 경고)', () => {
    expect(stageOf('all', 6, 0)).toBe(5);
    expect(stageOf('all', 7, 0)).toBe(6);
    expect(stageOf('all', 8, 0)).toBe(7);
  });
  it('다음 단계 목표', () => {
    expect(nextStageGoal('door', 1, 0)).toBeNull();
    expect(nextStageGoal('door', 2, 0)).toMatchObject({ target: 1, praiseOnly: true });
    expect(nextStageGoal('door', 4, 4)).toMatchObject({ target: 3, maxEvents: 2, less: 2 });
    expect(nextStageGoal('door', 7, 10)).toMatchObject({ target: 6, maxEvents: 7, less: 3 });
  });
  it('기준 설명', () => {
    expect(stageRule('door', 4)).toBe('3~4건');
    expect(stageRule('door', 5)).toBe('5건');
    expect(stageRule('door', 7)).toBe('8건 이상');
  });
});
