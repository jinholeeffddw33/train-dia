/**
 * 진입 모달 게이트 — 세션당 최대 1개만 노출 (R4, 2026-07-02).
 *
 * page.tsx 진입 시 RefreshGuide/CycleChange/InternWelcome/KimMinkyungAward/WhatsNew
 * 가 동시에 뜰 수 있어, 자체 노출 조건을 통과한 모달들이 이 게이트에 손을 들면
 * 같은 커밋(마운트) 안의 후보를 모아 우선순위 1개만 승인한다.
 * 나머지는 sessionStorage 마킹으로 이번 세션엔 안 뜨고, 다음 세션에 다시 후보가 된다.
 * (각 모달의 localStorage "오늘 그만 보기" 조건은 그대로 유지 — 게이트는 감싸기만 한다)
 */

const SESSION_KEY = 'dia-entry-modal-shown';

/** 우선순위 — 높을수록 먼저 (CycleChange > RefreshGuide > WhatsNew > InternWelcome > KimMinkyungAward) */
const PRIORITY: Record<string, number> = {
  'cycle-change': 5,
  'refresh-guide': 4,
  'announce-2026-07-14': 4, // 3일 전직원 공지 (whats-new 위)
  'whats-new': 3,
  'intern-welcome': 2,
  'kim-minkyung-award': 1,
};

let pending: { name: string; grant: () => void }[] = [];
let flushScheduled = false;

function alreadyShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markShown() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore — storage 불가 환경이면 그냥 노출 */
  }
}

/**
 * 자체 노출 조건(shouldShow)을 통과한 모달이 호출.
 * 같은 tick 에 모인 후보 중 우선순위 최상위 1개만 grant 콜백이 실행된다.
 */
export function requestEntryModal(name: string, grant: () => void) {
  if (alreadyShownThisSession()) return;
  pending.push({ name, grant });
  if (flushScheduled) return;
  flushScheduled = true;
  // React 커밋의 passive effect 들이 모두 동기 실행된 뒤 microtask 에서 판정
  queueMicrotask(() => {
    flushScheduled = false;
    const candidates = pending;
    pending = [];
    if (candidates.length === 0 || alreadyShownThisSession()) return;
    candidates.sort((a, b) => (PRIORITY[b.name] ?? 0) - (PRIORITY[a.name] ?? 0));
    markShown();
    candidates[0].grant();
  });
}
