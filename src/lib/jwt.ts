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

const TOKEN_MAX_AGE = 24 * 60 * 60; // 24시간 (초)

export async function createToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_MAX_AGE}s`)
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
export const COOKIE_MAX_AGE = TOKEN_MAX_AGE;
