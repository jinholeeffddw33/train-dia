import { NextRequest, NextResponse } from 'next/server';

const ODSAY_API = 'https://api.odsay.com/v1/api';

/**
 * GET /api/odsay/search-station?name=강남
 * ODsay 역 ID 조회
 */
export async function GET(request: NextRequest) {
  const key = process.env.ODSAY_API_KEY;
  if (!key) {
    return NextResponse.json(
      { code: 'CONFIG_ERROR', message: 'ODsay API 키가 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  const name = request.nextUrl.searchParams.get('name');
  if (!name) {
    return NextResponse.json(
      { code: 'MISSING_PARAM', message: 'name 파라미터가 필요합니다.' },
      { status: 400 },
    );
  }

  const url = `${ODSAY_API}/searchStation?lang=0&stationName=${encodeURIComponent(name)}&stationClass=2&apiKey=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Referer: 'https://dia5.kr' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { code: 'UPSTREAM_ERROR', message: `ODsay API 응답 오류 (${res.status})` },
        { status: 502 },
      );
    }

    const data = await res.json();

    // ODsay API 에러 응답 처리 (인증 실패 등)
    if (data.error) {
      const errMsg = data.error[0]?.message ?? 'ODsay API 오류';
      const isAuthError = errMsg.includes('ApiKey');
      return NextResponse.json(
        {
          code: isAuthError ? 'AUTH_ERROR' : 'UPSTREAM_ERROR',
          message: isAuthError
            ? 'ODsay API 인증에 실패했습니다. API 키를 확인하세요.'
            : `ODsay API 오류: ${errMsg}`,
        },
        { status: isAuthError ? 401 : 502 },
      );
    }

    // 서울권 지하철만 필터
    const stations = (data.result?.station ?? [])
      .filter((s: Record<string, number>) => s.stationClass === 2 && s.CID === 1000)
      .map((s: Record<string, string | number>) => ({
        name: s.stationName,
        id: s.stationID,
      }));

    return NextResponse.json({ stations });
  } catch {
    return NextResponse.json(
      { code: 'TIMEOUT', message: '역 검색 시간 초과' },
      { status: 504 },
    );
  }
}
