import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/authServer';

// ── GET: 현재 로그인된 사용자 정보 ──
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);

  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: user.sub,
      name: user.name,
      sabun: user.sabun,
      personId: user.personId,
      role: user.role,
    },
  });
}
