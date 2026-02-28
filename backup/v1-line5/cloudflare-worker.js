// Cloudflare Worker — API HTTPS 프록시 (v3)
// 세 가지 백엔드:
//   /api/subway/  → swopenAPI.seoul.go.kr (실시간 도착정보)
//   /api/opendata/ → openapi.seoul.go.kr:8088 (레거시 경로검색)
//   /api/odsay/*   → api.odsay.com (ODsay 지하철 경로검색)

const ODSAY_KEY = 'IzzA/5DUELruztg3iXTMeA';

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
    let extraHeaders = { 'Accept': 'application/json' };

    if (path.startsWith('/api/odsay/')) {
      // ODsay 지하철 경로검색 — api.odsay.com
      // /api/odsay/subwayPathSchedule?SID=230&EID=112&... → https://api.odsay.com/v1/api/subwayPathSchedule?...&apiKey=KEY
      const apiPath = path.replace('/api/odsay/', '');
      const params = new URLSearchParams(url.search);
      params.set('apiKey', ODSAY_KEY);
      target = 'https://api.odsay.com/v1/api/' + apiPath + '?' + params.toString();
      extraHeaders['Referer'] = 'https://dia5.kr/';
    } else if (path.startsWith('/api/opendata/')) {
      target = 'http://openapi.seoul.go.kr:8088' + path.replace('/api/opendata/', '/') + url.search;
    } else if (path.startsWith('/api/subway/')) {
      target = 'http://swopenAPI.seoul.go.kr' + path + url.search;
    } else {
      return new Response('Not Found', { status: 404 });
    }

    try {
      const res = await fetch(target, {
        headers: extraHeaders,
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
