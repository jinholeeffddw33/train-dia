import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser, isAdmin } from '@/lib/auth';

/** 위험개소 조치완료 토글 (POST) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' },
      { status: 500 },
    );
  }

  const { id: reportId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_JSON', message: '잘못된 요청입니다' },
      { status: 400 },
    );
  }

  const name = (body.name as string | undefined)?.trim();
  const sabun = (body.sabun as string | undefined)?.trim();
  const resolved = body.resolved === true;

  if (!name || !sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '이름, 사번은 필수입니다' },
      { status: 400 },
    );
  }

  const verified = verifyUser(name, sabun);
  if (!verified) {
    return NextResponse.json(
      { code: 'AUTH_FAILED', message: '이름과 사번이 일치하지 않습니다' },
      { status: 403 },
    );
  }

  // 작성자 또는 관리자만 조치완료 토글 가능
  const { data: report, error: fetchErr } = await serverSupabase
    .from('hazard_reports')
    .select('created_by')
    .eq('id', reportId)
    .single();

  if (fetchErr || !report) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다' },
      { status: 404 },
    );
  }

  if (report.created_by !== verified.n && !isAdmin(sabun)) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '작성자 또는 관리자만 조치완료를 표시할 수 있습니다' },
      { status: 403 },
    );
  }

  const updateData: Record<string, unknown> = {
    resolved,
    resolved_at: resolved ? new Date().toISOString() : null,
    resolved_by: resolved ? verified.n : null,
  };

  const { error: updateErr } = await serverSupabase
    .from('hazard_reports')
    .update(updateData)
    .eq('id', reportId);

  if (updateErr) {
    return NextResponse.json(
      { code: 'UPDATE_FAILED', message: '조치완료 처리에 실패했습니다', detail: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    resolved,
    resolvedAt: updateData.resolved_at,
    resolvedBy: updateData.resolved_by,
  });
}
