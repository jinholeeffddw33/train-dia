import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth } from '@/lib/authServer';
import { hashSabun } from '@/lib/board/alias';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!serverSupabase) return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr);
  if (!id) return NextResponse.json({ code: 'BAD_ID' }, { status: 400 });
  const myHash = hashSabun(auth.sabun);

  const { data: existing } = await serverSupabase
    .from('board_comment_likes')
    .select('comment_id')
    .eq('comment_id', id)
    .eq('author_hash', myHash)
    .maybeSingle();

  if (existing) {
    await serverSupabase
      .from('board_comment_likes')
      .delete()
      .eq('comment_id', id)
      .eq('author_hash', myHash);
    return NextResponse.json({ liked: false });
  }
  await serverSupabase
    .from('board_comment_likes')
    .insert({ comment_id: id, author_hash: myHash });
  return NextResponse.json({ liked: true });
}
