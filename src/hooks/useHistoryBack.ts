'use client';

import { useEffect, useRef } from 'react';

/**
 * PWA 뒤로가기 인터셉트 훅 v6.
 *
 * Android 하드웨어 뒤로가기 + iOS 스와이프 제스처 대응.
 *
 * 원리:
 * - history 스택을 항상 [base, guard] 2개 유지 → 앱 종료 불가
 * - popstate → guard 즉시 복구 → 콜백 Map에서 최상위 활성 핸들러 실행
 * - 콜백은 ref로 매 렌더마다 동기적으로 갱신 (useEffect 의존성 없음)
 * - cleanup에서 history 조작 없음
 * - 300ms lock으로 연쇄 popstate 방지
 */

// key → ref (항상 최신 콜백을 담는 ref 객체)
const refMap = new Map<string, { current: (() => void) | null }>();
const order: string[] = [];
let initialized = false;
let locked = false;

function setup() {
  if (initialized) return;
  initialized = true;

  history.replaceState({ _dia: 'base' }, '');
  history.pushState({ _dia: 'guard' }, '');

  window.addEventListener('popstate', () => {
    if (locked) {
      history.pushState({ _dia: 'guard' }, '');
      return;
    }
    locked = true;

    // guard 즉시 복구
    history.pushState({ _dia: 'guard' }, '');

    // 디버그: 화면에 표시 (폰에서 확인용)
    const status = order.map(k => `${k}:${refMap.get(k)?.current ? 'ON' : 'off'}`).join(' | ');
    const dbg = document.getElementById('_dia_dbg');
    if (dbg) dbg.textContent = status;
    // eslint-disable-next-line no-console
    console.log(`[BACK] ${status}`);

    // 등록 역순으로 활성 핸들러 찾아 실행
    for (let i = order.length - 1; i >= 0; i--) {
      const ref = refMap.get(order[i]);
      if (ref?.current) {
        // eslint-disable-next-line no-console
        console.log(`[BACK] exec: ${order[i]}`);
        ref.current();
        break;
      }
    }

    setTimeout(() => { locked = false; }, 300);
  });
}

export function useHistoryBack(
  key: string,
  onBack: () => void,
  enabled: boolean = true,
) {
  // ref로 콜백 관리 → 매 렌더마다 동기적으로 갱신
  const fnRef = useRef<(() => void) | null>(null);
  fnRef.current = enabled ? onBack : null;

  useEffect(() => {
    setup();

    // ref 객체를 글로벌 Map에 등록 (한 번만)
    if (!refMap.has(key)) {
      refMap.set(key, fnRef);
      order.push(key);
    } else {
      // 이미 등록됨 → ref 객체 교체 (React Strict Mode remount 대응)
      refMap.set(key, fnRef);
    }

    return () => {
      refMap.delete(key);
      const idx = order.indexOf(key);
      if (idx !== -1) order.splice(idx, 1);
    };
  }, [key]); // key만 의존 → mount/unmount 시에만 실행
}
