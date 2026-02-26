import { NextRequest, NextResponse } from 'next/server';

const ODSAY_API = 'https://api.odsay.com/v1/api';

/**
 * GET /api/odsay/route-search?sid=230&eid=112&mode=1&day=1&time=0830
 * ODsay 지하철 경로 검색
 *
 * mode: 1=출발기준, 3=첫차, 4=막차
 * day: 1=평일, 2=토요일, 3=일요일/공휴일
 * time: HHMM (예: 0830)
 */
export async function GET(request: NextRequest) {
  const key = process.env.ODSAY_API_KEY;
  if (!key) {
    return NextResponse.json(
      { code: 'CONFIG_ERROR', message: 'ODsay API 키가 설정되지 않았습니다.' },
      { status: 500 },
    );
  }

  const { searchParams } = request.nextUrl;
  const sid = searchParams.get('sid');
  const eid = searchParams.get('eid');
  const mode = searchParams.get('mode') ?? '1';
  const day = searchParams.get('day') ?? '1';
  const time = searchParams.get('time') ?? '';

  if (!sid || !eid) {
    return NextResponse.json(
      { code: 'MISSING_PARAM', message: 'sid, eid 파라미터가 필요합니다.' },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    SID: sid,
    EID: eid,
    MODE: mode,
    DAY: day,
    TIME: time,
    apiKey: key,
  });

  const url = `${ODSAY_API}/subwayPathSchedule?${params}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
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

    if (!data.result?.path) {
      return NextResponse.json({ paths: [], message: '경로를 찾을 수 없습니다.' });
    }

    const paths = data.result.path.map((p: Record<string, unknown>) => {
      const info = p.info as Record<string, unknown>;
      const subPaths = (p.subPath as Record<string, unknown>[]) ?? [];

      return {
        totalTime: info.totalTime,
        travelTime: info.subwayTravelTime,
        walkTime: info.exchangeWalkTime,
        distance: info.subwayTravelDistance,
        stationCount: info.stationCount,
        transfers: info.transferCount,
        fare: info.cardFare,
        departure: info.departureTime,
        arrival: info.arrivalTime,
        segments: subPaths.map((sp) => {
          if (sp.movingType === 2) {
            return {
              type: 'transfer' as const,
              time: sp.sectionTime,
              departure: sp.departureTime,
              arrival: sp.arrivalTime,
            };
          }
          return {
            type: 'ride' as const,
            laneId: sp.laneID,
            from: sp.startName,
            to: sp.endName,
            departure: sp.departureTime,
            arrival: sp.arrivalTime,
            time: sp.sectionTime,
            stopCount: sp.stopStationCount,
            destination: sp.wayName,
            isExpress: sp.isExpressLane === 'Y',
            fastTrain: sp.fastTrain,
            fastDoor: sp.fastDoor,
            prevTrain: sp.prevTrain,
            nextTrain: sp.nextTrain,
            stations: (sp.passStopList as Record<string, unknown>)?.stations,
          };
        }),
      };
    });

    return NextResponse.json({ paths });
  } catch {
    return NextResponse.json(
      { code: 'TIMEOUT', message: '경로 검색 시간 초과' },
      { status: 504 },
    );
  }
}
