import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth } from '@/lib/authServer';

/** KST(UTC+9) 기준 오늘 자정 ISO 문자열 */
function getTodayStartKST(): string {
  const now = new Date();
  // KST = UTC + 9시간
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  // KST 기준 날짜의 00:00:00을 UTC로 변환
  const kstMidnight = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()));
  // KST 00:00 = UTC 전날 15:00
  return new Date(kstMidnight.getTime() - kstOffset).toISOString();
}

// ── GET: 오늘의 통계 ──
export async function GET() {
  if (!serverSupabase) {
    return NextResponse.json({ todayVisitors: 0, todayPosts: 0 });
  }

  const todayISO = getTodayStartKST();

  // 오늘 앱 접속자 수 (audit_log의 app_visit 이벤트 unique user_id)
  let todayVisitors = 0;
  try {
    const { data } = await serverSupabase
      .from('audit_log')
      .select('user_id')
      .eq('action', 'app_visit')
      .gte('created_at', todayISO);
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
