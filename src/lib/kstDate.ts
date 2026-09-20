/**
 * 한국 날짜 — 서버는 UTC 로 돈다.
 *
 * `new Date()` 를 그대로 쓰면 한국 시각 밤 9시~자정 사이에 서버는 아직 «어제» 다.
 * 점호 읽음처럼 «그날» 이 중요한 기록은 언제나 이걸로 날짜를 만든다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 오늘(한국) — 'YYYY-MM-DD' */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
