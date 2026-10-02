/**
 * 지도승무 실적 엑셀 올리기 — 소장·부소장·부장만
 *
 * 엑셀은 화면(브라우저)이 읽어서 줄 단위로 보낸다(parseJidoExcel.ts).
 * 같은 기록(날짜·기관사·지도요원·열차)은 건너뛰므로, 분기 중간중간 «그때까지의 파일»을
 * 몇 번이고 다시 올려도 겹치지 않는다. 담당부장·중점관리 지정이 들어 있으면 그것도 고친다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, auditLog, getClientIP } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import { errorResponse, okJson, internalError, parseBody, ERROR_CODES } from '@/lib/api/response';
import { canViewJido } from '@/features/jido/lib/jidoAccess';

const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sabun = z.string().trim().regex(/^[0-9A-Za-z]{6,10}$/);

const Body = z.object({
  rides: z.array(z.object({
    date: d,
    driverSabun: sabun,
    driverName: z.string().trim().max(20),
    guideSabun: sabun.nullable(),
    guideName: z.string().trim().min(1).max(20),
    trainNo: z.string().trim().max(10),
    formation: z.string().trim().max(10),
    fromStation: z.string().trim().max(30),
    toStation: z.string().trim().max(30),
  })).max(5000),
  roster: z.array(z.object({
    driverSabun: sabun,
    driverName: z.string().trim().max(20),
    manager: z.string().trim().max(20).optional(),
    focusReason: z.string().trim().max(60).optional(),
    focusFrom: d.optional(),
    focusTo: d.optional(),
  })).max(2000),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canViewJido(auth.sabun, auth.role)) {
    return errorResponse(ERROR_CODES.FORBIDDEN, '지도승무 자료는 소장·부소장·부장님만 올릴 수 있어요');
  }
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '지금은 저장할 수 없어요. 잠시 후 다시 시도해주세요');
  }
  const parsed = await parseBody(req, Body);
  if (!parsed.ok) return parsed.response;
  const { rides, roster } = parsed.data;
  if (rides.length === 0 && roster.length === 0) {
    return errorResponse(ERROR_CODES.BAD_REQUEST, '파일에서 지도승무 기록을 찾지 못했어요');
  }

  try {
    // ① 기록 — 이미 있는 것은 건너뛴다
    let added = 0;
    for (let i = 0; i < rides.length; i += 500) {
      const chunk = rides.slice(i, i + 500).map((r) => ({
        ride_date: r.date,
        driver_sabun: r.driverSabun,
        driver_name: r.driverName,
        guide_sabun: r.guideSabun,
        guide_name: r.guideName,
        train_no: r.trainNo,
        formation: r.formation,
        from_station: r.fromStation,
        to_station: r.toStation,
        source: 'upload' as const,
        created_by: auth.sabun,
        created_by_name: auth.name,
      }));
      const { data, error } = await serverSupabase
        .from('jido_rides')
        .upsert(chunk, { onConflict: 'ride_date,driver_sabun,guide_name,train_no', ignoreDuplicates: true })
        .select('id');
      if (error) return internalError(error, 'jido upload rides');
      added += data?.length ?? 0;
    }

    // ② 담당부장 / 중점관리 — 들어 있는 칸만 고친다(빈 칸으로 남의 값을 지우지 않게 따로 올린다)
    const now = new Date().toISOString();
    const managers = roster.filter((r) => r.manager).map((r) => ({
      driver_sabun: r.driverSabun, driver_name: r.driverName, manager_name: r.manager!,
      updated_by_name: auth.name, updated_at: now,
    }));
    const focus = roster.filter((r) => r.focusFrom && r.focusTo).map((r) => ({
      driver_sabun: r.driverSabun, driver_name: r.driverName,
      focus_reason: r.focusReason ?? '중점관리', focus_from: r.focusFrom!, focus_to: r.focusTo!,
      updated_by_name: auth.name, updated_at: now,
    }));
    for (const rows of [managers, focus]) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await serverSupabase.from('jido_roster').upsert(rows.slice(i, i + 500), { onConflict: 'driver_sabun' });
        if (error) return internalError(error, 'jido upload roster');
      }
    }

    await auditLog(auth.sub, auth.name, 'jido_upload', {
      targetType: 'jido_rides',
      metadata: { rides: rides.length, added, managers: managers.length, focus: focus.length },
      ip: getClientIP(req),
    });
    return okJson({ received: rides.length, added, skipped: rides.length - added, managers: managers.length, focus: focus.length });
  } catch (e) {
    return internalError(e, 'jido upload');
  }
}
