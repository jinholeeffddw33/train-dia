import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser } from '@/lib/auth';

// ── POST: 댓글 등록 ──
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

  const comment = (body.comment as string | undefined)?.trim();
  const name = (body.name as string | undefined)?.trim();
  const sabun = (body.sabun as string | undefined)?.trim();

  if (!comment || !name || !sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '댓글, 이름, 사번은 필수입니다' },
      { status: 400 },
    );
  }

  if (comment.length > 500) {
    return NextResponse.json(
      { code: 'COMMENT_TOO_LONG', message: '댓글은 500자 이하로 작성해주세요' },
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

  const { data, error } = await serverSupabase
    .from('hazard_comments')
    .insert({ report_id: reportId, comment, created_by: verified.n })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json(
      { code: 'INSERT_FAILED', message: '댓글 등록에 실패했습니다', detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id });
}

// ── PATCH: 댓글 수정 ──
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

  // reportId는 URL 경로용 (일관성)
  await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_JSON', message: '잘못된 요청입니다' },
      { status: 400 },
    );
  }

  const commentId = (body.commentId as string | undefined)?.trim();
  const comment = (body.comment as string | undefined)?.trim();
  const name = (body.name as string | undefined)?.trim();
  const sabun = (body.sabun as string | undefined)?.trim();

  if (!commentId || !comment || !name || !sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '댓글ID, 댓글, 이름, 사번은 필수입니다' },
      { status: 400 },
    );
  }

  if (comment.length > 500) {
    return NextResponse.json(
      { code: 'COMMENT_TOO_LONG', message: '댓글은 500자 이하로 작성해주세요' },
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

  // 본인 댓글인지 확인
  const { data: existing, error: fetchErr } = await serverSupabase
    .from('hazard_comments')
    .select('created_by')
    .eq('id', commentId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '댓글을 찾을 수 없습니다' },
      { status: 404 },
    );
  }

  if (existing.created_by !== verified.n) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '본인 댓글만 수정할 수 있습니다' },
      { status: 403 },
    );
  }

  const { error: updateErr } = await serverSupabase
    .from('hazard_comments')
    .update({ comment })
    .eq('id', commentId);

  if (updateErr) {
    return NextResponse.json(
      { code: 'UPDATE_FAILED', message: '댓글 수정에 실패했습니다', detail: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}

// ── DELETE: 댓글 삭제 ──
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

  await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_JSON', message: '잘못된 요청입니다' },
      { status: 400 },
    );
  }

  const commentId = (body.commentId as string | undefined)?.trim();
  const name = (body.name as string | undefined)?.trim();
  const sabun = (body.sabun as string | undefined)?.trim();

  if (!commentId || !name || !sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '댓글ID, 이름, 사번은 필수입니다' },
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

  // 본인 댓글인지 확인
  const { data: existing, error: fetchErr } = await serverSupabase
    .from('hazard_comments')
    .select('created_by')
    .eq('id', commentId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '댓글을 찾을 수 없습니다' },
      { status: 404 },
    );
  }

  if (existing.created_by !== verified.n) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '본인 댓글만 삭제할 수 있습니다' },
      { status: 403 },
    );
  }

  const { error: deleteErr } = await serverSupabase
    .from('hazard_comments')
    .delete()
    .eq('id', commentId);

  if (deleteErr) {
    return NextResponse.json(
      { code: 'DELETE_FAILED', message: '댓글 삭제에 실패했습니다', detail: deleteErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
