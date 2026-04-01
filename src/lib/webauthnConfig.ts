import type { NextRequest } from 'next/server';

export const RP_NAME = '기관사 DIA';

/**
 * 요청 헤더에서 RP_ID와 Origin을 자동 감지
 * 환경변수보다 실제 접속 도메인을 우선 사용 — 도메인 불일치 에러 방지
 */
export function getRpConfig(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost';
  const rpId = host.split(':')[0]; // 포트 번호 제거 (localhost:3000 → localhost)
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const origin = `${proto}://${host}`;

  return { rpId, origin };
}
