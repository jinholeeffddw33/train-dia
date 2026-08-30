/**
 * 인사 변경 API — 관리자 모드
 *
 * GET    누구나(로그인) — 앱이 시작할 때 읽어서 명부·명단·직급에 덮어씌운다
 * POST   관리자만 — 변경 넣기
 * DELETE 관리자만 — 변경 취소 (?id=)
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
import { P, getRoster } from '@/data/cycle';
import { EXTRA_USERS, INTERN_USERS } from '@/lib/auth';
import type { Duty, RosterChange, StaffRank, WorkType } from '@/data/rosterChanges';

interface DbRow {
  id: number;
  effective_from: string;
  subject_sabun: string;
  subject_name: string;
  work_type: string;
  rank: string | null;
  duty: string | null;
  slot_index: string | null;
  slot_before: string | null;
  vacancy_name: string | null;
  vacancy_sabun: string | null;
  note: string | null;
  created_by_name: string | null;
}

const SELECT =
  'id, effective_from, subject_sabun, subject_name, work_type, rank, duty, slot_index, slot_before, vacancy_name, vacancy_sabun, note, created_by_name';

/** DB 한 줄 → 앱이 쓰는 모양 */
function toChange(row: DbRow): RosterChange {
  return {
    id: row.id,
    from: row.effective_from.slice(0, 10),
    n: row.subject_name,
    s: row.subject_sabun,
    work: row.work_type as WorkType,
    ...(row.rank ? { rank: row.rank as StaffRank } : {}),
    ...(row.duty ? { duty: row.duty as Duty } : {}),
    ...(row.slot_index ? { I: row.slot_index } : {}),
    ...(row.slot_before ? { replaces: row.slot_before } : {}),
    ...(row.vacancy_name ? { vacancyName: row.vacancy_name } : {}),
    ...(row.vacancy_sabun ? { vacancySabun: row.vacancy_sabun } : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(row.created_by_name ? { by: row.created_by_name } : {}),
  };
}

// ── GET: 변경 목록 ──
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

const WORK_TYPES = ['driver', 'office', 'intern', 'leave', 'sick', 'service', 'resign'] as const;
const RANKS = ['chief', 'vice', 'manager', 'deputy', 'gwajang', 'daeri'] as const;
const DUTIES = ['jido_bujang', 'jiwon_gisa', 'unyong_bujang', 'giji_gwanje', 'safety_manager', 'seomu', 'jido_gisa', 'yeongyangsa'] as const;

const PostSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '시행일'),
  /** 바뀌는 사람 */
  n: z.string().trim().min(1).max(20),
  s: z.string().trim().regex(/^[0-9A-Za-z]{6,10}$/, '사번'),
  work: z.enum(WORK_TYPES),
  rank: z.enum(RANKS).optional(),
  /** 내근 업무 — work: 'office' 일 때만 */
  duty: z.enum(DUTIES).optional(),
  /** 기관사가 될 때 = 들어갈 자리 / 기관사에서 빠질 때 = 비울 자리 */
  I: z.string().min(1).max(4).optional(),
  /** 자리를 비울 때 그 자리가 될 결원 번호 (1~99) */
  vacancyNo: z.number().int().min(1).max(99).optional(),
  /**
   * 교번표에 없던 결원 번호를 «새로 만드는» 것임을 분명히 밝힌 경우에만 true.
   * 이게 없으면 교번표에 있는 번호만 받는다 — 실수로 없는 번호가 들어오는 것을 막는다.
   */
  newVacancy: z.boolean().optional(),
  /** 새로 입사한 사람 — 기존 명부에 없는 사번임을 밝힌 경우에만 true */
  newHire: z.boolean().optional(),
  note: z.string().trim().max(200).optional(),
});

/** 결원 번호 → 이름·사번. cycle.ts 의 기존 규칙(결원06 = 9G010906)을 그대로 따른다 */
function vacancyOf(no: number) {
  const nn = String(no).padStart(2, '0');
  return { name: `결원${nn}`, sabun: `9G0109${nn}` };
}

/**
 * 교번표에 실제로 있는 결원 번호.
 * 화면에서도 이 안에서만 고르게 하지만, 서버가 다시 막는다 —
 * 지어낸 번호가 들어오면 교번표에 없는 결원이 앱에만 생긴다.
 */
const REAL_VACANCY_NOS: ReadonlySet<number> = new Set(
  P.map((p) => /^결원(\d+)$/.exec(p.n)).filter(Boolean).map((m) => parseInt(m![1], 10)),
);

