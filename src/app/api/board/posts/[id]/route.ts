import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth } from '@/lib/authServer';
import { hashSabun } from '@/lib/board/alias';

// ── GET: 글 1개 + 댓글 + 좋아요 여부 ──
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!serverSupabase) return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr);
  if (!id) return NextResponse.json({ code: 'BAD_ID' }, { status: 400 });
  const myHash = hashSabun(auth.sabun);

  const { data: post, error } = await serverSupabase
    .from('board_posts')
    .select('id, category, title, body, author_alias, author_hash, is_anonymous, like_count, comment_count, created_at, metadata, status, images')
    .eq('id', id)
    .single();
  if (error || !post) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  if (post.status !== 'active') return NextResponse.json({ code: 'HIDDEN' }, { status: 410 });

  // 댓글 (2단)
  const { data: comments } = await serverSupabase
    .from('board_comments')
    .select('id, parent_id, body, author_alias, author_hash, like_count, created_at, status')
    .eq('post_id', id)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  // 내 좋아요 여부
  const { data: myLike } = await serverSupabase
    .from('board_post_likes')
    .select('post_id')
    .eq('post_id', id)
    .eq('author_hash', myHash)
    .maybeSingle();

  // 내 댓글 좋아요
  const cmtIds = (comments || []).map((c) => c.id);
  let myCmtLikes = new Set<number>();
  if (cmtIds.length > 0) {
    const { data: cl } = await serverSupabase
      .from('board_comment_likes')
      .select('comment_id')
      .in('comment_id', cmtIds)
      .eq('author_hash', myHash);
    myCmtLikes = new Set((cl || []).map((x) => x.comment_id as number));
  }

  return NextResponse.json({
    post: {
      id: post.id,
      category: post.category,
      title: post.title,
      body: post.body,
      author_alias: post.author_alias,
      is_anonymous: post.is_anonymous,
      is_mine: post.author_hash === myHash,
      like_count: post.like_count,
      comment_count: post.comment_count,
      created_at: post.created_at,
      metadata: post.metadata,
      images: post.images || [],
      i_liked: !!myLike,
    },
    comments: (comments || []).map((c) => ({
      id: c.id,
      parent_id: c.parent_id,
      body: c.body,
      author_alias: c.author_alias,
      is_mine: c.author_hash === myHash,
      like_count: c.like_count,
      created_at: c.created_at,
      i_liked: myCmtLikes.has(c.id as number),
    })),
  });
}

// ── DELETE: 본인 글 삭제 ──
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!serverSupabase) return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr);
  if (!id) return NextResponse.json({ code: 'BAD_ID' }, { status: 400 });
  const myHash = hashSabun(auth.sabun);

  const { data: post } = await serverSupabase
    .from('board_posts')
    .select('author_hash, status')
    .eq('id', id)
    .single();
  if (!post) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  if (post.author_hash !== myHash) return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });

  await serverSupabase.from('board_posts').update({ status: 'deleted' }).eq('id', id);
  return NextResponse.json({ ok: true });
}
