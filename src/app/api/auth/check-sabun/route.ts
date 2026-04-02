import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { getProfileBySabun } from '@/lib/authServer';

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

  // 이 기기(서버)에 생체인증 등록 여부 확인
  let hasBiometric = false;
  if (serverSupabase) {
    const { data: creds } = await serverSupabase
      .from('webauthn_credentials')
      .select('credential_id')
      .eq('user_id', profile.id)
      .limit(1);
    hasBiometric = (creds?.length ?? 0) > 0;
  }

  return NextResponse.json({
    exists: true,
    mustChangePin: profile.must_change_pin,
    hasBiometric,
  });
}
