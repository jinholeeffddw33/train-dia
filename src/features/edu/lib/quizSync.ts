/**
 * 교육 시험 점수 → 서버 (/api/edu/quiz-results). 실패해도 시험 화면은 아무 영향이 없다(폰 기록이 원본).
 *
 * - 시험이 끝날 때 그 한 건을 보낸다(useEduStore.addQuizRecord).
 * - 그 폰에 쌓여 있던 지난 기록은 교육 홈·내 정보를 열 때 한 번 올린다. 어디까지 올렸는지는
 *   사번별 표시(마지막으로 올린 시각)로 기억한다 — 서버도 같은 시험을 하나로 두므로 겹쳐 보내도 괜찮다.
 */
import type { QuizRecord } from '../hooks/useEduStore';
import { useAuthStore } from '@/stores/auth';

const MARK = 'train-dia-edu-sync-v1:';

function toPayload(r: QuizRecord) {
  return {
    mode: r.mode,
    ...(r.chapterId ? { chapterId: r.chapterId } : {}),
    score: r.score, total: Math.max(1, r.total), percent: Math.max(0, Math.min(100, Math.round(r.percent))),
    solvedAt: new Date(r.solvedAt || r.date).toISOString(),
  };
}

async function post(records: QuizRecord[]): Promise<boolean> {
  if (records.length === 0) return true;
  try {
    const res = await fetch('/api/edu/quiz-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: records.map(toPayload) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 방금 끝난 시험 한 건 */
export function sendQuizRecord(record: QuizRecord) {
  if (!useAuthStore.getState().user?.sabun) return;
  void post([record]);
}

/** 이 폰의 지난 기록 중 아직 안 올린 것 */
export async function backfillQuizHistory(history: QuizRecord[]) {
  const sabun = useAuthStore.getState().user?.sabun;
  if (!sabun || history.length === 0) return;
  let last = '';
  try { last = localStorage.getItem(MARK + sabun) ?? ''; } catch { /* 저장소 막힘 — 전부 다시 보낸다 */ }
  const pending = history.filter((r) => (r.solvedAt || r.date) > last);
  for (let i = 0; i < pending.length; i += 500) {
    const chunk = pending.slice(i, i + 500);
    if (!(await post(chunk))) return;
    const newest = chunk.reduce((m, r) => ((r.solvedAt || r.date) > m ? (r.solvedAt || r.date) : m), last);
    try { localStorage.setItem(MARK + sabun, newest); } catch { /* 다음에 다시 */ }
    last = newest;
  }
}
