import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/jwt';
import { isGuest } from '@/lib/guestAccount';

/**
 * 체험 계정(사번 1234)은 둘러보기만 한다 — 글쓰기·수정·삭제·제출을 한곳에서 막는다.
 *
 * 왜 route 마다가 아니라 여기서:
 *  · 안전 게시판 쓰기 route 는 세션 쿠키가 아니라 폼의 이름·사번으로 사람을 가린다.
 *    체험 계정 화면은 그날 5다이아 기관사의 자리를 빌려 쓰므로, 폼만 믿으면
 *    그 기관사 이름으로 글이 올라갈 수 있다. 쿠키의 사번은 속일 수 없다.
 *  · 새 쓰기 route 가 생겨도 따로 챙기지 않아도 막힌다.
 *
 * 막지 않는 것: 로그인·로그아웃, 레일봇 검색(POST 지만 읽기), 읽음·조회·방문 표시.
 * 읽음 표시는 집계에서 체험 계정을 빼므로(safetyReaders) 남아도 수치를 흐리지 않는다.
 */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const GUEST_ALLOWED: RegExp[] = [
  /^\/api\/auth\/(login|logout)$/,
  /^\/api\/edu\/railbot$/,
  /^\/api\/edu\/video-views$/,
  /^\/api\/stats$/,
  /^\/api\/rollcall\/reads$/,
  /^\/api\/safety\/hazards\/[^/]+\/(reads|views)$/,
  /^\/api\/standby-coverage\/[^/]+\/read$/,
];

export async function middleware(req: NextRequest) {
  if (!WRITE_METHODS.has(req.method)) return NextResponse.next();

  const path = req.nextUrl.pathname;
  if (GUEST_ALLOWED.some((re) => re.test(path))) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.next();

  const user = await verifyToken(token);
  if (!isGuest(user?.sabun)) return NextResponse.next();

  return NextResponse.json(
    { code: 'GUEST_READ_ONLY', message: '체험 계정은 둘러보기만 할 수 있어요' },
    { status: 403 },
  );
}

export const config = {
  matcher: '/api/:path*',
};
