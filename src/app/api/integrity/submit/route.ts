import { NextRequest } from 'next/server';
import { z } from 'zod';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';
import { ERROR_CODES, errorResponse, internalError, okJson, parseBody } from '@/lib/api/response';
import { INTEGRITY_QUESTIONS } from '@/data/integrityQuiz';
import { INTEGRITY_ANSWER_BY_NO } from '@/lib/integrityAnswerKey';
import { integrityPhase } from '@/lib/integrityWindow';

/**
 * POST — 답안 제출. 채점은 여기서만 한다.
 *
 * 응답에 점수를 담지 않는다 — 점수를 돌려주면 그 화면을 캡처해 비교하는 순간
 * 정답이 새고, 시상 전까지 비공개로 하기로 한 뜻이 무너진다.
 * 한 번만 응시: sabun UNIQUE 제약(23505)이 두 번째 제출을 거절한다.
 */

const SubmitSchema = z.object({
  answers: z
    .array(z.number().int().min(1).max(4))
    .length(INTEGRITY_QUESTIONS.length),
});

/** Postgres unique_violation */
const UNIQUE_VIOLATION = '23505';

export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, 'DB 연결 실패');
  }

  const user = await getSessionUser(req);
  if (!user) {
    return errorResponse(ERROR_CODES.UNAUTHORIZED, '로그인이 필요합니다');
  }

  const phase = integrityPhase();
  if (phase !== 'open') {
    return errorResponse(
      ERROR_CODES.FORBIDDEN,
      phase === 'before' ? '아직 응시 기간이 아니에요' : '응시 기간이 끝났어요',
    );
  }

  const parsed = await parseBody(req, SubmitSchema);
  if (!parsed.ok) return parsed.response;
  const { answers } = parsed.data;

  // OX 문항에 3·4번 보기는 없다 — 범위를 문항 종류에 맞춰 한 번 더 본다
  const outOfRange = INTEGRITY_QUESTIONS.findIndex((q, i) => answers[i] > q.options.length);
  if (outOfRange >= 0) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, `${outOfRange + 1}번 답을 확인해주세요`);
  }

  let score = 0;
  INTEGRITY_QUESTIONS.forEach((q, i) => {
    if (INTEGRITY_ANSWER_BY_NO.get(q.no) === answers[i]) score += 1;
  });

  const { error } = await serverSupabase.from('integrity_quiz_submissions').insert({
    sabun: user.sabun,
    name: user.name,
    score,
    total: INTEGRITY_QUESTIONS.length,
    answers,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return errorResponse(ERROR_CODES.CONFLICT, '이미 응시하셨어요. 응시는 한 번만 할 수 있어요');
    }
    return internalError(error, 'integrity/submit:POST', '답안을 내지 못했어요. 잠시 후 다시 시도해주세요');
  }

  return okJson({ submitted: true });
}
