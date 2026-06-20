import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

// POST — 확인(읽음) 등록
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' }, { status: 500 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { sabun?: string; name?: string };
  const sabun = String(body.sabun || '').trim();
  const name = String(body.name || '').trim();

  if (!sabun || !name) {
    return NextResponse.json({ code: 'NO_USER', message: '사용자 정보가 없습니다' }, { status: 400 });
  }

  // upsert — 동일 사용자가 여러 번 눌러도 1건만 유지
  const { error } = await serverSupabase
    .from('standby_coverage_reads')
    .upsert(
      { coverage_id: id, user_sabun: sabun, user_name: name },
      { onConflict: 'coverage_id,user_sabun' },
    );

  if (error) {
    return NextResponse.json({ code: 'INSERT_FAILED', message: '확인 등록 실패', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
