import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useToastStore, showToast, dismissToast } from '../toast';

/**
 * 토스트 store 회귀 테스트 (UI-TOAST-001)
 *
 * 이 파일이 지키는 것 —
 *  1. **컴포넌트가 하나도 마운트되지 않은 상태에서도 토스트가 살아있다.**
 *     이전 구현(모듈 레벨 `addToastFn` 싱글턴)에서는 여기서 그냥 사라졌다.
 *     이 테스트가 깨지면 그 회귀가 돌아온 것이다.
 *  2. 같은 문구 연타 시 도배되지 않는다.
 *  3. 최대 개수를 넘으면 오래된 것부터 밀려나고 타이머도 함께 정리된다.
 *  4. 3초 뒤 자동으로 사라진다.
 */

beforeEach(() => {
  useToastStore.getState().clear();
  vi.useFakeTimers();
});

afterEach(() => {
  useToastStore.getState().clear();
  vi.useRealTimers();
});

describe('토스트 store — 컴포넌트 밖에서도 동작', () => {
  it('렌더러가 없어도 showToast 가 상태에 쌓인다 (모듈 싱글턴 회귀 방지)', () => {
    expect(useToastStore.getState().toasts).toHaveLength(0);
    showToast('저장했어요', 'success');
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ text: '저장했어요', type: 'success' });
  });

  it('type 을 생략하면 info 다', () => {
    showToast('안내');
    expect(useToastStore.getState().toasts[0].type).toBe('info');
  });
});

describe('토스트 store — 중복/개수 제한', () => {
  it('같은 문구+타입을 연타해도 하나만 쌓인다', () => {
    showToast('전송 실패', 'error');
    showToast('전송 실패', 'error');
    showToast('전송 실패', 'error');
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('문구가 같아도 타입이 다르면 별개다', () => {
    showToast('완료', 'success');
    showToast('완료', 'info');
    expect(useToastStore.getState().toasts).toHaveLength(2);
  });

  it('3개를 넘으면 가장 오래된 것부터 밀려난다', () => {
    showToast('첫번째');
    showToast('두번째');
    showToast('세번째');
    showToast('네번째');
    const texts = useToastStore.getState().toasts.map((t) => t.text);
    expect(texts).toHaveLength(3);
    expect(texts).toEqual(['두번째', '세번째', '네번째']);
  });
});

describe('토스트 store — 수명', () => {
  it('3초가 지나면 자동으로 사라진다', () => {
    showToast('잠깐 안내');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(2999);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('같은 문구를 다시 부르면 수명이 연장된다', () => {
    showToast('처리 중');
    vi.advanceTimersByTime(2500);
    showToast('처리 중');            // 갱신
    vi.advanceTimersByTime(2500);    // 최초 기준이면 이미 사라졌어야 함
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(600);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('dismiss 로 즉시 닫을 수 있다', () => {
    const id = showToast('닫을 것');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    dismissToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe('토스트 store — 햅틱 자동 발화', () => {
  it('미지원 환경(navigator.vibrate 없음)에서도 에러 없이 동작한다', () => {
    // jsdom 에는 navigator.vibrate 가 없다 = iOS Safari 와 같은 상황
    expect(typeof (navigator as Navigator & { vibrate?: unknown }).vibrate).not.toBe('function');
    expect(() => {
      showToast('성공', 'success');
      showToast('실패', 'error');
      showToast('주의', 'warning');
    }).not.toThrow();
    expect(useToastStore.getState().toasts).toHaveLength(3);
  });
});
