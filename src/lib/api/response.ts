/**
 * API 응답 봉투 SSOT (API-ENVELOPE-001) — ZINOSB lib/api/response 적응 이식 2026-08-09
 *
 * ★ 새 형태를 발명하지 않았다. train-dia 의 **기존 지배적 컨벤션을 그대로 채택**한다.
 *   실측(2026-08-09, API 39개 / raw NextResponse.json 340건):
 *     - 에러: `{ code: 'UPPER_SNAKE', message: '한국어 설명' }` + status  → 123건, 이미 통일돼 있었다
 *     - 성공: `{ success: true }` 16건 / `{ ok: true }` 11건 / 생 데이터 다수 → 갈려 있다
 *
 *   그래서 errorResponse 는 기존 123건과 **바이트 단위로 같은 모양**을 낸다.
 *   기존 라우트를 이 헬퍼로 바꿔도 응답 JSON 이 1글자도 안 바뀐다 = 프론트 소비처가 안 깨진다.
 *
 * ⚠️ 성공 응답의 모양은 **바꾸지 않는다**. 봉투를 씌우는 순간 그 API 를 읽는 화면이
 *   조용히 빈다(진호 2026-08-09 지적). okJson 은 얇은 통과 래퍼일 뿐이고,
 *   통일의 가치는 "새 모양"이 아니라 **에러 코드/로깅/검증의 단일 경로**에 있다.
 *
 * 관련: docs/rules/registry.json API-ENVELOPE-001 · 가드 scripts/check-response-envelope.mjs
 */
import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

/** 표준 에러 코드 — 실측된 기존 사용값에서 뽑았다. 새 코드는 여기 추가하고 쓸 것. */
export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE: 'UNPROCESSABLE',
  RATE_LIMITED: 'RATE_LIMITED',
  DB_UNAVAILABLE: 'DB_UNAVAILABLE',
  DB_ERROR: 'DB_ERROR',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  TIMEOUT: 'TIMEOUT',
  INTERNAL: 'INTERNAL',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | (string & {})

/** 코드별 기본 status — 호출부에서 매번 숫자를 고르지 않게 한다(같은 뜻에 다른 status 가 붙던 문제). */
const DEFAULT_STATUS: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  DB_UNAVAILABLE: 503,
  DB_ERROR: 500,
  UPSTREAM_ERROR: 502,
  TIMEOUT: 504,
  INTERNAL: 500,
}

/**
 * 에러 응답 — `{ code, message }` (+ extra). 기존 123건과 동일한 모양.
 * status 를 생략하면 코드에 맞는 기본값이 붙는다.
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  status?: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    { code, message, ...(extra ?? {}) },
    { status: status ?? DEFAULT_STATUS[code] ?? 500 },
  )
}

/**
 * 성공 응답 — **모양을 바꾸지 않는 통과 래퍼**.
 * data 를 주면 그대로 내보내고, 없으면 `{ ok: true }`.
 * (기존 `{ success: true }` 를 쓰던 자리는 `okJson({ success: true })` 로 그대로 옮긴다)
 */
export function okJson<T>(data?: T, init?: ResponseInit) {
  return NextResponse.json(data ?? ({ ok: true } as unknown as T), init)
}

/**
 * 서버 예외를 안전하게 에러 응답으로 바꾼다.
 * ★ 원문 메시지를 사용자에게 그대로 흘리지 않는다 — DB 스키마·경로·쿼리가 새는 경로였다.
 *   상세는 서버 로그로만 남기고, 클라이언트에는 코드와 사람이 읽을 문장만 준다.
 */
export function internalError(err: unknown, where: string, userMessage = '처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요') {
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  console.error(`[api:${where}]`, detail)
  return errorResponse(ERROR_CODES.INTERNAL, userMessage, 500)
}

/**
 * 요청 본문 검증 — 손으로 필드를 하나씩 확인하던 것을 스키마 하나로.
 * 실패하면 그대로 반환할 수 있는 NextResponse 를 돌려준다.
 *
 * 사용:
 *   const parsed = await parseBody(req, Schema)
 *   if (!parsed.ok) return parsed.response
 *   const { sabun } = parsed.data
 */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { ok: false, response: errorResponse(ERROR_CODES.BAD_REQUEST, '요청 형식이 올바르지 않아요') }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    // 첫 번째 문제만 사람 말로 — 필드 목록을 통째로 흘리지 않는다
    const first = result.error.issues[0]
    const field = first?.path?.join('.') || '입력값'
    return {
      ok: false,
      response: errorResponse(ERROR_CODES.BAD_REQUEST, `${field}을(를) 확인해주세요`, 400),
    }
  }
  return { ok: true, data: result.data }
}

/** 쿼리스트링 검증 — parseBody 의 GET 판. */
export function parseQuery<T>(
  url: string,
  schema: ZodType<T>,
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const params = Object.fromEntries(new URL(url).searchParams.entries())
  const result = schema.safeParse(params)
  if (!result.success) {
    const first = result.error.issues[0]
    const field = first?.path?.join('.') || '요청 값'
    return { ok: false, response: errorResponse(ERROR_CODES.BAD_REQUEST, `${field}을(를) 확인해주세요`, 400) }
  }
  return { ok: true, data: result.data }
}
