import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

const CATEGORIES = ['healing', 'hobby', 'growth', 'lounge'] as const;

/**
 * GET /api/life/posts/counts?healing=ISO&hobby=ISO&growth=ISO&lounge=ISO
 * 카테고리별 since 이후 새 글 수 반환
 * since 파라미터 없는 카테고리는 전체 수 반환
 */
export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ data: { healing: 0, hobby: 0, growth: 0, lounge: 0 } });
  }

  const results = await Promise.all(
    CATEGORIES.map(async (cat) => {
      const since = req.nextUrl.searchParams.get(cat) ?? '';

      let query = serverSupabase!
        .from('life_posts')
        .select('id', { count: 'exact', head: true })
        .eq('category', cat);

      if (since) {
        query = query.gt('created_at', since);
      }

      const { count, error } = await query;
      return { cat, count: error ? 0 : (count ?? 0) };
    }),
  );

  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.cat] = r.count;
  }

  return NextResponse.json({ data: counts });
}
