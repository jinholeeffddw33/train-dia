import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import type { TokenPayload } from '@/lib/jwt';

export async function GET(req: NextRequest) {
  const userOrRes = await requireAuth(req);
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes as TokenPayload;

  if (user.role !== 'admin') {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' },
      { status: 403 },
    );
  }

  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: '서버 연결에 실패했습니다' },
      { status: 500 },
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  // 병렬 쿼리
  const [
    { data: todayVisits },
    { data: recentLogs },
    { data: allProfiles },
    { count: totalLogs },
  ] = await Promise.all([
    // 오늘 접속자 (app_visit + login)
    serverSupabase
      .from('audit_log')
      .select('user_id, user_name, action, created_at')
      .gte('created_at', `${today}T00:00:00`)
      .in('action', ['app_visit', 'login_pin', 'login_webauthn', 'first_login'])
      .order('created_at', { ascending: false }),
    // 최근 7일 로그 (일별 집계용)
    serverSupabase
      .from('audit_log')
      .select('user_id, user_name, action, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .in('action', ['app_visit', 'login_pin', 'login_webauthn', 'first_login'])
      .order('created_at', { ascending: false })
      .limit(1000),
    // 전체 활성 사용자
    serverSupabase
      .from('driver_profiles')
      .select('id, name, sabun, person_id, is_active')
      .eq('is_active', true),
    // 전체 로그 수
    serverSupabase
      .from('audit_log')
      .select('id', { count: 'exact', head: true }),
  ]);

  // 오늘 유니크 접속자
  const todayUniqueMap = new Map<string, { name: string; lastAt: string; action: string }>();
  for (const log of (todayVisits ?? [])) {
    if (!todayUniqueMap.has(log.user_id)) {
      todayUniqueMap.set(log.user_id, {
        name: log.user_name,
        lastAt: log.created_at,
        action: log.action,
      });
    }
  }
  const todayUsers = Array.from(todayUniqueMap.entries()).map(([id, v]) => ({
    userId: id, name: v.name, lastAt: v.lastAt, action: v.action,
  }));

  // 7일 일별 유니크 접속자 수
  const dailyMap = new Map<string, Set<string>>();
  for (const log of (recentLogs ?? [])) {
    const day = log.created_at.slice(0, 10);
    if (!dailyMap.has(day)) dailyMap.set(day, new Set());
    dailyMap.get(day)!.add(log.user_id);
  }
  const dailyStats = Array.from(dailyMap.entries())
    .map(([date, users]) => ({ date, count: users.size }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // 전체 사용자 중 최근 접속 기록 (최근 30일 미접속자 파악)
  const allUserIds = new Set((allProfiles ?? []).map(p => p.id));
  const recentUserIds = new Set((recentLogs ?? []).map(l => l.user_id));
  const neverOrOldUsers = (allProfiles ?? [])
    .filter(p => !recentUserIds.has(p.id) && p.person_id !== 'ADMIN')
    .map(p => ({ name: p.name, sabun: p.sabun }));

  return NextResponse.json({
    today: {
      date: today,
      uniqueCount: todayUsers.length,
      totalMembers: (allProfiles ?? []).filter(p => p.person_id !== 'ADMIN').length,
      users: todayUsers,
    },
    dailyStats,
    inactive: neverOrOldUsers,
    totalLogs: totalLogs ?? 0,
  });
}
