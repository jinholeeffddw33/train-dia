import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getProfileBySabun } from '@/lib/authServer';
import { isAdmin } from '@/lib/auth';

// ── GET: 사번으로 계정 상태 조회 (로그인 전 호출) ──
export async function GET(req: NextRequest) {
  const sabun = req.nextUrl.searchParams.get('sabun')?.replace(/[\s-]/g, '');

  if (!sabun) {
    return NextResponse.json(
      { code: 'MISSING_SABUN', message: '사번을 입력해주세요' },
      { status: 400 },
    );
  }

  const profile = await getProfileBySabun(sabun);
  if (!profile) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '등록되지 않은 사번이에요. 숫자 8자리를 다시 확인하고, 계속 안 되면 이현구 부장님께 알려주세요' },
      { status: 404 },
    );
  }

  const admin = isAdmin(profile.sabun);

  return NextResponse.json({
    exists: true,
    isAdmin: admin,
    mustChangePin: admin ? profile.must_change_pin : false,
  });
}
