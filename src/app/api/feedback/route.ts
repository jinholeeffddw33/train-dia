import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';

// ── POST: 익명 제보 제출 (인증 불필요) ──
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'UNAVAILABLE', message: '서비스를 일시적으로 사용할 수 없습니다' }, { status: 503 });
  }

  let content: string;
  try {
    const body = await req.json();
    content = (body.content ?? '').trim();
  } catch {
    return NextResponse.json({ code: 'INVALID_BODY', message: '잘못된 요청입니다' }, { status: 400 });
  }

  if (!content || content.length < 5) {
    return NextResponse.json({ code: 'TOO_SHORT', message: '5자 이상 입력해주세요' }, { status: 400 });
  }
  if (content.length > 1000) {
    return NextResponse.json({ code: 'TOO_LONG', message: '1000자 이하로 입력해주세요' }, { status: 400 });
  }

  const { error } = await serverSupabase.from('feedback').insert({ content });
  if (error) {
    return NextResponse.json({ code: 'DB_ERROR', message: '제보 전송에 실패했습니다. 잠시 후 다시 시도해주세요' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ── GET: 관리자 전용 제보 목록 조회 ──
export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'UNAVAILABLE', message: '서비스를 일시적으로 사용할 수 없습니다' }, { status: 503 });
  }

  // 세션 확인
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다' }, { status: 401 });
  }

  // 관리자 role 확인
  if (user.role !== 'admin') {
    return NextResponse.json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다' }, { status: 403 });
  }

  const { data, error } = await serverSupabase
    .from('feedback')
    .select('id, content, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ code: 'DB_ERROR', message: '목록을 불러오지 못했습니다' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
