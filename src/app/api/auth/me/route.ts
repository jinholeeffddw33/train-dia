import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import { COOKIE_NAME } from '@/lib/jwt';

// ── GET: 현재 로그인된 사용자 정보 ──
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);

  if (!user) {
    return NextResponse.json({ user: null });
  }

  /**
   * 세션 토큰만 믿으면 계정을 지워도 로그아웃되지 않는다.
   * PIN 로그인 토큰은 365일짜리라(TOKEN_MAX_AGE_PIN) 삭제·비활성화한 계정이
   * 1년 가까이 앱을 계속 쓸 수 있었다. 앱 진입 시 한 번 도는 이 경로에서만
   * 실제 계정 상태를 확인한다. (모든 API 마다 확인하면 왕복이 너무 잦다)
   *
   * 조회가 '성공했고 결과가 없을 때'만 무효 처리한다 — DB 장애나 설정 누락으로
   * 전 직원이 한꺼번에 튕기는 쪽이 게스트 하나 남는 것보다 훨씬 나쁘다(fail-open).
   */
  if (serverSupabase) {
    const { data, error } = await serverSupabase
      .from('driver_profiles')
      .select('id, is_active')
      .eq('id', user.sub)
      .maybeSingle();

    if (!error && (!data || data.is_active === false)) {
      const res = NextResponse.json({ user: null });
      res.cookies.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
      return res;
    }
  }

  return NextResponse.json({
    user: {
      id: user.sub,
      name: user.name,
      sabun: user.sabun,
      personId: user.personId,
      role: user.role,
    },
  });
}
