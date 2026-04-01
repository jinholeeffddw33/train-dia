import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { verifyUser } from '@/lib/auth';

const VALID_CATEGORIES = ['healing', 'hobby', 'growth', 'lounge'] as const;

export async function GET(req: NextRequest) {
  if (!serverSupabase) return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });

  const category = req.nextUrl.searchParams.get('category') ?? 'lounge';
  const sabun = req.nextUrl.searchParams.get('sabun') ?? '';

  const { data, error } = await serverSupabase
    .from('life_posts')
    .select('id, category, title, content, created_by, created_at, life_comments(count), life_likes(count)')
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    // 테이블 없으면 빈 배열 반환
    if (error.message.includes('life_posts') || error.message.includes('life_comments') || error.message.includes('life_likes')) {
      return NextResponse.json({ data: [] });
    }
    return NextResponse.json({ code: 'FETCH_FAILED', message: error.message }, { status: 500 });
  }

  let likedIds = new Set<string>();
  if (sabun) {
    const { data: likes } = await serverSupabase
      .from('life_likes')
      .select('post_id')
      .eq('user_sabun', sabun);
    if (likes) likedIds = new Set(likes.map((l: { post_id: string }) => l.post_id));
  }

  const posts = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    content: r.content,
    createdBy: r.created_by,
    createdAt: r.created_at,
    commentCount: (r.life_comments as { count: number }[])?.[0]?.count ?? 0,
    likeCount: (r.life_likes as { count: number }[])?.[0]?.count ?? 0,
    likedByMe: likedIds.has(r.id as string),
  }));

  return NextResponse.json({ data: posts });
}

export async function POST(req: NextRequest) {
  if (!serverSupabase) return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }

  const category = body.category as string;
  const title = (body.title as string)?.trim();
  const content = (body.content as string)?.trim();
  const name = (body.name as string)?.trim();
  const sabun = (body.sabun as string)?.trim();

  if (!title || !content || !name || !sabun) {
    return NextResponse.json({ code: 'MISSING_FIELDS', message: '필수 항목이 없습니다' }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json({ code: 'INVALID_CATEGORY' }, { status: 400 });
  }

  const verified = verifyUser(name, sabun);
  if (!verified) {
    return NextResponse.json({ code: 'AUTH_FAILED', message: '이름과 사번이 일치하지 않습니다' }, { status: 403 });
  }

  const { error } = await serverSupabase.from('life_posts').insert({
    category,
    title,
    content,
    created_by: name,
  });

  if (error) {
    return NextResponse.json({ code: 'INSERT_FAILED', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
