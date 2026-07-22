import { NextResponse } from 'next/server';

/**
 * 오늘의 헤드라인 뉴스 — 구글 뉴스(한국) RSS 를 서버에서 받아 파싱해 내려준다.
 * RSS 는 브라우저에서 직접 부르면 CORS 로 막혀 서버 프록시가 필요하다. API 키·비용 없음.
 * 10분 캐시(revalidate) — 매 요청마다 외부를 때리지 않는다.
 */
export const revalidate = 600;

const FEED_URL = 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko';

/** XML 엔티티·CDATA 정리 */
function clean(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '') // 남은 태그 제거(설명 안 쓰지만 안전)
    .trim();
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? clean(m[1]) : '';
}

interface NewsItem { title: string; link: string; source: string; pubDate: string }

function parseItems(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  for (const b of blocks) {
    const rawTitle = pick(b, 'title');
    const link = pick(b, 'link');
    const source = pick(b, 'source');
    const pubDate = pick(b, 'pubDate');
    if (!rawTitle || !link) continue;
    // 구글 뉴스 제목은 "제목 - 언론사" 형식 → 뒤 언론사 꼬리 제거(별도 source 사용)
    let title = rawTitle;
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(source.length + 3)).trim();
    } else {
      title = title.replace(/\s-\s[^-]+$/, '').trim() || rawTitle;
    }
    out.push({ title, link, source, pubDate });
  }
  return out;
}

export async function GET() {
  try {
    const res = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrainDIA/1.0)' },
      next: { revalidate },
    });
    if (!res.ok) {
      return NextResponse.json({ code: 'FETCH_FAILED', message: '뉴스를 불러오지 못했어요' }, { status: 502 });
    }
    const xml = await res.text();
    const items = parseItems(xml).slice(0, 12);
    if (items.length === 0) {
      return NextResponse.json({ code: 'EMPTY', message: '표시할 뉴스가 없어요', data: [] }, { status: 200 });
    }
    return NextResponse.json({ data: items });
  } catch {
    return NextResponse.json({ code: 'ERROR', message: '뉴스를 불러오지 못했어요' }, { status: 500 });
  }
}
