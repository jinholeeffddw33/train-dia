import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getProfileBySabun } from '@/lib/authServer';
import { isAdmin } from '@/lib/auth';

// ── GET: 사번으로 계정 상태 조회 (로그인 전 호출) ──
export async function GET(req: NextRequest) {
  const sabun = req.nextUrl.searchParams.get('sabun')?.trim();

  if (!sabun) {
    return NextResponse.json(
      { code: 'MISSING_SABUN', message: '사번을 입력해주세요' },
      { status: 400 },
    );
  }

  const profile = await getProfileBySabun(sabun);
  if (!profile) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '등록되지 않은 사번입니다' },
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
