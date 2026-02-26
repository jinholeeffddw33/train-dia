import { NextResponse } from 'next/server';

const SEOUL_API = 'http://swopenAPI.seoul.go.kr/api/subway';

/**
 * GET /api/realtime/trains
 * 5호선 실시간 열차 위치
 */
export async function GET() {
  const key = process.env.SEOUL_API_KEY;
  if (!key) {
    return NextResponse.json(
      { code: 'CONFIG_ERROR', message: 'API 키가 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  const url = `${SEOUL_API}/${key}/json/realtimePosition/0/100/5호선`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 20 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { code: 'UPSTREAM_ERROR', message: `서울시 API 응답 오류 (${res.status})` },
        { status: 502 },
      );
    }

    const data = await res.json();

    // 에러 응답 처리 (심야 등 열차 없음)
    if (data.errorMessage) {
      return NextResponse.json({ trains: [], message: data.errorMessage.message });
    }

    const trains = (data.realtimePositionList ?? []).map((t: Record<string, string>) => ({
      trainNo: t.trainNo,
      station: t.statnNm?.replace(/역$/, '').replace(/\(.*\)/, ''),
      destination: t.statnTnm,
      direction: t.updnLine === '0' || t.updnLine === '상행' ? 'up' : 'down',
      status: t.trainSttus,
    }));

    return NextResponse.json({ trains });
  } catch {
    return NextResponse.json(
      { code: 'TIMEOUT', message: '열차 위치 조회 시간 초과' },
      { status: 504 },
    );
  }
}
