import { describe, it, expect } from 'vitest';
import { useCompareStore } from '../../../stores/compare';
import { P } from '@/data/cycle';

/**
 * 교번비교 선택 저장 회귀 테스트 (store 데이터모델).
 *
 * 버그: 선택을 store 에 넣는 코드가 '선택 완료' 버튼 한 곳뿐 → 그 탭이 눌림효과에 취소되면
 *      아무것도 저장되지 않아 화면에 안 뜨고, 저장이 없으니 새로고침하면 초기화.
 * 수정: 기관사를 탭할 때마다 즉시 setPersonsBatch 로 store(=활성 그룹)에 저장.
 *
 * 이 테스트는 setPersonsBatch 가 활성 그룹에 선택을 확실히 보관함을 보장한다.
 * (persist 는 이 그룹 배열을 식별자로 직렬화하므로, 그룹에 남으면 새로고침에도 복원된다.)
 */
describe('교번비교 store — 선택 저장', () => {
  it('setPersonsBatch: 고른 인원이 persons + 활성 그룹에 즉시 저장된다', () => {
    const s = useCompareStore.getState();
    s.setActiveGroup(0);
    const picked = [P[0], P[1], P[2]];
    s.setPersonsBatch(picked);

    const st = useCompareStore.getState();
    expect(st.count).toBe(3);
    expect(st.persons.map((p) => p?.I ?? null)).toEqual(picked.map((p) => p.I));
    // 영속 대상인 그룹 배열에도 동일하게 보관 (새로고침 복원의 근거)
    expect(st.groups[0].persons.map((p) => p?.I ?? null)).toEqual(picked.map((p) => p.I));
  });

  it('그룹 전환 후 돌아와도 선택이 유지된다 (그룹별 보관)', () => {
    const s = useCompareStore.getState();
    s.setActiveGroup(0);
    const g0 = [P[0], P[1]];
    s.setPersonsBatch(g0);

    // 다른 그룹으로 갔다가 (그룹1은 비어있음)
    useCompareStore.getState().setActiveGroup(1);
    expect(useCompareStore.getState().persons.every((p) => p === null)).toBe(true);

    // 그룹0 으로 복귀 → 원래 2명 복원
    useCompareStore.getState().setActiveGroup(0);
    expect(useCompareStore.getState().persons.map((p) => p?.I ?? null)).toEqual(g0.map((p) => p.I));
  });

  it('한 명씩 추가(탭)해도 누적 저장된다 — togglePerson 이 쓰는 경로', () => {
    const s = useCompareStore.getState();
    s.setActiveGroup(2);
    s.setPersonsBatch([]); // 비우고 시작

    // togglePerson 이 하는 것과 동일: 매 탭마다 누적 배열을 setPersonsBatch
    useCompareStore.getState().setPersonsBatch([P[5]]);
    useCompareStore.getState().setPersonsBatch([P[5], P[6]]);
    useCompareStore.getState().setPersonsBatch([P[5], P[6], P[7]]);

    const st = useCompareStore.getState();
    expect(st.persons.map((p) => p?.I ?? null)).toEqual([P[5].I, P[6].I, P[7].I]);
    expect(st.groups[2].persons.map((p) => p?.I ?? null)).toEqual([P[5].I, P[6].I, P[7].I]);
  });
});
