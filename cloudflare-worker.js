// Cloudflare Worker — 서울교통공사 API HTTPS 프록시 (v2)
// 두 가지 백엔드:
//   /api/subway/  → swopenAPI.seoul.go.kr (실시간 도착정보 등)
//   /api/opendata/ → openapi.seoul.go.kr:8088 (경로검색 등)

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    let target;

    if (path.startsWith('/api/opendata/')) {
      // 경로검색(getShtrmPath) 등 — openapi.seoul.go.kr:8088
      // /api/opendata/{KEY}/json/... → http://openapi.seoul.go.kr:8088/{KEY}/json/...
      target = 'http://openapi.seoul.go.kr:8088' + path.replace('/api/opendata/', '/') + url.search;
    } else if (path.startsWith('/api/subway/')) {
      // 실시간 도착정보 등 — swopenAPI.seoul.go.kr
      target = 'http://swopenAPI.seoul.go.kr' + path + url.search;
    } else {
      return new Response('Not Found', { status: 404 });
    }

    try {
      const res = await fetch(target, {
        headers: { 'Accept': 'application/json' },
        cf: { cacheTtl: 20 }
      });

      const data = await res.text();

      return new Response(data, {
        status: res.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=20',
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'proxy_error', message: e.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  }
};
