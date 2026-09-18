import { NextRequest } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';
import { ERROR_CODES, errorResponse, internalError, okJson } from '@/lib/api/response';
import { integrityPhase } from '@/lib/integrityWindow';

/**
 * GET — 나는 이미 응시했는가.
 *
 * 점수는 돌려주지 않는다. 시상(9월 28일) 전까지 점수도 정답도 응시자에게 공개하지 않기로 했다.
 * 여기서 주는 것은 «냈다/안 냈다» 와 낸 시각뿐이다.
 */
export async function GET(req: NextRequest) {
  const phase = integrityPhase();

  const user = await getSessionUser(req);
  if (!user) {
    return errorResponse(ERROR_CODES.UNAUTHORIZED, '로그인이 필요합니다');
  }

  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, 'DB 연결 실패');
  }

  const { data, error } = await serverSupabase
    .from('integrity_quiz_submissions')
    .select('created_at')
    .eq('sabun', user.sabun)
    .maybeSingle();

  if (error) {
    return internalError(error, 'integrity/status:GET', '응시 여부를 확인하지 못했어요. 잠시 후 다시 시도해주세요');
  }

  return okJson({
    phase,
    submitted: !!data,
    submittedAt: data?.created_at ?? null,
    isAdmin: user.role === 'admin',
  });
}
