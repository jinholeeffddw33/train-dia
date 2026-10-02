/**
 * 지도승무 한 건 넣기 / 지우기 — 소장·부소장·부장만
 *
 * POST   { date, driverSabun, driverName, trainNo?, formation?, fromStation?, toStation? }
 *        지도요원 = 로그인한 사람. 담당이 아닌 기관사도 넣을 수 있다(그 기관사의 횟수로 센다).
 * DELETE ?id=  넣은 사람 본인, 또는 소장·부소장·개발자
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, auditLog, getClientIP } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import { errorResponse, okJson, internalError, parseBody, ERROR_CODES } from '@/lib/api/response';
import { canViewJido } from '@/features/jido/lib/jidoAccess';
import { isChief, isViceChief } from '@/lib/auth';
import { RIDE_SELECT, toRide, type RideRow } from '@/features/jido/lib/jidoRows';

const PostSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  driverSabun: z.string().trim().regex(/^[0-9A-Za-z]{6,10}$/),
  driverName: z.string().trim().min(1).max(20),
  trainNo: z.string().trim().max(10).optional(),
  formation: z.string().trim().max(10).optional(),
  fromStation: z.string().trim().max(30).optional(),
  toStation: z.string().trim().max(30).optional(),
});

/** 오늘(한국 시간) — 앞날짜 기록을 막는다 */
const todayKST = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canViewJido(auth.sabun, auth.role)) {
    return errorResponse(ERROR_CODES.FORBIDDEN, '지도승무는 소장·부소장·부장님만 넣을 수 있어요');
  }
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '지금은 저장할 수 없어요. 잠시 후 다시 시도해주세요');
  }
  const parsed = await parseBody(req, PostSchema);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;
  if (b.date > todayKST()) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '아직 오지 않은 날짜는 넣을 수 없어요');
  }

  try {
    const { data, error } = await serverSupabase
      .from('jido_rides')
      .insert({
        ride_date: b.date,
        driver_sabun: b.driverSabun,
        driver_name: b.driverName,
        guide_sabun: auth.sabun,
        guide_name: auth.name,
        train_no: b.trainNo ?? '',
        formation: b.formation ?? '',
        from_station: b.fromStation ?? '',
        to_station: b.toStation ?? '',
        source: 'manual',
        created_by: auth.sabun,
        created_by_name: auth.name,
      })
      .select(RIDE_SELECT)
      .single();

    if (error) {
      // 같은 날·같은 기관사·같은 지도요원·같은 열차 — 이미 들어 있다
      if ((error as { code?: string }).code === '23505') {
        return errorResponse(ERROR_CODES.CONFLICT, '이미 넣은 기록이에요');
      }
      return internalError(error, 'jido rides POST');
    }

    await auditLog(auth.sub, auth.name, 'jido_ride_add', {
      targetType: 'jido_rides',
      targetId: String((data as RideRow).id),
      metadata: { driver: b.driverName, date: b.date },
      ip: getClientIP(req),
    });
    return okJson({ ride: toRide(data as RideRow) });
  } catch (e) {
    return internalError(e, 'jido rides POST');
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canViewJido(auth.sabun, auth.role)) {
    return errorResponse(ERROR_CODES.FORBIDDEN, '지울 권한이 없어요');
  }
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '지금은 지울 수 없어요. 잠시 후 다시 시도해주세요');
  }
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '지울 기록을 찾을 수 없어요');
  }

  try {
    const { data: row } = await serverSupabase
      .from('jido_rides')
      .select('id, created_by, guide_sabun, driver_name, ride_date')
      .eq('id', id)
      .maybeSingle();
    if (!row) return errorResponse(ERROR_CODES.NOT_FOUND, '이미 지워졌거나 없는 기록이에요');

    const r = row as { created_by: string | null; guide_sabun: string | null; driver_name: string; ride_date: string };
    const mine = r.created_by === auth.sabun || r.guide_sabun === auth.sabun;
    const boss = auth.role === 'admin' || isChief(auth.sabun) || isViceChief(auth.sabun);
    if (!mine && !boss) {
      return errorResponse(ERROR_CODES.FORBIDDEN, '본인이 넣은 기록만 지울 수 있어요');
    }

    const { error } = await serverSupabase.from('jido_rides').delete().eq('id', id);
    if (error) return internalError(error, 'jido rides DELETE');

    await auditLog(auth.sub, auth.name, 'jido_ride_delete', {
      targetType: 'jido_rides',
      targetId: String(id),
      metadata: { driver: r.driver_name, date: r.ride_date },
      ip: getClientIP(req),
    });
    return okJson({ ok: true });
  } catch (e) {
    return internalError(e, 'jido rides DELETE');
  }
}
