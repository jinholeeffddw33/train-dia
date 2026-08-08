import { NextRequest } from 'next/server';
import { z } from 'zod';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';
import { ERROR_CODES, errorResponse, internalError, okJson, parseBody } from '@/lib/api/response';

const LEVEL_ADMIN_SABUN = '21711694'; // 이현구

/**
 * 응답 봉투 SSOT 적용 1호 (API-ENVELOPE-001, 2026-08-09).
 * 소비처: QuizSystem.tsx(POST, 응답 본문 미사용) · LevelRecordsOverlay.tsx(GET, r.ok 후 배열).
 * 응답 JSON 모양은 그대로다 — 에러 `{code,message}` / POST 성공 `{ok:true}` / GET 성공 배열.
 *
 * 이관하면서 실제 결함 3건을 함께 고쳤다:
 *  1. DB 에러 원문(error.message)을 클라이언트로 그대로 흘리던 것 → internalError 로 마스킹.
 *     Supabase 에러는 테이블/컬럼명·제약조건을 담고 있어 스키마가 새는 경로였다.
 *  2. `await req.json()` 에 try/catch 가 없어 잘못된 JSON 이면 500 스택이 그대로 노출 → parseBody.
 *  3. 필수 항목을 손으로 하나씩 확인하던 것 → zod 스키마 하나로.
 */

const RecordSchema = z.object({
  levelId: z.union([z.string(), z.number()]),
  levelName: z.string().min(1),
  score: z.number(),
  passed: z.boolean(),
});

/** POST — 등급 도전 결과 기록 */
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, 'DB 연결 실패');
  }

  const user = await getSessionUser(req);
  if (!user) {
    return errorResponse(ERROR_CODES.UNAUTHORIZED, '로그인이 필요합니다');
  }

  const parsed = await parseBody(req, RecordSchema);
  if (!parsed.ok) return parsed.response;
  const { levelId, levelName, score, passed } = parsed.data;

  const { error } = await serverSupabase.from('level_records').insert({
    sabun: user.sabun,
    name: user.name,
    level_id: levelId,
    level_name: levelName,
    score,
    passed,
  });

  if (error) {
    return internalError(error, 'edu/level-records:POST', '기록을 저장하지 못했어요. 잠시 후 다시 시도해주세요');
  }

  return okJson();
}

/** GET — 관리자(이현구)만 전체 기록 조회 */
export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, 'DB 연결 실패');
  }

  const user = await getSessionUser(req);
  if (!user || user.sabun !== LEVEL_ADMIN_SABUN) {
    return errorResponse(ERROR_CODES.FORBIDDEN, '접근 권한이 없습니다');
  }

  const { data, error } = await serverSupabase
    .from('level_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return internalError(error, 'edu/level-records:GET', '기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요');
  }

  return okJson(data ?? []);
}
