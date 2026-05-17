import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth } from '@/lib/authServer';
import { getOrCreateAlias, hashSabun } from '@/lib/board/alias';

const VALID_CATEGORIES = ['free', 'tip', 'meet', 'advice'] as const;
type Category = typeof VALID_CATEGORIES[number];

function parseCategory(v: string | null): Category | null {
  if (v && (VALID_CATEGORIES as readonly string[]).includes(v)) return v as Category;
  return null;
}

// ── GET: 목록 (?category=&sort=&page=) ──
export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  }
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const cat = parseCategory(req.nextUrl.searchParams.get('category'));
  const sort = req.nextUrl.searchParams.get('sort') || 'latest'; // 'latest' | 'hot'
  const page = Math.max(0, parseInt(req.nextUrl.searchParams.get('page') || '0'));
  const pageSize = 30;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let q = serverSupabase.from('board_posts')
    .select('id, category, title, body, author_alias, author_hash, like_count, comment_count, created_at, metadata')
    .eq('status', 'active');
  if (cat) q = q.eq('category', cat);

  if (sort === 'hot') {
    // 24시간 내 좋아요 많은 순
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    q = q.gte('created_at', since).order('like_count', { ascending: false }).order('created_at', { ascending: false });
  } else {
    q = q.order('created_at', { ascending: false });
  }
  q = q.range(from, to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ code: 'FETCH_FAILED', message: error.message }, { status: 500 });

  // 차단 목록
  const myHash = hashSabun(auth.sabun);
  const { data: blocks } = await serverSupabase
    .from('board_blocks')
    .select('blocked_hash')
    .eq('blocker_hash', myHash);
  const blocked = new Set((blocks || []).map((b) => b.blocked_hash));

  // 본문에서 작성자 hash 노출 막고, 차단 작성자 제외
  const filtered = (data || []).filter((p) => !blocked.has(p.author_hash));
  const safe = filtered.map((p) => ({
    id: p.id,
    category: p.category,
    title: p.title,
    body: p.body,
    author_alias: p.author_alias,
    is_mine: p.author_hash === myHash,
    like_count: p.like_count,
    comment_count: p.comment_count,
    created_at: p.created_at,
    metadata: p.metadata,
  }));

  return NextResponse.json({ posts: safe, page, hasMore: safe.length === pageSize });
}

// ── POST: 글 작성 ──
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  }
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  type Body = { category?: string; title?: string; body?: string; metadata?: Record<string, unknown> };
  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ code: 'BAD_JSON' }, { status: 400 });
  }
  const cat = parseCategory(payload.category ?? null);
  const title = (payload.title || '').trim();
  const body = (payload.body || '').trim();
  if (!cat) return NextResponse.json({ code: 'BAD_CATEGORY' }, { status: 400 });
  if (title.length < 1 || title.length > 80) return NextResponse.json({ code: 'BAD_TITLE' }, { status: 400 });
  if (body.length < 1 || body.length > 2000) return NextResponse.json({ code: 'BAD_BODY' }, { status: 400 });

  // 스팸 방지: 1분에 1개 제한
  const myHash = hashSabun(auth.sabun);
  const since1m = new Date(Date.now() - 60 * 1000).toISOString();
  const { count } = await serverSupabase
    .from('board_posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_hash', myHash)
    .gte('created_at', since1m);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ code: 'RATE_LIMIT', message: '1분 후 다시 시도해주세요' }, { status: 429 });
  }

  // 가명 결정 — 카테고리에 따라 scope 분리
  const scope = cat === 'advice' ? 'advice' : 'general';
  const { hash, alias } = await getOrCreateAlias(auth.sabun, scope);

  const { data, error } = await serverSupabase
    .from('board_posts')
    .insert({
      category: cat,
      title,
      body,
      author_hash: hash,
      author_alias: alias,
      metadata: payload.metadata ?? {},
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ code: 'INSERT_FAILED', message: error?.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
