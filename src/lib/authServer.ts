import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyToken, COOKIE_NAME, type TokenPayload } from './jwt';
import { serverSupabase } from './serverSupabase';

// ─── PIN 해시 ───
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// ─── 세션 쿠키에서 사용자 가져오기 ───
export async function getSessionUser(req?: NextRequest): Promise<TokenPayload | null> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get(COOKIE_NAME)?.value;
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get(COOKIE_NAME)?.value;
  }

  if (!token) return null;
  return verifyToken(token);
}

// ─── 인증 필수 API 헬퍼 ───
export async function requireAuth(req: NextRequest): Promise<TokenPayload | NextResponse> {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 },
    );
  }
  return user;
}

// ─── 감사 로그 ───
export async function auditLog(
  userId: string,
  userName: string,
  action: string,
  opts?: { targetType?: string; targetId?: string; metadata?: Record<string, unknown>; ip?: string },
) {
  if (!serverSupabase) return;
  await serverSupabase.from('audit_log').insert({
    user_id: userId,
    user_name: userName,
    action,
    target_type: opts?.targetType ?? null,
    target_id: opts?.targetId ?? null,
    metadata: opts?.metadata ?? null,
    ip_address: opts?.ip ?? null,
  });
}

// ─── 사번으로 프로필 조회 ───
export async function getProfileBySabun(sabun: string) {
  if (!serverSupabase) return null;
  const { data } = await serverSupabase
    .from('driver_profiles')
    .select('*')
    .eq('sabun', sabun)
    .eq('is_active', true)
    .single();
  return data;
}

// ─── UUID로 프로필 조회 ───
export async function getProfileById(id: string) {
  if (!serverSupabase) return null;
  const { data } = await serverSupabase
    .from('driver_profiles')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();
  return data;
}

// ─── IP 주소 추출 ───
export function getClientIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}
