/**
 * 명부 변경 예약 API — 관리자 모드
 *
 * GET    누구나(로그인) — 앱이 시작할 때 읽어서 명부에 덮어씌운다
 * POST   관리자만 — 예약 추가
 * DELETE 관리자만 — 예약 취소 (?id=)
 *
 * 왜 GET 은 전원 공개인가
 *   이 값이 곧 "오늘 누가 그 교번인가"다. 모든 기관사 화면이 이걸 써야 하므로
 *   로그인만 되면 읽을 수 있어야 한다. 쓰기만 관리자로 막는다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, auditLog, getClientIP } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import { errorResponse, okJson, internalError, parseBody, ERROR_CODES } from '@/lib/api/response';
import { P } from '@/data/cycle';
import { EXTRA_USERS, INTERN_USERS } from '@/lib/auth';
import type { RosterChange } from '@/data/rosterChanges';

interface DbRow {
  id: number;
  effective_from: string;
  person_index: string;
  name: string;
  sabun: string;
  replaces: string;
  leaves: string | null;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
}

/** DB 한 줄 → 앱이 쓰는 모양 */
function toChange(row: DbRow): RosterChange & { id: number; by?: string } {
  return {
    id: row.id,
    from: row.effective_from.slice(0, 10),
    I: row.person_index,
    n: row.name,
    s: row.sabun,
    replaces: row.replaces,
    ...(row.leaves ? { leaves: row.leaves as 'intern' | 'extra' } : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(row.created_by_name ? { by: row.created_by_name } : {}),
  };
}

const SELECT = 'id, effective_from, person_index, name, sabun, replaces, leaves, note, created_by_name, created_at';

// ── GET: 예약 목록 ──
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // DB가 없어도 앱은 떠야 한다 — 정적 명부로 동작하면 되므로 빈 목록을 준다
  if (!serverSupabase) return okJson({ changes: [] });

  try {
    const { data, error } = await serverSupabase
      .from('roster_changes')
      .select(SELECT)
      .eq('status', 'active')
      .order('effective_from', { ascending: true })
      .order('id', { ascending: true });

    if (error) return okJson({ changes: [] });
    return okJson({ changes: (data as DbRow[] | null ?? []).map(toChange) });
  } catch {
    return okJson({ changes: [] });
  }
}

const PostSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '시행일'),
  I: z.string().min(1).max(4),
  n: z.string().trim().min(1).max(20),
  s: z.string().trim().regex(/^\d{6,10}$/, '사번'),
  leaves: z.enum(['intern', 'extra']).optional(),
  note: z.string().trim().max(200).optional(),
});

// ── POST: 예약 추가 (관리자만) ──
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'admin') {
    return errorResponse(ERROR_CODES.FORBIDDEN, '관리자만 명부를 고칠 수 있어요');
  }
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '지금은 저장할 수 없어요. 잠시 후 다시 시도해주세요');
  }

  const parsed = await parseBody(req, PostSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // ① 그 자리가 실제로 있는가 — 없는 순번을 넣으면 아무 일도 안 일어나고 조용히 묻힌다
  const slot = P.find((p) => p.I === body.I);
  if (!slot) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, `${body.I}번 자리는 명부에 없어요`);
  }

  // ② 그 사번이 이미 다른 자리에 있는가 — 한 사람이 두 교번을 갖게 되면 근무표가 깨진다
  const dupInBase = P.find((p) => p.s === body.s && p.I !== body.I);
  if (dupInBase) {
    return errorResponse(
      ERROR_CODES.CONFLICT,
      `${body.s}는 이미 ${dupInBase.I}번 ${dupInBase.n}입니다`,
    );
  }

  try {
    // ③ 다른 예약과 사번이 겹치는가 (같은 자리로 옮기는 것은 허용 — 날짜만 바꾸는 경우)
    const { data: existing } = await serverSupabase
      .from('roster_changes')
      .select('id, person_index, name, sabun, effective_from')
      .eq('status', 'active');

    const rows = (existing as { id: number; person_index: string; name: string; sabun: string; effective_from: string }[] | null) ?? [];
    const dupInPending = rows.find((r) => r.sabun === body.s && r.person_index !== body.I);
    if (dupInPending) {
      return errorResponse(
        ERROR_CODES.CONFLICT,
        `${body.s}는 이미 ${dupInPending.person_index}번 자리로 예약돼 있어요`,
      );
    }
    if (rows.some((r) => r.person_index === body.I && r.effective_from.slice(0, 10) === body.from)) {
      return errorResponse(ERROR_CODES.CONFLICT, '같은 자리에 같은 시행일 예약이 이미 있어요');
    }

    // replaces 는 서버가 채운다 — 화면이 보내온 값을 믿으면 자리를 잘못 짚어도 통과한다
    const { data, error } = await serverSupabase
      .from('roster_changes')
      .insert({
        effective_from: body.from,
        person_index: body.I,
        name: body.n,
        sabun: body.s,
        replaces: slot.n,
        leaves: body.leaves ?? guessLeaves(body.s),
        note: body.note ?? null,
        created_by: auth.sabun,
        created_by_name: auth.name,
      })
      .select(SELECT)
      .single();

    if (error || !data) {
      return errorResponse(ERROR_CODES.DB_ERROR, '저장하지 못했어요. 잠시 후 다시 시도해주세요');
    }

    await auditLog(auth.sub, auth.name, 'roster_change_add', {
      targetType: 'roster_changes',
      targetId: String((data as DbRow).id),
      metadata: { I: body.I, name: body.n, sabun: body.s, from: body.from, replaces: slot.n },
      ip: getClientIP(req),
    });

    return okJson({ change: toChange(data as DbRow) });
  } catch (e) {
    return internalError(e, 'roster/changes POST');
  }
}

/** 인턴·내근 명단에 있는 사번이면 시행일에 그 명단에서 빼야 한다 — 손으로 고르지 않게 자동 판별 */
function guessLeaves(sabun: string): 'intern' | 'extra' | null {
  if (INTERN_USERS.some((u) => u.s === sabun)) return 'intern';
  if (EXTRA_USERS.some((u) => u.s === sabun)) return 'extra';
  return null;
}

// ── DELETE: 예약 취소 (관리자만) ──
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== 'admin') {
    return errorResponse(ERROR_CODES.FORBIDDEN, '관리자만 명부를 고칠 수 있어요');
  }
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '지금은 지울 수 없어요. 잠시 후 다시 시도해주세요');
  }

  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '지울 예약을 찾을 수 없어요');
  }

  try {
    // 실제로 지우지 않고 표시만 바꾼다 — 잘못 지웠을 때 되살릴 수 있어야 한다
    const { data, error } = await serverSupabase
      .from('roster_changes')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'active')
      .select(SELECT)
      .single();

    if (error || !data) {
      return errorResponse(ERROR_CODES.NOT_FOUND, '이미 지워졌거나 없는 예약이에요');
    }

    const row = data as DbRow;
    await auditLog(auth.sub, auth.name, 'roster_change_delete', {
      targetType: 'roster_changes',
      targetId: String(id),
      metadata: { I: row.person_index, name: row.name, sabun: row.sabun, from: row.effective_from },
      ip: getClientIP(req),
    });

    return okJson({ ok: true });
  } catch (e) {
    return internalError(e, 'roster/changes DELETE');
  }
}
