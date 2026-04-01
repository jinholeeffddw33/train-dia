import { NextRequest, NextResponse } from 'next/server';
import { createToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/jwt';
import { verifyPin, getProfileBySabun, auditLog, getClientIP } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';

// ── POST: PIN 로그인 ──
export async function POST(req: NextRequest) {
  let body: { sabun?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '잘못된 요청입니다' },
      { status: 400 },
    );
  }

  const sabun = body.sabun?.trim();
  const pin = body.pin?.trim();

  if (!sabun || !pin) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '사번과 PIN을 입력해주세요' },
      { status: 400 },
    );
  }

  // 프로필 조회
  const profile = await getProfileBySabun(sabun);
  if (!profile) {
    return NextResponse.json(
      { code: 'AUTH_FAILED', message: '사번 또는 PIN이 일치하지 않습니다' },
      { status: 401 },
    );
  }

  // PIN 검증
  const pinValid = await verifyPin(pin, profile.pin_hash);
  if (!pinValid) {
    await auditLog(profile.id, profile.name, 'login_failed', {
      metadata: { reason: 'invalid_pin' },
      ip: getClientIP(req),
    });
    return NextResponse.json(
      { code: 'AUTH_FAILED', message: '사번 또는 PIN이 일치하지 않습니다' },
      { status: 401 },
    );
  }

  // JWT 발급
  const token = await createToken({
    sub: profile.id,
    sabun: profile.sabun,
    name: profile.name,
    personId: profile.person_id,
    role: profile.role,
  });

  // 생체인증 등록 여부 확인
  let hasBiometric = false;
  if (serverSupabase) {
    const { data: creds } = await serverSupabase
      .from('webauthn_credentials')
      .select('credential_id')
      .eq('user_id', profile.id)
      .limit(1);
    hasBiometric = (creds?.length ?? 0) > 0;
  }

  // 감사 로그
  await auditLog(profile.id, profile.name, 'login_pin', {
    ip: getClientIP(req),
  });

  // 쿠키 설정 + 응답
  const res = NextResponse.json({
    success: true,
    user: {
      id: profile.id,
      name: profile.name,
      sabun: profile.sabun,
      personId: profile.person_id,
      role: profile.role,
      mustChangePin: profile.must_change_pin,
      hasBiometric,
    },
  });

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  return res;
}
