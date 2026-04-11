import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getSessionUser } from '@/lib/authServer';

const LEVEL_ADMIN_SABUN = '21711694'; // 이현구

/** POST — 등급 도전 결과 기록 */
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_UNAVAILABLE', message: 'DB 연결 실패' }, { status: 503 });
  }

  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다' }, { status: 401 });
  }

  const body = await req.json();
  const { levelId, levelName, score, passed } = body;

  if (!levelId || !levelName || score == null || passed == null) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: '필수 항목 누락' }, { status: 400 });
  }

  const { error } = await serverSupabase.from('level_records').insert({
    sabun: user.sabun,
    name: user.name,
    level_id: levelId,
    level_name: levelName,
    score,
    passed,
  });

  if (error) {
    // 테이블이 없으면 자동 생성 안내
    return NextResponse.json({ code: 'DB_ERROR', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** GET — 관리자(이현구)만 전체 기록 조회 */
export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_UNAVAILABLE', message: 'DB 연결 실패' }, { status: 503 });
  }

  const user = await getSessionUser(req);
  if (!user || user.sabun !== LEVEL_ADMIN_SABUN) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '접근 권한이 없습니다' }, { status: 403 });
  }

  const { data, error } = await serverSupabase
    .from('level_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ code: 'DB_ERROR', message: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
