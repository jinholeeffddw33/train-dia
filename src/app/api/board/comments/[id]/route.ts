import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth } from '@/lib/authServer';
import { hashSabun } from '@/lib/board/alias';

// 본인 댓글 삭제
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!serverSupabase) return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr);
  if (!id) return NextResponse.json({ code: 'BAD_ID' }, { status: 400 });
  const myHash = hashSabun(auth.sabun);

  const { data: cmt } = await serverSupabase
    .from('board_comments')
    .select('author_hash')
    .eq('id', id)
    .single();
  if (!cmt) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  if (cmt.author_hash !== myHash) return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });

  await serverSupabase.from('board_comments').update({ status: 'deleted' }).eq('id', id);
  return NextResponse.json({ ok: true });
}
