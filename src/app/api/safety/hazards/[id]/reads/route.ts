import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

// ── GET: 읽은 사람 목록 ──
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  }

  const { id: reportId } = await params;

  const { data, error } = await serverSupabase
    .from('hazard_reads')
    .select('user_name, created_at')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { code: 'FETCH_FAILED', message: '조회에 실패했습니다' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: (data ?? []).map((r) => ({
      name: r.user_name || '(알 수 없음)',
      readAt: r.created_at,
    })),
  });
}

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
  const name = (body.name as string | undefined)?.trim() ?? '';
  if (!sabun) {
    return NextResponse.json({ code: 'MISSING_FIELDS' }, { status: 400 });
  }

  // upsert — 중복 시 updated_at만 갱신
  try {
    await serverSupabase
      .from('hazard_reads')
      .upsert(
        { report_id: reportId, user_sabun: sabun, user_name: name, created_at: new Date().toISOString() },
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
