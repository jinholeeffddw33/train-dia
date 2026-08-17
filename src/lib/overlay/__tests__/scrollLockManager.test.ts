// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  acquireScrollLock,
  releaseScrollLock,
  isScrollLocked,
  getScrollLockDepth,
  __resetScrollLockForTest,
} from '@/lib/overlay/scrollLockManager';

/**
 * 배경 스크롤 잠금 회귀 테스트.
 *
 * 이 테스트가 지키는 것은 **중첩**이다. 오버레이가 하나일 때는 어떤 구현이든 잘 돌아가고,
 * 그래서 train-dia 의 모달 13곳이 각자 body.style.overflow 를 만지면서도 멀쩡해 보였다.
 * 무너지는 건 두 개가 겹칠 때뿐이라, 그 시나리오를 여기 못 박아 둔다.
 */

/** 각 모달이 "각자" 잠그던 옛 방식 — 사고를 재현해 이 테스트의 존재 이유를 증명한다 */
function naiveLock(): string {
  const prev = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return prev;
}
function naiveUnlock(prev: string): void {
  document.body.style.overflow = prev;
}

describe('scrollLockManager — 단일 오버레이', () => {
  beforeEach(() => __resetScrollLockForTest());

  it('잠그면 body 가 고정되고, 풀면 원래대로 돌아온다', () => {
    expect(isScrollLocked()).toBe(false);

    acquireScrollLock();
    expect(isScrollLocked()).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    // iOS 는 overflow:hidden 만으론 안 막혀 position:fixed 가 필요하다
    expect(document.body.style.position).toBe('fixed');

    releaseScrollLock();
    expect(isScrollLocked()).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.position).toBe('');
  });
});

describe('scrollLockManager — 중첩 (실제 사고 시나리오)', () => {
  beforeEach(() => __resetScrollLockForTest());

  it('A 위에 B 를 열고 A 를 먼저 닫아도 배경은 잠긴 채로 남는다', () => {
    acquireScrollLock(); // A (예: 안전수칙 전체화면)
    acquireScrollLock(); // B (그 위 첨부 라이트박스)
    expect(getScrollLockDepth()).toBe(2);

    releaseScrollLock(); // A 가 먼저 닫힘
    expect(isScrollLocked()).toBe(true);
    expect(document.body.style.overflow).toBe('hidden'); // ★ B 가 아직 떠 있다

    releaseScrollLock(); // B 닫힘
    expect(isScrollLocked()).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('옛 방식(각자 잠금)은 같은 순서에서 화면을 영구히 얼린다 — 이 테스트가 막는 것', () => {
    // 1) A 열림
    const prevA = naiveLock();
    // 2) A 위에 B 열림 — prev 로 'hidden' 을 붙잡는다
    const prevB = naiveLock();
    // 3) A 가 먼저 닫힘 → 배경이 풀린다 (B 가 떠 있는데!)
    naiveUnlock(prevA);
    expect(document.body.style.overflow).toBe(''); // 버그 ①: B 뒤 배경이 스크롤됨
    // 4) B 닫힘 → 'hidden' 을 되심는다
    naiveUnlock(prevB);
    expect(document.body.style.overflow).toBe('hidden'); // 버그 ②: 다 닫혔는데 영구 잠김

    // 같은 순서를 SSOT 로 하면 끝에 깨끗하게 풀린다
    __resetScrollLockForTest();
    acquireScrollLock();
    acquireScrollLock();
    releaseScrollLock();
    releaseScrollLock();
    expect(document.body.style.overflow).toBe('');
  });

  it('셋 이상 겹쳐도 마지막 하나가 닫힐 때만 풀린다', () => {
    acquireScrollLock();
    acquireScrollLock();
    acquireScrollLock();
    releaseScrollLock();
    releaseScrollLock();
    expect(isScrollLocked()).toBe(true);
    releaseScrollLock();
    expect(isScrollLocked()).toBe(false);
  });
});

describe('scrollLockManager — 짝이 안 맞는 호출', () => {
  beforeEach(() => __resetScrollLockForTest());

  it('잠그지 않았는데 풀어도 카운터가 음수로 내려가지 않는다', () => {
    releaseScrollLock();
    releaseScrollLock();
    expect(getScrollLockDepth()).toBe(0);

    // 음수로 내려갔다면 이 다음 잠금이 안 먹었을 것이다
    acquireScrollLock();
    expect(document.body.style.overflow).toBe('hidden');
    releaseScrollLock();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('scrollLockManager — 스크롤 위치 보존', () => {
  beforeEach(() => __resetScrollLockForTest());

  it('잠글 때의 위치를 body top 에 적어 두고, 풀면 그 자리로 되돌린다', () => {
    // jsdom 에는 실제 스크롤이 없으므로 값만 주입해 계약을 검증한다
    Object.defineProperty(window, 'scrollY', { value: 420, writable: true, configurable: true });
    let restoredTo: number | null = null;
    window.scrollTo = ((x: number, y: number) => { restoredTo = y; }) as typeof window.scrollTo;

    acquireScrollLock();
    expect(document.body.style.top).toBe('-420px');

    releaseScrollLock();
    expect(restoredTo).toBe(420);
    expect(document.body.style.top).toBe('');
  });
});
