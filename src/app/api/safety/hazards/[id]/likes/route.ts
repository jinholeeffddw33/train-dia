import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser } from '@/lib/auth';

// ── POST: 좋아요 토글 ──
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

  // 기존 좋아요 확인
  const { data: existing } = await serverSupabase
    .from('hazard_likes')
    .select('id')
    .eq('report_id', reportId)
    .eq('user_sabun', sabun)
    .maybeSingle();

  let liked: boolean;

  if (existing) {
    // 좋아요 취소
    const { error } = await serverSupabase
      .from('hazard_likes')
      .delete()
      .eq('id', existing.id);

    if (error) {
      return NextResponse.json(
        { code: 'DELETE_FAILED', message: '좋아요 취소에 실패했습니다', detail: error.message },
        { status: 500 },
      );
    }
    liked = false;
  } else {
    // 좋아요 추가
    const { error } = await serverSupabase
      .from('hazard_likes')
      .insert({ report_id: reportId, user_sabun: sabun });

    if (error) {
      return NextResponse.json(
        { code: 'INSERT_FAILED', message: '좋아요에 실패했습니다', detail: error.message },
        { status: 500 },
      );
    }
    liked = true;
  }

  // 현재 좋아요 수 조회
  const { count } = await serverSupabase
    .from('hazard_likes')
    .select('id', { count: 'exact', head: true })
    .eq('report_id', reportId);

  return NextResponse.json({ liked, likeCount: count ?? 0 });
}
