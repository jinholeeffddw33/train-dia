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
    .select('id, category, title, body, author_alias, author_hash, is_anonymous, like_count, comment_count, created_at, metadata, images')
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
    is_anonymous: p.is_anonymous,
    is_mine: p.author_hash === myHash,
    like_count: p.like_count,
    comment_count: p.comment_count,
    created_at: p.created_at,
    metadata: p.metadata,
    images: p.images || [],
  }));

  return NextResponse.json({ posts: safe, page, hasMore: safe.length === pageSize });
}

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// ── POST: 글 작성 (JSON 또는 multipart/form-data) ──
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ code: 'DB_NOT_CONFIGURED' }, { status: 500 });
  }
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const ct = req.headers.get('content-type') || '';
  let cat: ReturnType<typeof parseCategory> = null;
  let title = '';
  let body = '';
  let metadata: Record<string, unknown> = {};
  let anonymous = false;
  const images: File[] = [];

  if (ct.includes('multipart/form-data')) {
    let form: FormData;
    try { form = await req.formData(); } catch { return NextResponse.json({ code: 'BAD_FORM' }, { status: 400 }); }
    cat = parseCategory((form.get('category') as string) || null);
    title = ((form.get('title') as string) || '').trim();
    body = ((form.get('body') as string) || '').trim();
    const metaRaw = form.get('metadata');
    if (typeof metaRaw === 'string' && metaRaw) {
      try { metadata = JSON.parse(metaRaw); } catch { /* ignore */ }
    }
    anonymous = (form.get('anonymous') as string) === 'true';
    const files = form.getAll('images').filter((v): v is File => v instanceof File && v.size > 0);
    for (const f of files.slice(0, MAX_IMAGES)) {
      if (f.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ code: 'FILE_TOO_LARGE', message: '사진은 5MB 이하만 업로드할 수 있어요' }, { status: 400 });
      }
      if (!/^image\//.test(f.type)) {
        return NextResponse.json({ code: 'BAD_FILE_TYPE', message: '사진만 업로드할 수 있어요' }, { status: 400 });
      }
      images.push(f);
    }
  } else {
    type Body = { category?: string; title?: string; body?: string; metadata?: Record<string, unknown>; anonymous?: boolean };
    let payload: Body;
    try { payload = (await req.json()) as Body; } catch { return NextResponse.json({ code: 'BAD_JSON' }, { status: 400 }); }
    cat = parseCategory(payload.category ?? null);
    title = (payload.title || '').trim();
    body = (payload.body || '').trim();
    metadata = payload.metadata ?? {};
    anonymous = !!payload.anonymous;
  }

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

  // 이미지 업로드
  const imageUrls: string[] = [];
  for (const f of images) {
    const ext = (f.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const fileName = `${cat}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const buf = Buffer.from(await f.arrayBuffer());
    const { error: upErr } = await serverSupabase.storage
      .from('board-photos')
      .upload(fileName, buf, { contentType: f.type, upsert: false });
    if (upErr) {
      return NextResponse.json({ code: 'UPLOAD_FAILED', message: '사진 업로드에 실패했어요', detail: upErr.message }, { status: 500 });
    }
    imageUrls.push(
      serverSupabase.storage.from('board-photos').getPublicUrl(fileName).data.publicUrl,
    );
  }

  // 작성자 표시 결정 — 익명이면 가명(advice 는 별도 scope), 실명이면 이름.
  // author_hash 는 익명/실명 무관 항상 사번 해시 (내 글 판별·차단·rate limit 용, 클라엔 미노출)
  let displayName: string;
  if (anonymous) {
    const scope = cat === 'advice' ? 'advice' : 'general';
    const r = await getOrCreateAlias(auth.sabun, scope);
    displayName = r.alias;
  } else {
    displayName = auth.name;
  }

  const { data, error } = await serverSupabase
    .from('board_posts')
    .insert({
      category: cat,
      title,
      body,
      author_hash: myHash,
      author_alias: displayName,
      is_anonymous: anonymous,
      images: imageUrls.length > 0 ? imageUrls : null,
      metadata,
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ code: 'INSERT_FAILED', message: error?.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
