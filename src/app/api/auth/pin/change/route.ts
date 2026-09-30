import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth, verifyPin, hashPin, auditLog, getClientIP } from '@/lib/authServer';

// ── POST: PIN 설정/변경 ──
// firstSetup=true: 최초 PIN 설정 (currentPin 불필요)
// firstSetup=false: 기존 PIN 변경 (currentPin 필수)
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

  let body: { currentPin?: string; newPin?: string; firstSetup?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '잘못된 요청입니다' },
      { status: 400 },
    );
  }

  const { currentPin, newPin, firstSetup } = body;

  if (!newPin) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '새 PIN을 입력해주세요' },
      { status: 400 },
    );
  }

  // 숫자 4~10자리 — 로그인·설정 화면의 안내와 같은 규칙(화면에서도 숫자만 받는다)
  if (!/^\d{4,10}$/.test(newPin)) {
    return NextResponse.json(
      { code: 'PIN_INVALID', message: 'PIN은 숫자 4~10자리로 정해주세요' },
      { status: 400 },
    );
  }

  const { data: profile } = await serverSupabase
    .from('driver_profiles')
    .select('pin_hash, must_change_pin')
    .eq('id', user.sub)
    .single();

  if (!profile) {
    return NextResponse.json(
      { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다' },
      { status: 404 },
    );
  }

  // 최초 PIN 설정이 아닌 경우 → 현재 PIN 검증 필수
  if (!firstSetup || !profile.must_change_pin) {
    if (!currentPin) {
      return NextResponse.json(
        { code: 'MISSING_FIELDS', message: '현재 PIN을 입력해주세요' },
        { status: 400 },
      );
    }
    const valid = await verifyPin(currentPin, profile.pin_hash);
    if (!valid) {
      return NextResponse.json(
        { code: 'WRONG_PIN', message: '현재 PIN이 일치하지 않습니다' },
        { status: 401 },
      );
    }
  }

  // 새 PIN 저장
  const newHash = await hashPin(newPin);
  await serverSupabase
    .from('driver_profiles')
    .update({ pin_hash: newHash, must_change_pin: false })
    .eq('id', user.sub);

  await auditLog(user.sub, user.name, firstSetup ? 'pin_first_setup' : 'pin_change', {
    ip: getClientIP(req),
  });

  return NextResponse.json({ success: true });
}
