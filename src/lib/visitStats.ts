// ===== 접속 통계 기준 (SSOT) =====
// 설정 화면(/api/stats)과 관리자 대시보드(/api/admin/dashboard)가
// "오늘"과 "접속"을 똑같이 세도록 기준을 한곳에 둔다.

/** 접속으로 치는 audit_log action */
export const VISIT_ACTIONS = [
  'app_visit',
  'login_pin',
  'login_webauthn',
  'login_name',
  'first_login',
] as const;

const KST_OFFSET = 9 * 60 * 60 * 1000;

/**
 * KST 오늘 자정을 UTC ISO 로 — DB created_at(timestamptz) 비교용.
 *
 * `new Date().toISOString().slice(0,10) + 'T00:00:00'` 처럼 타임존 없는 문자열을
 * 넘기면 Postgres 가 UTC 자정(= KST 오전 9시)으로 읽어, 야간·새벽 근무자의
 * 00~09시 접속이 통째로 빠진다. 반드시 이 함수를 쓸 것.
 */
export function getTodayStartKST(): string {
  const kstNow = new Date(Date.now() + KST_OFFSET);
  const kstMidnight = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate());
  return new Date(kstMidnight - KST_OFFSET).toISOString();
}

/** UTC 타임스탬프가 KST 로 며칠인지 (YYYY-MM-DD) — 일별 집계용 */
export function kstDay(ts: string): string {
  return new Date(new Date(ts).getTime() + KST_OFFSET).toISOString().slice(0, 10);
}

/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayKST(): string {
  return kstDay(new Date().toISOString());
}
