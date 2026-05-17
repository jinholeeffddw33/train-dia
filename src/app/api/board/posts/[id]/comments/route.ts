import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth } from '@/lib/authServer';
import { getOrCreateAlias, hashSabun } from '@/lib/board/alias';

// 댓글 작성 (parent_id 없으면 1단, 있으면 대댓글 = 2단)
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!serverSupabase) return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id: idStr } = await ctx.params;
  const postId = parseInt(idStr);
  if (!postId) return NextResponse.json({ code: 'BAD_ID' }, { status: 400 });

  type Body = { body?: string; parent_id?: number | null };
  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ code: 'BAD_JSON' }, { status: 400 });
  }
  const body = (payload.body || '').trim();
  if (body.length < 1 || body.length > 500) {
    return NextResponse.json({ code: 'BAD_BODY' }, { status: 400 });
  }

  // 해당 게시글의 카테고리 → 가명 scope 결정
  const { data: post } = await serverSupabase
    .from('board_posts')
    .select('id, category, status')
    .eq('id', postId)
    .single();
  if (!post || post.status !== 'active') {
    return NextResponse.json({ code: 'POST_NOT_FOUND' }, { status: 404 });
  }

  // 부모 댓글 검증 — 2단까지만 허용 (부모의 parent_id가 있으면 그건 이미 2단)
  if (payload.parent_id) {
    const { data: parent } = await serverSupabase
      .from('board_comments')
      .select('id, post_id, parent_id, status')
      .eq('id', payload.parent_id)
      .single();
    if (!parent || parent.post_id !== postId || parent.status !== 'active') {
      return NextResponse.json({ code: 'BAD_PARENT' }, { status: 400 });
    }
    if (parent.parent_id) {
      // 2단 댓글의 자식은 다시 부모를 가리키도록 평탄화 → 2단 유지
      payload.parent_id = parent.parent_id;
    }
  }

  // 스팸: 10초당 1개
  const myHash = hashSabun(auth.sabun);
  const since = new Date(Date.now() - 10 * 1000).toISOString();
  const { count } = await serverSupabase
    .from('board_comments')
    .select('id', { count: 'exact', head: true })
    .eq('author_hash', myHash)
    .gte('created_at', since);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ code: 'RATE_LIMIT', message: '잠시 후 다시 시도해주세요' }, { status: 429 });
  }

  const scope = post.category === 'advice' ? 'advice' : 'general';
  const { hash, alias } = await getOrCreateAlias(auth.sabun, scope);

  const { data, error } = await serverSupabase
    .from('board_comments')
    .insert({
      post_id: postId,
      parent_id: payload.parent_id ?? null,
      body,
      author_hash: hash,
      author_alias: alias,
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ code: 'INSERT_FAILED', message: error?.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
