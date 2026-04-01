import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { data: post } = await serverSupabase.from('life_posts').select('created_by').eq('id', postId).single();
  if (!post) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
  if (post.created_by !== name) return NextResponse.json({ code: 'FORBIDDEN', message: '본인 글만 삭제할 수 있습니다' }, { status: 403 });

  await serverSupabase.from('life_comments').delete().eq('post_id', postId);
  await serverSupabase.from('life_likes').delete().eq('post_id', postId);
  await serverSupabase.from('life_posts').delete().eq('id', postId);

  return NextResponse.json({ success: true });
}
