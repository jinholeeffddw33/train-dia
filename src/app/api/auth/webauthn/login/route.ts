import { NextRequest, NextResponse } from 'next/server';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { createToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/jwt';
import { getProfileBySabun, getProfileById, auditLog, getClientIP } from '@/lib/authServer';

const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

// ── GET: 인증 옵션 생성 ──
export async function GET(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' },
      { status: 500 },
    );
  }

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
      { code: 'USER_NOT_FOUND', message: '등록되지 않은 사번입니다' },
      { status: 404 },
    );
  }

  // 등록된 credential 조회
  const { data: credentials } = await serverSupabase
    .from('webauthn_credentials')
    .select('credential_id, transports')
    .eq('user_id', profile.id);

  if (!credentials || credentials.length === 0) {
    return NextResponse.json(
      { code: 'NO_CREDENTIAL', message: '등록된 생체인증이 없습니다. PIN으로 로그인해주세요' },
      { status: 404 },
    );
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: credentials.map((c) => ({
      id: c.credential_id,
      type: 'public-key',
      transports: c.transports ?? [],
    })),
    userVerification: 'required',
  });

  // 챌린지 저장
  await serverSupabase.from('webauthn_challenges').insert({
    user_id: profile.id,
    challenge: options.challenge,
    type: 'authentication',
  });

  return NextResponse.json({ ...options, userId: profile.id });
}

// ── POST: 인증 검증 ──
export async function POST(req: NextRequest) {
  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' },
      { status: 500 },
    );
  }

  let body: { userId?: string; credential?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '잘못된 요청입니다' },
      { status: 400 },
    );
  }

  const { userId, credential } = body;
  if (!userId || !credential) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '인증 정보가 부족합니다' },
      { status: 400 },
    );
  }

  // 챌린지 조회
  const { data: challengeRow } = await serverSupabase
    .from('webauthn_challenges')
    .select('challenge')
    .eq('user_id', userId)
    .eq('type', 'authentication')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!challengeRow) {
    return NextResponse.json(
      { code: 'CHALLENGE_NOT_FOUND', message: '인증 세션이 만료되었습니다. 다시 시도해주세요' },
      { status: 400 },
    );
  }

  // credential ID로 DB에서 조회
  const credentialId = (credential as { id?: string }).id;
  const { data: storedCred } = await serverSupabase
    .from('webauthn_credentials')
    .select('*')
    .eq('credential_id', credentialId)
    .eq('user_id', userId)
    .single();

  if (!storedCred) {
    return NextResponse.json(
      { code: 'CREDENTIAL_NOT_FOUND', message: '등록되지 않은 인증 정보입니다' },
      { status: 400 },
    );
  }

  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential as unknown as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: storedCred.credential_id,
        publicKey: new Uint8Array(Buffer.from(storedCred.public_key, 'base64')),
        counter: storedCred.counter,
        transports: storedCred.transports ?? [],
      },
    });
  } catch (err) {
    return NextResponse.json(
      { code: 'VERIFICATION_FAILED', message: '생체인증에 실패했습니다', detail: String(err) },
      { status: 400 },
    );
  }

  if (!verification.verified) {
    return NextResponse.json(
      { code: 'VERIFICATION_FAILED', message: '생체인증에 실패했습니다' },
      { status: 400 },
    );
  }

  // 카운터 업데이트
  await serverSupabase
    .from('webauthn_credentials')
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('credential_id', storedCred.credential_id);

  // 챌린지 삭제
  await serverSupabase
    .from('webauthn_challenges')
    .delete()
    .eq('user_id', userId)
    .eq('type', 'authentication');

  // 프로필 조회 → JWT 발급
  const profile = await getProfileById(userId);
  if (!profile) {
    return NextResponse.json(
      { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다' },
      { status: 404 },
    );
  }

  const token = await createToken({
    sub: profile.id,
    sabun: profile.sabun,
    name: profile.name,
    personId: profile.person_id,
    role: profile.role,
  });

  await auditLog(profile.id, profile.name, 'login_webauthn', {
    ip: getClientIP(req),
  });

  const res = NextResponse.json({
    success: true,
    user: {
      id: profile.id,
      name: profile.name,
      sabun: profile.sabun,
      personId: profile.person_id,
      role: profile.role,
      mustChangePin: profile.must_change_pin,
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
