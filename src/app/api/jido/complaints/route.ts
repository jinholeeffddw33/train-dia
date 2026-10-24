/**
 * 지도승무 › 담당 기관사 출입문 민원 상태
 *
 * GET → JidoComplaintResponse
 *   - 지도승무를 못 보는 사람(기관사 등)은 403 (jidoAccess.canViewJido)
 *   - 지도승무를 보는 사람(소장·부소장·부장 전원·관리자) → 전체 기관사 (jidoComplaint.canViewAllComplaints)
 *   - (판정이 다시 좁아지면) 그 밖의 사람 → jido_roster 에서 본인이 담당부장인 기관사만
 * 이름과 민원 단계가 함께 나가는 개인정보라 범위는 반드시 여기(서버)서 자른다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import { errorResponse, okJson, internalError, ERROR_CODES } from '@/lib/api/response';
import { canViewJido } from '@/features/jido/lib/jidoAccess';
import { canViewAllComplaints, type JidoComplaintResponse } from '@/features/jido/lib/jidoComplaint';
import type { Stage } from '@/features/myinfo/lib/complaintStages';

interface Row {
  sabun: string;
  door_stage: Stage;
  all_stage: Stage;
  door_events: number;
  all_events: number;
  praise: number;
  injury: number;
  mgmt: string;
  detail: { types?: Record<string, number>; mainStations?: string; mainTimes?: string; otherComplaints?: string } | null;
  period_from: string;
  period_to: string;
}

const SELECT = 'sabun, door_stage, all_stage, door_events, all_events, praise, injury, mgmt, detail, period_from, period_to';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canViewJido(auth.sabun, auth.role)) {
    return errorResponse(ERROR_CODES.FORBIDDEN, '지도승무는 소장·부소장·부장님만 볼 수 있어요');
  }
  if (!serverSupabase) {
    return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '지금은 불러올 수 없어요. 잠시 후 다시 시도해주세요');
  }

  try {
    const all = canViewAllComplaints(auth.sabun, auth.role);
    let rows: Row[] = [];
    if (all) {
      const { data, error } = await serverSupabase.from('complaint_people').select(SELECT);
      if (error) return internalError(error, 'jido/complaints GET all');
      rows = (data as Row[] | null) ?? [];
    } else {
      const name = (auth.name ?? '').trim();
      const { data: mine, error: rErr } = name
        ? await serverSupabase.from('jido_roster').select('driver_sabun').eq('manager_name', name)
        : { data: [], error: null };
      if (rErr) return internalError(rErr, 'jido/complaints GET roster');
      const sabuns = ((mine as { driver_sabun: string }[] | null) ?? []).map((r) => r.driver_sabun);
      if (sabuns.length > 0) {
        const { data, error } = await serverSupabase.from('complaint_people').select(SELECT).in('sabun', sabuns);
        if (error) return internalError(error, 'jido/complaints GET mine');
        rows = (data as Row[] | null) ?? [];
      }
    }

    const out: JidoComplaintResponse = {
      scope: all ? 'all' : 'mine',
      periodFrom: rows[0]?.period_from ?? '',
      periodTo: rows[0]?.period_to ?? '',
      people: rows.map((r) => ({
        sabun: r.sabun,
        doorStage: r.door_stage,
        allStage: r.all_stage,
        doorEvents: r.door_events,
        allEvents: r.all_events,
        praise: r.praise,
        injury: r.injury,
        mgmt: r.mgmt,
        types: r.detail?.types ?? {},
        mainStations: r.detail?.mainStations ?? '',
        mainTimes: r.detail?.mainTimes ?? '',
        otherComplaints: r.detail?.otherComplaints ?? '',
      })),
    };
    return okJson(out, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return internalError(e, 'jido/complaints GET');
  }
}
