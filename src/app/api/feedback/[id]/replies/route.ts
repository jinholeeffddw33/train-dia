import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';

interface ReplyRow {
  id: number;
  content: string;
  is_admin: boolean;
  created_at: string;
}

// ── GET: 대화 내역 조회
//   권한: 관리자 OR 본인(anonymous_id 일치)
// ──
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'UNAVAILABLE', message: '서비스를 일시적으로 사용할 수 없습니다' }, { status: 503 });
  }

  const { id: idParam } = await params;
  const feedbackId = Number(idParam);
  if (isNaN(feedbackId)) {
    return NextResponse.json({ code: 'INVALID_ID', message: '잘못된 요청입니다' }, { status: 400 });
  }

  // 권한 확인: 관리자 세션 또는 anonymous_id 일치
  const user = await getSessionUser(req);
  const isAdmin = user?.role === 'admin';
  const anonymousId = req.nextUrl.searchParams.get('anonymous_id');

  if (!isAdmin) {
    if (!anonymousId) {
      return NextResponse.json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다' }, { status: 403 });
    }
    // 해당 feedback의 anonymous_id 일치 확인
    const { data: fb } = await serverSupabase
      .from('feedback')
      .select('anonymous_id')
      .eq('id', feedbackId)
      .single();
    if (!fb || fb.anonymous_id !== anonymousId) {
      return NextResponse.json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다' }, { status: 403 });
    }
  }

  const { data, error } = await serverSupabase
    .from('feedback_replies')
    .select('id, content, is_admin, created_at')
    .eq('feedback_id', feedbackId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ code: 'DB_ERROR', message: '대화를 불러오지 못했습니다' }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? []) as ReplyRow[] });
}

// ── POST: 답글 작성
//   • 관리자: is_admin=true로 등록, feedback.has_reply=true 갱신
//   • 본인(anonymous_id): is_admin=false로 등록 (추가 질문 가능)
// ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'UNAVAILABLE', message: '서비스를 일시적으로 사용할 수 없습니다' }, { status: 503 });
  }

  const { id: idParam } = await params;
  const feedbackId = Number(idParam);
  if (isNaN(feedbackId)) {
    return NextResponse.json({ code: 'INVALID_ID', message: '잘못된 요청입니다' }, { status: 400 });
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

  if (!content || content.length < 1) {
    return NextResponse.json({ code: 'TOO_SHORT', message: '내용을 입력해주세요' }, { status: 400 });
  }
  if (content.length > 1000) {
    return NextResponse.json({ code: 'TOO_LONG', message: '1000자 이하로 입력해주세요' }, { status: 400 });
  }

  const user = await getSessionUser(req);
  const isAdmin = user?.role === 'admin';

  // 권한 확인
  if (!isAdmin) {
    if (!anonymousId) {
      return NextResponse.json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다' }, { status: 403 });
    }
    const { data: fb } = await serverSupabase
      .from('feedback')
      .select('anonymous_id')
      .eq('id', feedbackId)
      .single();
    if (!fb || fb.anonymous_id !== anonymousId) {
      return NextResponse.json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다' }, { status: 403 });
    }
  }

  const { error: insertError } = await serverSupabase
    .from('feedback_replies')
    .insert({ feedback_id: feedbackId, content, is_admin: isAdmin });
  if (insertError) {
    return NextResponse.json({ code: 'DB_ERROR', message: '답글 작성에 실패했습니다' }, { status: 500 });
  }

  // 관리자가 답글 작성 시 has_reply 플래그 업데이트
  if (isAdmin) {
    await serverSupabase
      .from('feedback')
      .update({ has_reply: true })
      .eq('id', feedbackId);
  }

  return NextResponse.json({ success: true });
}
