import { NextRequest, NextResponse } from 'next/server';
import { createToken, COOKIE_NAME, TOKEN_MAX_AGE_PIN } from '@/lib/jwt';
import { verifyPin, getProfileBySabun, auditLog, getClientIP } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';

// ── POST: 로그인 (PIN 또는 최초 사번만) ──
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

  if (!sabun) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '사번을 입력해주세요' },
      { status: 400 },
    );
  }

  // 프로필 조회
  const profile = await getProfileBySabun(sabun);
  if (!profile) {
    return NextResponse.json(
      { code: 'AUTH_FAILED', message: '등록되지 않은 사번입니다' },
      { status: 401 },
    );
  }

  // 최초 로그인 (must_change_pin = true): 사번만으로 로그인 허용
  // 이후 로그인: PIN 필수
  if (!profile.must_change_pin) {
    if (!pin) {
      return NextResponse.json(
        { code: 'MISSING_PIN', message: 'PIN을 입력해주세요' },
        { status: 400 },
      );
    }
    const pinValid = await verifyPin(pin, profile.pin_hash);
    if (!pinValid) {
      await auditLog(profile.id, profile.name, 'login_failed', {
        metadata: { reason: 'invalid_pin' },
        ip: getClientIP(req),
      });
      return NextResponse.json(
        { code: 'AUTH_FAILED', message: 'PIN이 일치하지 않습니다' },
        { status: 401 },
      );
    }
  }

  // JWT 발급 (PIN 로그인: 7일 세션)
  const token = await createToken({
    sub: profile.id,
    sabun: profile.sabun,
    name: profile.name,
    personId: profile.person_id,
    role: profile.role,
  }, TOKEN_MAX_AGE_PIN);

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
  await auditLog(profile.id, profile.name, profile.must_change_pin ? 'first_login' : 'login_pin', {
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
    maxAge: TOKEN_MAX_AGE_PIN,
  });

  return res;
}
