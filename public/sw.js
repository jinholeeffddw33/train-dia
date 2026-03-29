// ===== 기관사 DIA v2 Service Worker =====

const CACHE_NAME = 'dia-v2.3-cache';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// 설치: 정적 자산 캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 활성화: 이전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: 네트워크 우선, 실패 시 캐시 (교번 데이터는 번들에 포함)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 요청은 네트워크 only (실시간 데이터)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 성공하면 캐시 업데이트
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // 오프라인이면 캐시에서 반환
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // 페이지 요청이면 메인 캐시 반환
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('오프라인', { status: 503 });
        });
      })
  );
});

// 업데이트 알림
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
