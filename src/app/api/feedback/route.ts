import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';

// ── POST: 익명 제보 제출 (인증 불필요, anonymous_id 필수) ──
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'UNAVAILABLE', message: '서비스를 일시적으로 사용할 수 없습니다' }, { status: 503 });
  }

  let content: string;
  let anonymousId: string;
  try {
    const body = await req.json();
    content = (body.content ?? '').trim();
    anonymousId = (body.anonymous_id ?? '').trim();
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '잘못된 요청입니다' }, { status: 400 });
  }

  if (!content || content.length < 5) {
    return NextResponse.json({ code: 'TOO_SHORT', message: '5자 이상 입력해주세요' }, { status: 400 });
  }
  if (content.length > 1000) {
    return NextResponse.json({ code: 'TOO_LONG', message: '1000자 이하로 입력해주세요' }, { status: 400 });
  }
  if (!anonymousId) {
    return NextResponse.json({ code: 'MISSING_ANON', message: '익명 ID가 없습니다' }, { status: 400 });
  }

  const { data, error } = await serverSupabase
    .from('feedback')
    .insert({ content, anonymous_id: anonymousId })
    .select('id')
    .single();
  if (error) {
    return NextResponse.json({ code: 'DB_ERROR', message: '제보 전송에 실패했습니다. 잠시 후 다시 시도해주세요' }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}

// ── GET: 제보 목록 조회
//   • 쿼리 anonymous_id 있으면 본인 제보만 (인증 불필요)
//   • 쿼리 없으면 관리자 전체 조회
// ──
export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'UNAVAILABLE', message: '서비스를 일시적으로 사용할 수 없습니다' }, { status: 503 });
  }

  const anonymousId = req.nextUrl.searchParams.get('anonymous_id');

  // 본인 제보 조회 모드
  if (anonymousId) {
    const { data, error } = await serverSupabase
      .from('feedback')
      .select('id, content, created_at, has_reply')
      .eq('anonymous_id', anonymousId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      return NextResponse.json({ code: 'DB_ERROR', message: '목록을 불러오지 못했습니다' }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [] });
  }

  // 관리자 전체 조회 모드 — 인증 필요
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다' }, { status: 403 });
  }

  const { data, error } = await serverSupabase
    .from('feedback')
    .select('id, content, created_at, has_reply, anonymous_id')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ code: 'DB_ERROR', message: '목록을 불러오지 못했습니다' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

// ── DELETE: 관리자 전용 제보 삭제 ──
export async function DELETE(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'UNAVAILABLE', message: '서비스를 일시적으로 사용할 수 없습니다' }, { status: 503 });
  }

  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다' }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ code: 'INVALID_ID', message: '잘못된 요청입니다' }, { status: 400 });
  }

  const { error } = await serverSupabase.from('feedback').delete().eq('id', Number(id));
  if (error) {
    return NextResponse.json({ code: 'DB_ERROR', message: '삭제에 실패했습니다' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
