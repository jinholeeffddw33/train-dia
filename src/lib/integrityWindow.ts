/**
 * 청렴 경진대회 응시 기간 판정 — 한국 날짜로.
 *
 * Vercel 서버는 UTC 로 돈다. `new Date()` 를 그대로 쓰면 한국 시각 밤 9시~자정 사이에
 * 서버는 아직 «어제» 라서, 27일 밤에 들어온 제출을 26일로 세거나 28일 새벽 제출을
 * 열어 주는 어긋남이 생긴다. 그래서 날짜는 언제나 KST 로 만든다.
 */
import { INTEGRITY_OPEN_FROM, INTEGRITY_OPEN_UNTIL } from '@/data/integrityQuiz';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 오늘(한국) — 'YYYY-MM-DD' */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export type IntegrityPhase = 'before' | 'open' | 'closed';

export function integrityPhase(today: string = kstToday()): IntegrityPhase {
  if (today < INTEGRITY_OPEN_FROM) return 'before';
  if (today > INTEGRITY_OPEN_UNTIL) return 'closed';
  return 'open';
}
