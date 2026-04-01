import { NextRequest, NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/serverSupabase';
import { requireAuth, verifyPin, hashPin, auditLog, getClientIP } from '@/lib/authServer';

// ── POST: PIN 변경 ──
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

  let body: { currentPin?: string; newPin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '잘못된 요청입니다' },
      { status: 400 },
    );
  }

  const { currentPin, newPin } = body;
  if (!currentPin || !newPin) {
    return NextResponse.json(
      { code: 'MISSING_FIELDS', message: '현재 PIN과 새 PIN을 입력해주세요' },
      { status: 400 },
    );
  }

  if (newPin.length < 6) {
    return NextResponse.json(
      { code: 'PIN_TOO_SHORT', message: 'PIN은 6자리 이상이어야 합니다' },
      { status: 400 },
    );
  }

  // 현재 PIN 검증
  const { data: profile } = await serverSupabase
    .from('driver_profiles')
    .select('pin_hash')
    .eq('id', user.sub)
    .single();

  if (!profile) {
    return NextResponse.json(
      { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다' },
      { status: 404 },
    );
  }

  const valid = await verifyPin(currentPin, profile.pin_hash);
  if (!valid) {
    return NextResponse.json(
      { code: 'WRONG_PIN', message: '현재 PIN이 일치하지 않습니다' },
      { status: 401 },
    );
  }

  // 새 PIN 해시 저장
  const newHash = await hashPin(newPin);
  await serverSupabase
    .from('driver_profiles')
    .update({ pin_hash: newHash, must_change_pin: false })
    .eq('id', user.sub);

  await auditLog(user.sub, user.name, 'pin_change', {
    ip: getClientIP(req),
  });

  return NextResponse.json({ success: true });
}
