import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth } from '@/lib/authServer';

const CATEGORIES = ['newcomer', 'daily', 'trouble', 'hr'] as const;
type Category = (typeof CATEGORIES)[number];

interface DbVideoRow {
  id: number;
  category: string;
  title: string;
  url: string;
  source: string | null;
  sort_order: number;
  created_at: string;
}

/** URL에서 출처 자동 판별 */
function detectSource(url: string): string {
  if (/youtu\.be|youtube\.com/i.test(url)) return 'youtube';
  if (/cafe\.naver\.com|naver\.me/i.test(url)) return 'naver-cafe';
  return 'link';
}

/** 등록된 영상 목록 (활성) */
export async function GET() {
  if (!serverSupabase) {
    return NextResponse.json({ videos: [] });
  }

  try {
    const { data } = await serverSupabase
      .from('edu_videos')
      .select('id, category, title, url, source, sort_order, created_at')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    const videos = (data as DbVideoRow[] | null ?? []).map((row) => ({
      id: `db-${row.id}`,
      category: row.category,
      title: row.title,
      url: row.url,
      source: row.source ?? undefined,
    }));

    return NextResponse.json({ videos });
  } catch {
    return NextResponse.json({ videos: [] });
  }
}

/** 영상 등록 — 영역 + 제목 + 링크 */
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'NO_DB', message: '지금은 등록할 수 없어요. 잠시 후 다시 시도해주세요' },
      { status: 503 },
    );
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '다시 로그인해주세요' },
      { status: 401 },
    );
  }
  const user = authResult;

  let category: string | undefined;
  let title: string | undefined;
  let url: string | undefined;
  try {
    const body = await req.json();
    category = typeof body.category === 'string' ? body.category.trim() : undefined;
    title = typeof body.title === 'string' ? body.title.trim() : undefined;
    url = typeof body.url === 'string' ? body.url.trim() : undefined;
  } catch {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: '입력 내용을 다시 확인해주세요' },
      { status: 400 },
    );
  }

  if (!category || !CATEGORIES.includes(category as Category)) {
    return NextResponse.json(
      { code: 'BAD_CATEGORY', message: '영역을 골라주세요' },
      { status: 400 },
    );
  }
  if (!title || title.length > 100) {
    return NextResponse.json(
      { code: 'BAD_TITLE', message: '제목을 1~100자로 적어주세요' },
      { status: 400 },
    );
  }
  if (!url || !/^https?:\/\//i.test(url) || url.length > 500) {
    return NextResponse.json(
      { code: 'BAD_URL', message: '링크 주소가 올바른지 확인해주세요 (http로 시작)' },
      { status: 400 },
    );
  }

  // 같은 영역의 마지막 정렬 순서 다음으로
  const { data: lastRow } = await serverSupabase
    .from('edu_videos')
    .select('sort_order')
    .eq('category', category)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((lastRow as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const { data: inserted, error } = await serverSupabase
    .from('edu_videos')
    .insert({
      category,
      title,
      url,
      source: detectSource(url),
      sort_order: nextOrder,
      created_by: user.sabun,
      created_by_name: user.name,
    })
    .select('id, category, title, url, source')
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { code: 'INSERT_FAILED', message: '등록에 실패했어요. 다시 시도해주세요' },
      { status: 500 },
    );
  }

  const row = inserted as { id: number; category: string; title: string; url: string; source: string | null };
  return NextResponse.json({
    ok: true,
    video: {
      id: `db-${row.id}`,
      category: row.category,
      title: row.title,
      url: row.url,
      source: row.source ?? undefined,
    },
  });
}
