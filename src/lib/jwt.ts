import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export interface TokenPayload extends JWTPayload {
  sub: string;       // driver_profiles.id (UUID)
  sabun: string;
  name: string;
  personId: string;  // cycle.ts의 I
  role: 'driver' | 'admin';
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const secret = new TextEncoder().encode(JWT_SECRET);

/**
 * 기본 세션: 24시간.
 * 원래 이름은 TOKEN_MAX_AGE_BIOMETRIC 이었다 — 생체인증(WebAuthn)을 걷어내면서(2026-08-18)
 * 이름만 바꿨다. **값과 쓰임은 그대로다**: createToken 의 기본 만료이자 COOKIE_MAX_AGE 라서
 * 상수를 지웠으면 세션 정책이 조용히 바뀌었을 자리다.
 */
export const TOKEN_MAX_AGE_DEFAULT = 24 * 60 * 60;
/** PIN 로그인 세션: 365일 */
export const TOKEN_MAX_AGE_PIN = 365 * 24 * 60 * 60;

export async function createToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  maxAge: number = TOKEN_MAX_AGE_DEFAULT,
): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

export const COOKIE_NAME = 'traindia_session';
/** @deprecated createToken의 maxAge 인자로 전달할 것 */
export const COOKIE_MAX_AGE = TOKEN_MAX_AGE_DEFAULT;
