import { NextRequest } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';
import { ERROR_CODES, errorResponse, internalError, okJson } from '@/lib/api/response';
import { INTEGRITY_QUESTIONS } from '@/data/integrityQuiz';
import { INTEGRITY_ANSWER_BY_NO } from '@/lib/integrityAnswerKey';

/**
 * GET — 참여율·점수 전체 보기. **관리자만**.
 *
 * 점수는 대회가 끝날 때까지 본인에게도 안 보이기로 했으므로, 이 문을 여는 곳이
 * 유일한 결과 창구다. 그래서 role='admin'(개발자 계정) 로 못을 박는다.
 * 문항별 정답률까지 같이 낸다 — 어느 대목이 약한지가 곧 자가진단 결과다.
 */
export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, 'DB 연결 실패');
  }

  const user = await getSessionUser(req);
  if (!user || user.role !== 'admin') {
    return errorResponse(ERROR_CODES.FORBIDDEN, '접근 권한이 없습니다');
  }

  const { data, error } = await serverSupabase
    .from('integrity_quiz_submissions')
    .select('sabun, name, score, total, answers, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    return internalError(error, 'integrity/results:GET', '결과를 불러오지 못했어요. 잠시 후 다시 시도해주세요');
  }

  const rows = data ?? [];

  // 참여율의 분모 — 로그인할 수 있는 현재 인원
  const { count: headcount } = await serverSupabase
    .from('driver_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  const perQuestion = INTEGRITY_QUESTIONS.map((q, i) => {
    const correct = rows.filter((r) => {
      const given = Array.isArray(r.answers) ? (r.answers as number[])[i] : undefined;
      return given === INTEGRITY_ANSWER_BY_NO.get(q.no);
    }).length;
    return {
      no: q.no,
      correct,
      rate: rows.length ? Math.round((correct / rows.length) * 100) : 0,
    };
  });

  const sum = rows.reduce((acc, r) => acc + (r.score ?? 0), 0);

  return okJson({
    headcount: headcount ?? 0,
    submitted: rows.length,
    average: rows.length ? Math.round((sum / rows.length) * 10) / 10 : 0,
    total: INTEGRITY_QUESTIONS.length,
    rows: rows.map((r) => ({
      sabun: r.sabun,
      name: r.name,
      score: r.score,
      total: r.total,
      createdAt: r.created_at,
    })),
    perQuestion,
  });
}
