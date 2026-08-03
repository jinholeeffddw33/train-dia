import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import type { TokenPayload } from '@/lib/jwt';
import { dayKST, getKstDayStart, kstDay, todayKST, VISIT_ACTIONS } from '@/lib/visitStats';

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

  const today = todayKST();
  const yesterday = dayKST(1);

  // 병렬 쿼리
  const [
    { data: twoDayVisits },
    { data: recentLogs },
    { data: allProfiles },
    { count: totalLogs },
  ] = await Promise.all([
    // 오늘+어제 접속자 (app_visit + login) — KST 자정 기준.
    // 자정이 지나면 오늘 목록이 비워져 야간·심야 접속자를 놓친다는 요청으로 이틀치를 함께 준다.
    serverSupabase
      .from('audit_log')
      .select('user_id, user_name, action, created_at')
      .gte('created_at', getKstDayStart(1))
      .in('action', VISIT_ACTIONS)
      .order('created_at', { ascending: false })
      .limit(5000),
    // 최근 7일 로그 (일별 집계용)
    serverSupabase
      .from('audit_log')
      .select('user_id, user_name, action, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .in('action', VISIT_ACTIONS)
      .order('created_at', { ascending: false })
      .limit(5000),
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

  // 하루치 로그 → 사람별 1줄(그날의 마지막 접속). 쿼리가 최신순이라 처음 만난 게 마지막 접속이다.
  type VisitLog = { user_id: string; user_name: string; action: string; created_at: string };
  const uniqueByUser = (logs: VisitLog[]) => {
    const m = new Map<string, { name: string; lastAt: string; action: string }>();
    for (const log of logs) {
      if (!m.has(log.user_id)) {
        m.set(log.user_id, { name: log.user_name, lastAt: log.created_at, action: log.action });
      }
    }
    return Array.from(m.entries()).map(([id, v]) => ({
      userId: id, name: v.name, lastAt: v.lastAt, action: v.action,
    }));
  };

  const twoDay = (twoDayVisits ?? []) as VisitLog[];
  const todayUsers = uniqueByUser(twoDay.filter((l) => kstDay(l.created_at) === today));
  const yesterdayUsers = uniqueByUser(twoDay.filter((l) => kstDay(l.created_at) === yesterday));

  // 7일 일별 유니크 접속자 수
  const dailyMap = new Map<string, Set<string>>();
  for (const log of (recentLogs ?? [])) {
    const day = kstDay(log.created_at); // UTC 그대로 자르면 00~09시 접속이 전날로 밀린다

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
    yesterday: {
      date: yesterday,
      uniqueCount: yesterdayUsers.length,
      users: yesterdayUsers,
    },
    dailyStats,
    inactive: neverOrOldUsers,
    totalLogs: totalLogs ?? 0,
  });
}
