import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!serverSupabase) return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  const { id: postId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  const name = (body.name as string)?.trim();
  const sabun = (body.sabun as string)?.trim();
  if (!name || !sabun) return NextResponse.json({ code: 'MISSING_FIELDS' }, { status: 400 });

  const verified = verifyUser(name, sabun);
  if (!verified) return NextResponse.json({ code: 'AUTH_FAILED' }, { status: 403 });

  // 토글: 이미 좋아요면 삭제, 아니면 추가
  const { data: existing } = await serverSupabase
    .from('life_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_sabun', sabun)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    await serverSupabase.from('life_likes').delete().eq('id', existing.id);
    liked = false;
  } else {
    await serverSupabase.from('life_likes').insert({ post_id: postId, user_sabun: sabun });
    liked = true;
  }

  const { count } = await serverSupabase
    .from('life_likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  return NextResponse.json({ liked, likeCount: count ?? 0 });
}
