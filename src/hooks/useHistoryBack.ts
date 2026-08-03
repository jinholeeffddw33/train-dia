'use client';

import { useEffect, useRef } from 'react';

/**
 * PWA 뒤로가기(하드웨어/제스처) 인터셉트 훅.
 *
 * 앱은 페이지가 `/` 하나뿐이라 화면 전환이 URL 로 남지 않는다. 그래서 화면이 열릴 때마다
 * 더미 히스토리 엔트리를 하나 쌓아 두고, 뒤로가기가 오면 그걸 소비하며 화면을 닫는다.
 * 엔트리 내용은 쓰지 않는다 — 순수한 카운터다. 중요한 건 **개수**뿐이다.
 *
 * ── 설계: "핸들러 스택 깊이 = 히스토리 깊이" 를 커밋 단위로 맞춘다 ──
 * 예전 구현은 화면마다 등록 시 pushState, 해제 시 history.back() 을 직접 불렀는데,
 * pushState 는 동기이고 back() 은 비동기라 한 커밋에서 여러 개가 열리고 닫히면 순서가 엉켰다.
 * 게다가 back() 을 무시하려고 쓰던 플래그가 boolean 이라 동시에 두 개를 닫으면 popstate
 * 하나가 새어 나가 **엉뚱한 화면(대개 부모)** 을 닫아 버렸다. 그렇게 히스토리 엔트리가
 * 실제 화면 수보다 먼저 소진되면, 사용자가 뒤로가기를 눌렀을 때 앱이 그대로 종료됐다.
 *
 * 지금은 등록/해제가 handlerStack 만 건드리고, 실제 히스토리 조작은 마이크로태스크에서
 * 한 번만 한다. 같은 커밋에서 하나가 닫히고 하나가 열리면 서로 상쇄돼 조작 자체가 없다.
 * 여러 개가 한꺼번에 닫히면 go(-n) 한 번으로 처리하므로 새어 나가는 popstate 도 없다.
 */

type StackEntry = {
  key: string;
  onBack: () => void;
};

/** 열려 있는 화면들. 마지막(top)이 뒤로가기의 대상. */
const handlerStack: StackEntry[] = [];
/** 우리가 pushState 로 쌓아 둔, 아직 살아 있는 더미 엔트리 수. go() 시점에 즉시 반영한다. */
let depth = 0;
/** 우리가 부른 go() 중 아직 popstate 로 돌아오지 않은 횟수. go() 호출 1회 = popstate 1회. */
let pendingGo = 0;
let syncScheduled = false;
let listenerAttached = false;

function ensureGlobalListener() {
  if (listenerAttached) return;
  listenerAttached = true;

  window.addEventListener('popstate', () => {
    // 우리가 화면을 닫으면서 부른 go() 의 메아리 — 소비만 하고 끝낸다
    if (pendingGo > 0) {
      pendingGo -= 1;
      return;
    }
    // 우리 엔트리가 없으면 우리 소관이 아니다. 브라우저에 맡긴다(= 앱 종료가 정상)
    if (depth === 0) return;

    depth -= 1;
    const top = handlerStack.pop();
    if (top) top.onBack();
    // onBack 이 다른 화면까지 닫았을 수 있다 → 그 정리는 각 훅의 cleanup 이 sync 를 다시 예약한다
  });
}

/**
 * handlerStack 깊이에 히스토리 깊이를 맞춘다. 커밋이 끝난 뒤 마이크로태스크에서 한 번만 실행.
 * 모자라면 그만큼 push, 남으면 go(-n) 한 번. 딱 맞으면 아무것도 하지 않는다.
 */
function scheduleSync() {
  if (syncScheduled) return;
  syncScheduled = true;
  queueMicrotask(() => {
    syncScheduled = false;
    const want = handlerStack.length;
    if (want > depth) {
      for (let i = depth; i < want; i++) history.pushState({ historyBack: i + 1 }, '');
      depth = want;
    } else if (want < depth) {
      const n = depth - want;
      depth = want;      // 낙관적 반영 — 되돌아갈 위치를 이미 알고 있다
      pendingGo += 1;    // go() 한 번은 popstate 한 번
      history.go(-n);
    }
  });
}

export function useHistoryBack(
  key: string,
  onBack: () => void,
  enabled: boolean = true,
) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) return;

    ensureGlobalListener();

    const entry: StackEntry = {
      key,
      get onBack() { return onBackRef.current; },
    };
    handlerStack.push(entry);
    scheduleSync();

    return () => {
      // popstate 가 이미 꺼내 갔으면(-1) 건드리지 않는다 — 히스토리도 이미 물러난 상태다
      const idx = handlerStack.indexOf(entry);
      if (idx !== -1) handlerStack.splice(idx, 1);
      scheduleSync();
    };
  }, [key, enabled]);
}
