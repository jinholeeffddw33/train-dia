import { NextRequest, NextResponse } from 'next/server';

const SEOUL_API = 'http://swopenAPI.seoul.go.kr/api/subway';

/**
 * GET /api/realtime/arrivals?station=답십리&count=30
 * 역별 실시간 도착 정보
 */
export async function GET(request: NextRequest) {
  const key = process.env.SEOUL_API_KEY;
  if (!key) {
    return NextResponse.json(
      { code: 'CONFIG_ERROR', message: 'API 키가 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  const { searchParams } = request.nextUrl;
  const station = searchParams.get('station');
  const count = Math.min(Number(searchParams.get('count') ?? 30), 30);

  if (!station) {
    return NextResponse.json(
      { code: 'MISSING_PARAM', message: 'station 파라미터가 필요합니다.' },
      { status: 400 },
    );
  }

  const url = `${SEOUL_API}/${key}/json/realtimeStationArrival/0/${count}/${encodeURIComponent(station)}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 20 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { code: 'UPSTREAM_ERROR', message: `서울시 API 응답 오류 (${res.status})` },
        { status: 502 },
      );
    }

    const data = await res.json();

    // 서울시 API는 성공(INFO-000)에도 errorMessage를 반환한다.
    // 실제 에러(심야 등)만 빈 배열로 처리.
    const errCode = data.errorMessage?.code;
    if (errCode && errCode !== 'INFO-000') {
      return NextResponse.json({ arrivals: [], message: data.errorMessage.message });
    }

    const arrivals = (data.realtimeArrivalList ?? []).map((a: Record<string, string>) => ({
      subwayId: a.subwayId,
      direction: a.updnLine,
      destination: a.bstatnNm,
      trainLine: a.trainLineNm,
      arrivalMsg: a.arvlMsg2,
      currentStation: a.arvlMsg3,
      arrivalSec: Number(a.barvlDt) || 0,
      trainNo: a.btrainNo,
      trainType: a.btrainSttus,
      isLast: a.lstcarAt === '1',
    }));

    return NextResponse.json({ arrivals });
  } catch {
    return NextResponse.json(
      { code: 'TIMEOUT', message: '도착 정보 조회 시간 초과' },
      { status: 504 },
    );
  }
}
