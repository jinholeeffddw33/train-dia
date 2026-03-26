import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

/** GET /api/safety/hazards/counts — 카테고리별 총 개수 + ID 목록 */
export async function GET() {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' },
      { status: 500 },
    );
  }

  // 모든 report의 id + category 조회 (가벼움)
  const { data, error } = await serverSupabase
    .from('hazard_reports')
    .select('id, category')
    .order('created_at', { ascending: false });

  if (error) {
    // category 컬럼 없으면 폴백
    if (error.message?.includes('category')) {
      const { data: fallback } = await serverSupabase
        .from('hazard_reports')
        .select('id')
        .order('created_at', { ascending: false });

      return NextResponse.json({
        data: {
          hazard:  { count: fallback?.length ?? 0, ids: (fallback ?? []).map((r: { id: string }) => r.id) },
          action:  { count: 0, ids: [] },
          inspect: { count: 0, ids: [] },
        },
      });
    }

    return NextResponse.json(
      { code: 'FETCH_FAILED', message: '조회 실패', detail: error.message },
      { status: 500 },
    );
  }

  const grouped: Record<string, { count: number; ids: string[] }> = {
    hazard:  { count: 0, ids: [] },
    action:  { count: 0, ids: [] },
    inspect: { count: 0, ids: [] },
  };

  for (const r of (data ?? [])) {
    const cat = (r.category as string) || 'hazard';
    if (grouped[cat]) {
      grouped[cat].count++;
      grouped[cat].ids.push(r.id);
    }
  }

  return NextResponse.json({ data: grouped });
}
