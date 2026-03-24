import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser } from '@/lib/auth';

// ── PATCH: 위험요소 수정 (description, location) ──
export async function PATCH(
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

  const description = (body.description as string | undefined)?.trim();
  const location = (body.location as string | undefined)?.trim() ?? '';
  const name = (body.name as string | undefined)?.trim();
  const sabun = (body.sabun as string | undefined)?.trim();

  if (!description || !name || !sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '설명, 이름, 사번은 필수입니다' },
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

  // 본인 글인지 확인
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

  if (report.created_by !== verified.n) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '본인 글만 수정할 수 있습니다' },
      { status: 403 },
    );
  }

  const { error: updateErr } = await serverSupabase
    .from('hazard_reports')
    .update({ description, location })
    .eq('id', reportId);

  if (updateErr) {
    return NextResponse.json(
      { code: 'UPDATE_FAILED', message: '수정에 실패했습니다', detail: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

// ── DELETE: 위험요소 삭제 (글 + 댓글 + 좋아요 + Storage 사진) ──
export async function DELETE(
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

  // 본인 글인지 확인 + photo_url 가져오기
  const { data: report, error: fetchErr } = await serverSupabase
    .from('hazard_reports')
    .select('created_by, photo_url')
    .eq('id', reportId)
    .single();

  if (fetchErr || !report) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '게시물을 찾을 수 없습니다' },
      { status: 404 },
    );
  }

  if (report.created_by !== verified.n) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '본인 글만 삭제할 수 있습니다' },
      { status: 403 },
    );
  }

  // 1) 댓글 삭제
  await serverSupabase.from('hazard_comments').delete().eq('report_id', reportId);

  // 2) 좋아요 삭제
  await serverSupabase.from('hazard_likes').delete().eq('report_id', reportId);

  // 3) Storage 사진 삭제
  if (report.photo_url) {
    // photo_url: "https://.../storage/v1/object/public/hazard-photos/filename.jpg"
    const parts = report.photo_url.split('/hazard-photos/');
    if (parts.length === 2) {
      const fileName = parts[1];
      await serverSupabase.storage.from('hazard-photos').remove([fileName]);
    }
  }

  // 4) 글 삭제
  const { error: deleteErr } = await serverSupabase
    .from('hazard_reports')
    .delete()
    .eq('id', reportId);

  if (deleteErr) {
    return NextResponse.json(
      { code: 'DELETE_FAILED', message: '삭제에 실패했습니다', detail: deleteErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
