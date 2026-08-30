/**
 * 명부 변경 예약 내려받기 — 앱이 켜질 때 한 번
 *
 * 관리자가 [설정 → 관리자 → 명부 관리]에서 넣은 예약을 받아, 화면을 그리기 전에
 * 명부에 심는다. 그래야 교번 목록·교대자·비교 화면이 처음부터 맞는 이름을 보여준다.
 *
 * 통신이 안 될 때
 *   지하에서 앱을 켜는 일이 흔하다. 마지막으로 받은 값을 기기에 적어 두고,
 *   실패하면 그걸 쓴다. 그것도 없으면 rosterChanges.ts 의 정적 목록으로 동작한다.
 *   — 어느 쪽이든 앱은 뜬다. 명부 하나 때문에 근무표를 못 보는 일은 없어야 한다.
 */
import { setDbRosterChanges, type RosterChange } from '@/data/rosterChanges';

const CACHE_KEY = 'dia5:roster-changes:v1';

const WORK_TYPES = ['driver', 'office', 'intern', 'leave', 'sick', 'service', 'resign'];

/**
 * 서버가 보내온 값이 진짜 인사 변경인지 확인 — 깨진 캐시가 명부를 망가뜨리지 않게.
 *
 * ★ 자리(I)는 «있을 수도 없을 수도» 있다. 직급·업무만 바꾸는 변경에는 자리가 없다.
 *   예전에 I 를 필수로 검사하다가, 관리자가 넣은 직급·업무 변경을 앱이 받자마자
 *   전부 버리는 사고가 있었다(2026-08-30). 필수는 사람(n·s)·시행일·근무형태뿐이다.
 */
function isValid(c: unknown): c is RosterChange {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  return (
    typeof o.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.from) &&
    typeof o.n === 'string' && o.n.length > 0 &&
    typeof o.s === 'string' && o.s.length > 0 &&
    typeof o.work === 'string' && WORK_TYPES.includes(o.work) &&
    (o.I === undefined || (typeof o.I === 'string' && o.I.length > 0))
  );
}

function readCache(): RosterChange[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const clean = parsed.filter(isValid);
    return clean.length === parsed.length ? clean : null;
  } catch {
    return null;
  }
}

function writeCache(list: RosterChange[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    // 저장 공간이 없어도 이번 실행에는 지장 없다
  }
}

/**
 * 예약을 받아 명부에 심는다. 실패해도 절대 던지지 않는다.
 * AuthGate 가 화면을 그리기 전에 await 한다.
 */
export async function syncRosterChanges(): Promise<void> {
  // 먼저 지난번 값으로 채워 둔다 — 통신이 느리거나 끊겨도 최근 명부가 보인다
  const cached = readCache();
  if (cached) setDbRosterChanges(cached);

  try {
    const res = await fetch('/api/roster/changes', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data?.changes)) return;

    const clean = (data.changes as unknown[]).filter(isValid);
    setDbRosterChanges(clean);
    writeCache(clean);
  } catch {
    // 오프라인 — 캐시(또는 정적 목록)로 그대로 간다
  }
}
