import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/constants';

// 현재 "배포된" 앱 버전을 그대로 알려준다.
// 사용자의 앱(캐시된 옛 번들)이 자신에 박힌 APP_VERSION 과 이 값을 비교해
// 다르면 "최신이 아님"을 감지한다. SW는 /api/* 를 우회하므로 항상 라이브 응답.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { version: APP_VERSION },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } },
  );
}
