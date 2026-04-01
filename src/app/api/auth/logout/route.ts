import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/jwt';
import { getSessionUser, auditLog, getClientIP } from '@/lib/authServer';

// ── POST: 로그아웃 ──
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);

  if (user) {
    await auditLog(user.sub, user.name, 'logout', {
      ip: getClientIP(req),
    });
  }

  const res = NextResponse.json({ success: true });

  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // 즉시 삭제
  });

  return res;
}
