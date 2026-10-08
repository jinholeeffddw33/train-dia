/**
 * 등급별 명단 — 관리자(소장·부소장·관리자 계정)만. 내 정보 → «등급별 명단».
 *
 * GET → StageRoster (167명의 두 기준 단계·건수). 이름과 민원 단계가 함께 나가는 개인정보라
 * 판정은 내 정보와 같은 함수(canViewOthersInfo)로 여기서 한다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import { errorResponse, okJson, internalError, ERROR_CODES } from '@/lib/api/response';
import { canViewOthersInfo } from '@/features/myinfo/lib/myInfoAccess';
import type { Stage } from '@/features/myinfo/lib/complaintStages';
import type { StageRoster } from '@/features/myinfo/lib/myInfoTypes';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canViewOthersInfo(auth.sabun, auth.role)) {
    return errorResponse(ERROR_CODES.FORBIDDEN, '등급별 명단은 소장·부소장·관리자만 볼 수 있어요');
  }
  if (!serverSupabase) return errorResponse(ERROR_CODES.DB_UNAVAILABLE, '지금은 불러올 수 없어요. 잠시 후 다시 시도해주세요');

  try {
    const { data, error } = await serverSupabase
      .from('complaint_people')
      .select('sabun, name, door_events, all_events, praise, injury, door_stage, all_stage, mgmt, period_from, period_to');
    if (error) return internalError(error, 'my-info/roster GET');
    const rows = (data as {
      sabun: string; name: string; door_events: number; all_events: number; praise: number; injury: number;
      door_stage: Stage; all_stage: Stage; mgmt: string; period_from: string; period_to: string;
    }[] | null) ?? [];
    const out: StageRoster = {
      periodFrom: rows[0]?.period_from ?? '',
      periodTo: rows[0]?.period_to ?? '',
      people: rows.map((r) => ({
        sabun: r.sabun, name: r.name, doorEvents: r.door_events, allEvents: r.all_events, praise: r.praise,
        injury: r.injury, doorStage: r.door_stage, allStage: r.all_stage, mgmt: r.mgmt,
      })),
    };
    return okJson(out, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return internalError(e, 'my-info/roster GET');
  }
}
