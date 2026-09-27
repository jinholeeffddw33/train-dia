import { NextResponse } from 'next/server';
import { APP_VERSION, BUILD_ID } from '@/lib/constants';

// 현재 "배포된" 앱 버전을 그대로 알려준다.
// 사용자의 앱(캐시된 옛 번들)이 자신에 박힌 BUILD_ID 와 이 값을 비교해
// 다르면 "최신이 아님"을 감지한다. SW는 /api/* 를 우회하므로 항상 라이브 응답.
// build 는 배포마다 바뀌고, version 은 화면 표시용이다.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { version: APP_VERSION, build: BUILD_ID },
    { headers: { 'Cache-Control': 'no-store, must-revalidate' } },
  );
}
