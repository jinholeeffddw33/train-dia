import { NextRequest, NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from '@simplewebauthn/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth, auditLog, getClientIP } from '@/lib/authServer';

const RP_NAME = '기관사 DIA';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

// ── GET: 등록 옵션 생성 ──
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' },
      { status: 500 },
    );
  }

  // 기존 credential 조회 (중복 등록 방지)
  const { data: existingCreds } = await serverSupabase
    .from('webauthn_credentials')
    .select('credential_id')
    .eq('user_id', user.sub);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.sabun,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.sub),
    attestationType: 'none',
    excludeCredentials: (existingCreds ?? []).map((c) => ({
      id: c.credential_id,
      type: 'public-key',
    })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // 내장 생체인증만
      userVerification: 'required',
      residentKey: 'preferred',
    },
  });

  // 챌린지 저장
  await serverSupabase.from('webauthn_challenges').insert({
    user_id: user.sub,
    challenge: options.challenge,
    type: 'registration',
  });

  return NextResponse.json(options);
}

// ── POST: 등록 검증 ──
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  if (!serverSupabase) {
    return NextResponse.json(
      { code: 'DB_NOT_CONFIGURED', message: 'DB 설정이 없습니다' },
      { status: 500 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '잘못된 요청입니다' },
      { status: 400 },
    );
  }

  // 저장된 챌린지 조회
  const { data: challengeRow } = await serverSupabase
    .from('webauthn_challenges')
    .select('challenge')
    .eq('user_id', user.sub)
    .eq('type', 'registration')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!challengeRow) {
    return NextResponse.json(
      { code: 'CHALLENGE_NOT_FOUND', message: '등록 세션이 만료되었습니다. 다시 시도해주세요' },
      { status: 400 },
    );
  }

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (err) {
    return NextResponse.json(
      { code: 'VERIFICATION_FAILED', message: '생체인증 등록에 실패했습니다', detail: String(err) },
      { status: 400 },
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json(
      { code: 'VERIFICATION_FAILED', message: '생체인증 등록에 실패했습니다' },
      { status: 400 },
    );
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  // credential 저장
  await serverSupabase.from('webauthn_credentials').insert({
    credential_id: credential.id,
    user_id: user.sub,
    public_key: Buffer.from(credential.publicKey).toString('base64'),
    counter: credential.counter,
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
    transports: (body as { response?: { transports?: string[] } }).response?.transports ?? [],
  });

  // 챌린지 삭제
  await serverSupabase
    .from('webauthn_challenges')
    .delete()
    .eq('user_id', user.sub)
    .eq('type', 'registration');

  await auditLog(user.sub, user.name, 'webauthn_register', {
    metadata: { deviceType: credentialDeviceType },
    ip: getClientIP(req),
  });

  return NextResponse.json({ success: true });
}
