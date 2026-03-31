import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

// ── POST: 조회 기록 (upsert) ──
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  }

  const { id: reportId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  const sabun = (body.sabun as string | undefined)?.trim();
  if (!sabun) {
    return NextResponse.json({ code: 'MISSING_FIELDS' }, { status: 400 });
  }

  // upsert — 중복 시 무시 (unique: report_id + user_sabun)
  try {
    await serverSupabase
      .from('hazard_reads')
      .upsert(
        { report_id: reportId, user_sabun: sabun },
        { onConflict: 'report_id,user_sabun' },
      );
  } catch {
    // 테이블 없으면 무시
  }

  // 현재 조회수 반환
  const { count } = await serverSupabase
    .from('hazard_reads')
    .select('*', { count: 'exact', head: true })
    .eq('report_id', reportId);

  return NextResponse.json({ readCount: count ?? 0 });
}
