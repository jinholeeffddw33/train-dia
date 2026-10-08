/**
 * 발표용 읽음 현황 «예시 자료» — 체험 계정(1234·답십리)에게만, 2026-10-21 까지만.
 *
 * 왜 (진호 2026-10-09): 10/21 SMART5 연구발표회에서 체험 계정으로 «읽음 확인» 화면을 보여 준다.
 * 실제 읽음 기록(hazard_reads)은 안전 관리 기록이라 **DB 는 한 줄도 바꾸지 않는다** — 체험 계정이
 * 받는 응답에서만 읽은 사람을 채워 보이고, 화면에 «예시 자료»라고 표시한다.
 * 22일에는 확인할 수 없다고 해서(진호) **2026-10-22 00:00(한국 시간)부터 저절로 꺼진다** — 손댈 것 없음.
 *
 * 목표 비율(진호): 운전정보 1~18호 약 95% · 19호 약 85% · 20호 약 70% · 그 밖(사례교육 등) 95% 이상.
 * 실제로 읽은 사람은 그대로 «읽음»으로 두고, 모자란 만큼만 안 읽은 사람 중에서 골라 채운다.
 * 고르는 순서는 (사번·게시물) 해시라 새로고침해도 같은 사람이 같게 나온다.
 */
import { isGuest } from '@/lib/guestAccount';

/** 이 시각부터는 예시를 보여 주지 않는다 — 2026-10-22 00:00 KST */
export const READ_DEMO_UNTIL = Date.parse('2026-10-22T00:00:00+09:00');

export function readDemoActive(sabun: string | null | undefined, now: number = Date.now()): boolean {
  return isGuest(sabun) && now < READ_DEMO_UNTIL;
}

const DRIVING_TAGS = new Set(['시설물', '열차', '신호']);

/** 게시물 → 목표 읽음 비율 */
export function demoReadRatio(description: string | null, location: string | null): number {
  const first = ((description ?? '').replace(/\r\n?/g, '\n').split('\n')[0] ?? '').trim();
  const tag = first.match(/^\[([^\]]+)\]/)?.[1]?.trim() ?? '';
  const no = /^(\d+)호$/.exec((location ?? '').trim());
  if (DRIVING_TAGS.has(tag) && no) {
    const n = Number(no[1]);
    if (n === 20) return 0.7;
    if (n === 19) return 0.85;
    if (n <= 18) return 0.95;
  }
  return 0.96; // 사례교육·열차정보·공지 등 — 95% 이상
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** 실제 읽은 사람 + 안 읽은 사람 → 목표 비율이 되도록 채운 결과 */
export function fillDemoReads<T extends { sabun: string; name: string }>(
  reportId: string,
  readers: (T & { readAt: string })[],
  nonReaders: T[],
  ratio: number,
  readAt: string,
): { readers: (T & { readAt: string })[]; nonReaders: T[] } {
  const total = readers.length + nonReaders.length;
  const need = Math.round(total * ratio) - readers.length;
  if (need <= 0) return { readers, nonReaders };
  const order = [...nonReaders].sort((a, b) => hash(a.sabun + reportId) - hash(b.sabun + reportId));
  const pick = new Set(order.slice(0, need).map((p) => p.sabun));
  return {
    readers: [...readers, ...nonReaders.filter((p) => pick.has(p.sabun)).map((p) => ({ ...p, readAt }))],
    nonReaders: nonReaders.filter((p) => !pick.has(p.sabun)),
  };
}
