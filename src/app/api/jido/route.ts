/**
 * 지도승무 조회 — 소장·부소장·부장만 (src/features/jido/lib/jidoAccess.ts)
 *
 * GET ?from=YYYY-MM-DD&to=YYYY-MM-DD → { rides, roster }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import { errorResponse, okJson, internalError, parseQuery, ERROR_CODES } from '@/lib/api/response';
import { canViewJido } from '@/features/jido/lib/jidoAccess';
import type { JidoRosterEntry } from '@/features/jido/lib/jidoTypes';
import { RIDE_SELECT, toRide, type RideRow } from '@/features/jido/lib/jidoRows';

const Query = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canViewJido(auth.sabun, auth.role)) {
    return errorResponse(ERROR_CODES.FORBIDDEN, '지도승무는 소장·부소장·부장님만 볼 수 있어요');
  }
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '지금은 불러올 수 없어요. 잠시 후 다시 시도해주세요');
  }
  const q = parseQuery(req.url, Query);
  if (!q.ok) return q.response;

  try {
    // 1,000줄 제한을 넘을 수 있어(분기 300여 건 × 여러 분기) 나눠 받는다
    const rides: RideRow[] = [];
    for (let off = 0; ; off += 1000) {
      const { data, error } = await serverSupabase
        .from('jido_rides')
        .select(RIDE_SELECT)
        .gte('ride_date', q.data.from)
        .lte('ride_date', q.data.to)
        .order('ride_date', { ascending: false })
        .order('id', { ascending: false })
        .range(off, off + 999);
      if (error) return internalError(error, 'jido GET rides');
      rides.push(...((data as RideRow[] | null) ?? []));
      if (!data || data.length < 1000) break;
    }

    const { data: rosterRows, error: rErr } = await serverSupabase
      .from('jido_roster')
      .select('driver_sabun, driver_name, manager_name, focus_reason, focus_from, focus_to');
    if (rErr) return internalError(rErr, 'jido GET roster');

    const roster: JidoRosterEntry[] = ((rosterRows as {
      driver_sabun: string; driver_name: string; manager_name: string | null;
      focus_reason: string | null; focus_from: string | null; focus_to: string | null;
    }[] | null) ?? []).map((r) => ({
      driverSabun: r.driver_sabun,
      driverName: r.driver_name,
      manager: r.manager_name,
      focusReason: r.focus_reason,
      focusFrom: r.focus_from?.slice(0, 10) ?? null,
      focusTo: r.focus_to?.slice(0, 10) ?? null,
    }));

    return okJson({ rides: rides.map(toRide), roster });
  } catch (e) {
    return internalError(e, 'jido GET');
  }
}
