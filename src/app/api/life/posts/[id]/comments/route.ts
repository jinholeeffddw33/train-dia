import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!serverSupabase) return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  const { id: postId } = await params;

  const { data, error } = await serverSupabase
    .from('life_comments')
    .select('id, comment, created_by, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ data: [] });

  return NextResponse.json({
    data: (data ?? []).map((c: Record<string, unknown>) => ({
      id: c.id, postId, comment: c.comment, createdBy: c.created_by, createdAt: c.created_at,
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!serverSupabase) return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  const { id: postId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  const comment = (body.comment as string)?.trim();
  const name = (body.name as string)?.trim();
  const sabun = (body.sabun as string)?.trim();
  if (!comment || !name || !sabun) return NextResponse.json({ code: 'MISSING_FIELDS' }, { status: 400 });

  const verified = verifyUser(name, sabun);
  if (!verified) return NextResponse.json({ code: 'AUTH_FAILED' }, { status: 403 });

  const { error } = await serverSupabase.from('life_comments').insert({
    post_id: postId, comment, created_by: name,
  });

  if (error) return NextResponse.json({ code: 'INSERT_FAILED', message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
