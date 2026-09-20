import { NextRequest } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';
import { isAdmin } from '@/lib/auth';
import { ERROR_CODES, errorResponse, internalError, okJson } from '@/lib/api/response';
import { kstToday } from '@/lib/kstDate';
import { workersOn } from '@/lib/rollcallReaders';

/**
 * 점호 사항 읽음 — 그날 근무자가 출근하면서 읽었는지.
 *
 * POST: 점호 게시판을 연 사람을 그날 읽은 사람으로 남긴다(하루 한 번).
 * GET : 그날 근무자 명단과 맞춰 «읽음 / 안 읽음» 을 준다. **관리자만**.
 *
 * 기준이 되는 «그날 근무자» 는 명부가 아니라 교번이다 — 휴무·비번은 점호에 오지 않는다.
 */

function parseDate(v: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, 'DB 연결 실패');
  }
  const user = await getSessionUser(req);
  if (!user) {
    return errorResponse(ERROR_CODES.UNAUTHORIZED, '로그인이 필요합니다');
  }

  const { error } = await serverSupabase
    .from('rollcall_reads')
    .upsert(
      { read_date: kstToday(), sabun: user.sabun, name: user.name },
      { onConflict: 'read_date,sabun', ignoreDuplicates: true },
    );

  if (error) {
    return internalError(error, 'rollcall/reads:POST', '읽음 기록을 남기지 못했어요');
  }
  return okJson();
}

export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, 'DB 연결 실패');
  }
  const user = await getSessionUser(req);
  if (!user || !isAdmin(user.sabun)) {
    return errorResponse(ERROR_CODES.FORBIDDEN, '읽음 현황은 관리자만 볼 수 있어요');
  }

  const dateStr = new URL(req.url).searchParams.get('date') ?? kstToday();
  const date = parseDate(dateStr);
  if (!date) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '날짜를 확인해주세요');
  }

  const { data, error } = await serverSupabase
    .from('rollcall_reads')
    .select('sabun, name, read_at')
    .eq('read_date', dateStr);

  if (error) {
    return internalError(error, 'rollcall/reads:GET', '읽음 현황을 불러오지 못했어요');
  }

  const readAt = new Map((data ?? []).map((r) => [r.sabun as string, r.read_at as string]));
  const workers = workersOn(date);
  const read = workers
    .filter((w) => readAt.has(w.sabun))
    .map((w) => ({ name: w.name, dia: w.dia, at: readAt.get(w.sabun)! }));
  const unread = workers.filter((w) => !readAt.has(w.sabun)).map((w) => ({ name: w.name, dia: w.dia }));

  // 근무자가 아닌데 본 사람 — 휴무자가 미리 봤을 수도 있어 숫자만 알려 준다
  const workerSabuns = new Set(workers.map((w) => w.sabun));
  const others = (data ?? []).filter((r) => !workerSabuns.has(r.sabun as string)).length;

  return okJson({
    date: dateStr,
    workerCount: workers.length,
    readCount: read.length,
    read: read.sort((a, b) => a.at.localeCompare(b.at)),
    unread: unread.sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    others,
  });
}