// ── POST: 변경 넣기 (관리자만) ──
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

  // 검사는 «지금 명부» 로 한다 — 정적 P 는 발령이 반영되기 전이라, 이미 사람이 들어와
  // 이름이 놀고 있는 결원(예: 결원04)을 아직 쓰이는 것으로 잘못 판정한다
  const roster = getRoster();

  // 기관사·인턴은 직급을 쓰지 않는다 — 남겨 두면 «기관사 부장님» 이 된다
  const rank = body.work === 'driver' || body.work === 'intern' ? null : (body.rank ?? null);
  // 업무는 내근일 때만 의미가 있다 — 기관사·퇴사에 업무가 붙으면 화면이 헷갈린다
  const duty = body.work === 'office' ? (body.duty ?? null) : null;

  if (body.work === 'office' && !duty) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '어떤 업무인지 골라주세요');
  }

  const leavingDriver = body.work !== 'driver' && !!body.I;

  if (body.work === 'driver' && !body.I) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '기관사가 될 자리를 골라주세요');
  }
  if (leavingDriver && body.vacancyNo === undefined) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '비는 자리가 어느 결원이 될지 골라주세요');
  }

  // ① 그 자리가 실제로 있는가 — 없는 순번을 넣으면 아무 일도 안 일어나고 조용히 묻힌다
  let slot: (typeof P)[number] | undefined;
  if (body.I) {
    slot = roster.find((p) => p.I === body.I);
    if (!slot) return errorResponse(ERROR_CODES.BAD_REQUEST, `${body.I}번 자리는 명부에 없어요`);
  }

  // 새로 입사한 사람이라면 그 사번이 정말 처음이어야 한다 — 남의 사번을 넣으면 두 사람이 겹친다
  if (body.newHire) {
    const known =
      roster.find((p) => p.s === body.s)
      ?? EXTRA_USERS.find((u) => u.s === body.s)
      ?? INTERN_USERS.find((u) => u.s === body.s);
    if (known) {
      return errorResponse(ERROR_CODES.CONFLICT, `${body.s}는 이미 ${known.n}의 사번이에요`);
    }
  }

  // ② 기관사는 «실제 교번이 있는 자리» 에만 앉는다 — 이태원(W5)처럼 d='내근' 인 자리는 교번이 아니다
  if (body.work === 'driver' && slot && (!slot.d || slot.d === '내근')) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, `${body.I}번은 교번이 있는 자리가 아니에요`);
  }

  // 기관사가 되는데 그 사번이 이미 다른 자리에 있는가 — 한 사람이 두 교번을 가지면 근무표가 깨진다
  if (body.work === 'driver') {
    const dup = roster.find((p) => p.s === body.s && p.I !== body.I);
    if (dup) {
      return errorResponse(ERROR_CODES.CONFLICT, `${body.s}는 이미 ${dup.I}번 ${dup.n}입니다`);
    }
  }

  // ③ 교번표에 없는 결원 번호는 «새로 만든다» 고 밝혔을 때만 받는다.
  //    그냥 받으면 오타 하나로 교번표에 없는 결원이 앱에만 생긴다.
  if (body.vacancyNo !== undefined && !REAL_VACANCY_NOS.has(body.vacancyNo) && !body.newVacancy) {
    return errorResponse(
      ERROR_CODES.BAD_REQUEST,
      `결원${String(body.vacancyNo).padStart(2, '0')}은 교번표에 없는 번호예요. 새로 만들려면 «새 번호 만들기» 로 넣어주세요`,
    );
  }

  const vacancy = body.vacancyNo !== undefined ? vacancyOf(body.vacancyNo) : null;

  // ④ 결원 번호가 이미 쓰이고 있는가 — 결원06 이 둘이면 어느 자리인지 알 수 없다
  if (leavingDriver && vacancy && roster.some((p) => p.n === vacancy.name && p.I !== body.I)) {
    return errorResponse(ERROR_CODES.CONFLICT, `${vacancy.name}은 이미 쓰이고 있어요`);
  }

  try {
    const { data: existing } = await serverSupabase
      .from('roster_changes')
      .select('id, subject_sabun, subject_name, slot_index, effective_from, vacancy_name')
      .eq('status', 'active');
    const rows = (existing as Pick<DbRow, 'id' | 'subject_sabun' | 'subject_name' | 'slot_index' | 'effective_from' | 'vacancy_name'>[] | null) ?? [];

    if (rows.some((r) => r.subject_sabun === body.s && r.effective_from.slice(0, 10) === body.from)) {
      return errorResponse(ERROR_CODES.CONFLICT, '이 사람은 그 날짜에 이미 예약이 있어요');
    }
    if (body.I && rows.some((r) => r.slot_index === body.I && r.effective_from.slice(0, 10) === body.from)) {
      return errorResponse(ERROR_CODES.CONFLICT, '같은 자리에 같은 시행일 예약이 이미 있어요');
    }
    // 다른 예약이 이미 그 사람을 기관사로 앉혀 두었는데 또 다른 자리에 앉히려는 경우
    if (body.work === 'driver') {
      const dup = rows.find((r) => r.subject_sabun === body.s && r.slot_index && r.slot_index !== body.I);
      if (dup) {
        return errorResponse(ERROR_CODES.CONFLICT, `${body.n}은(는) 이미 ${dup.slot_index}번 자리로 예약돼 있어요`);
      }
    }
    if (leavingDriver && vacancy && rows.some((r) => r.vacancy_name === vacancy.name)) {
      return errorResponse(ERROR_CODES.CONFLICT, `${vacancy.name}은 다른 예약이 이미 쓰고 있어요`);
    }

    // slot_before 는 서버가 채운다 — 화면이 보내온 값을 믿으면 자리를 잘못 짚어도 통과한다
    const { data, error } = await serverSupabase
      .from('roster_changes')
      .insert({
        effective_from: body.from,
        subject_sabun: body.s,
        subject_name: body.n,
        work_type: body.work,
        rank,
        duty,
        slot_index: body.I ?? null,
        slot_before: slot?.n ?? null,
        vacancy_name: leavingDriver && vacancy ? vacancy.name : null,
        vacancy_sabun: leavingDriver && vacancy ? vacancy.sabun : null,
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
      metadata: { name: body.n, sabun: body.s, work: body.work, rank, duty, I: body.I, from: body.from },
      ip: getClientIP(req),
    });

    return okJson({ change: toChange(data as DbRow) });
  } catch (e) {
    return internalError(e, 'roster/changes POST');
  }
}

// ── DELETE: 변경 취소 (관리자만) ──
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
      metadata: { name: row.subject_name, sabun: row.subject_sabun, work: row.work_type, from: row.effective_from },
      ip: getClientIP(req),
    });

    return okJson({ ok: true });
  } catch (e) {
    return internalError(e, 'roster/changes DELETE');
  }
}
