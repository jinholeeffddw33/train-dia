import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

// ── POST: 조회수 증가 ──
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' },
      { status: 500 },
    );
  }

  const { id: reportId } = await params;

  // view_count를 1 증가 (RPC 없이 단순 increment)
  const { data: current, error: fetchErr } = await serverSupabase
    .from('hazard_reports')
    .select('view_count')
    .eq('id', reportId)
    .single();

  if (fetchErr || !current) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다' },
      { status: 404 },
    );
  }

  const newCount = (current.view_count ?? 0) + 1;

  const { error: updateErr } = await serverSupabase
    .from('hazard_reports')
    .update({ view_count: newCount })
    .eq('id', reportId);

  if (updateErr) {
    return NextResponse.json(
      { code: 'UPDATE_FAILED', message: '조회수 업데이트에 실패했습니다' },
      { status: 500 },
    );
  }

  return NextResponse.json({ viewCount: newCount });
}
