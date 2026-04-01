import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';

// ── GET: 오늘의 통계 (접속자, 새 글) ──
export async function GET() {
  if (!serverSupabase) {
    return NextResponse.json({ todayVisitors: 0, todayPosts: 0 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  // 오늘 접속자 수 (hazard_reads 테이블의 unique user_sabun)
  let todayVisitors = 0;
  try {
    const { data } = await serverSupabase
      .from('hazard_reads')
      .select('user_sabun')
      .gte('created_at', todayISO);
    if (data) {
      todayVisitors = new Set(data.map((r: { user_sabun: string }) => r.user_sabun)).size;
    }
  } catch { /* ignore */ }

  // 오늘 새 글 수 (hazard_reports)
  let todayPosts = 0;
  try {
    const { count } = await serverSupabase
      .from('hazard_reports')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO);
    todayPosts = count ?? 0;
  } catch { /* ignore */ }

  return NextResponse.json({ todayVisitors, todayPosts });
}

// ── POST: 접속 기록 ──
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ ok: true });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  const sabun = (body.sabun as string | undefined)?.trim();
  if (!sabun) return NextResponse.json({ ok: true });

  // 접속 기록 — hazard_reads에 특별 report_id 'visit'로 기록
  try {
    await serverSupabase
      .from('hazard_reads')
      .upsert(
        { report_id: '00000000-0000-0000-0000-000000000000', user_sabun: sabun, user_name: body.name ?? '', created_at: new Date().toISOString() },
        { onConflict: 'report_id,user_sabun' },
      );
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true });
}
