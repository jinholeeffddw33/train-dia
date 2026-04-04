import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

// ── POST: 조회 기록 (upsert — 중복 방지) ──
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!serverSupabase) return NextResponse.json({ readCount: 0 });

  const { id: postId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  const sabun = (body.sabun as string | undefined)?.trim();
  const name = (body.name as string | undefined)?.trim() ?? '';
  if (!sabun) return NextResponse.json({ readCount: 0 });

  // upsert — 같은 사용자가 여러 번 열어도 1회로 집계
  try {
    await serverSupabase
      .from('life_reads')
      .upsert(
        { post_id: postId, user_sabun: sabun, user_name: name },
        { onConflict: 'post_id,user_sabun' },
      );
  } catch { /* 테이블 없으면 무시 */ }

  const { count } = await serverSupabase
    .from('life_reads')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  return NextResponse.json({ readCount: count ?? 0 });
}
