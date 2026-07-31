import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth } from '@/lib/authServer';
import { getTodayStartKST, VISIT_ACTIONS } from '@/lib/visitStats';

// ── GET: 오늘의 통계 ──
export async function GET() {
  if (!serverSupabase) {
    return NextResponse.json({ todayVisitors: 0, todayPosts: 0 });
  }

  const todayISO = getTodayStartKST();

  // 오늘 앱 접속자 수 — 홈 진입(app_visit) + 로그인 unique user_id.
  // 로그인만 하고 홈을 안 거친 사람도 접속자다(관리자 대시보드와 같은 기준).
  let todayVisitors = 0;
  try {
    const { data } = await serverSupabase
      .from('audit_log')
      .select('user_id')
      .in('action', VISIT_ACTIONS)
      .gte('created_at', todayISO)
      .limit(5000);
    if (data) {
      todayVisitors = new Set(data.map((r: { user_id: string }) => r.user_id)).size;
    }
  } catch { /* ignore */ }

  // 오늘 새 소식 수 (hazard_reports 신규 등록)
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

// ── POST: 홈화면 진입 기록 (오늘 1회만) ──
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json({ ok: true });
  }

  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return NextResponse.json({ ok: true }); // 미인증이면 기록 안 함
  }
  const user = authResult;

  const todayISO = getTodayStartKST();

  // 오늘 이미 app_visit 기록이 있으면 skip
  try {
    const { count } = await serverSupabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.sub)
      .eq('action', 'app_visit')
      .gte('created_at', todayISO);

    if ((count ?? 0) === 0) {
      await serverSupabase.from('audit_log').insert({
        user_id: user.sub,
        user_name: user.name,
        action: 'app_visit',
      });
    }
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true });
}
