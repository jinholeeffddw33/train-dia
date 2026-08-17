import { NextRequest, NextResponse } from 'next/server';
import { createToken, COOKIE_NAME, TOKEN_MAX_AGE_PIN } from '@/lib/jwt';
import { verifyPin, getProfileBySabun, auditLog, getClientIP } from '@/lib/authServer';
import { serverSupabase } from '@/lib/serverSupabase';
import { isAdmin } from '@/lib/auth';

// ── POST: 로그인 (PIN 또는 최초 사번만) ──
export async function POST(req: NextRequest) {
  let body: { sabun?: string; pin?: string; name?: string };
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
  const nameInput = body.name?.trim();

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

  const admin = isAdmin(sabun);

  if (admin) {
    // 관리자: 기존 PIN 로직 유지
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
  } else {
    // 일반 사용자: 이름 확인
    if (!nameInput) {
      return NextResponse.json(
        { code: 'MISSING_NAME', message: '이름을 입력해주세요' },
        { status: 400 },
      );
    }
    if (nameInput !== profile.name) {
      await auditLog(profile.id, profile.name, 'login_failed', {
        metadata: { reason: 'invalid_name' },
        ip: getClientIP(req),
      });
      return NextResponse.json(
        { code: 'AUTH_FAILED', message: '이름이 일치하지 않습니다' },
        { status: 401 },
      );
    }
  }

  // JWT 발급 (365일 세션)
  const token = await createToken({
    sub: profile.id,
    sabun: profile.sabun,
    name: profile.name,
    personId: profile.person_id,
    role: profile.role,
  }, TOKEN_MAX_AGE_PIN);

  // 감사 로그
  const auditAction = admin
    ? (profile.must_change_pin ? 'first_login' : 'login_pin')
    : 'login_name';
  await auditLog(profile.id, profile.name, auditAction, {
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
      mustChangePin: admin ? profile.must_change_pin : false,
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
