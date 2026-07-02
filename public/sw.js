// ===== 기관사 DIA v2 Service Worker =====

const CACHE_NAME = 'dia-v2.5-cache';
const MEDIA_CACHE = 'dia-v2.5-media';
const MEDIA_MAX_ENTRIES = 60;
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// 설치: 정적 자산 캐시
// ★ skipWaiting()은 여기서 호출하지 않는다 — useServiceWorker 훅의 게이트
//   (6h stale 자동적용 + 업데이트 토스트 + SKIP_WAITING 메시지)가 적용 시점을 결정한다.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// 활성화: 이전 캐시 정리 (현재 버전 캐시 2개는 유지)
self.addEventListener('activate', (event) => {
  const KEEP = [CACHE_NAME, MEDIA_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)))
    )
  );
  // 첫 설치 시 제어권 확보용 — 클라이언트 controllerchange 핸들러가 첫 설치는 reload 하지 않게 가드함
  self.clients.claim();
});

// 미디어 캐시 상한 — 오래된 것부터 삭제 (간단 FIFO: keys()는 삽입 순서)
function trimMediaCache() {
  return caches.open(MEDIA_CACHE)
    .then((cache) =>
      cache.keys().then((keys) => {
        if (keys.length <= MEDIA_MAX_ENTRIES) return undefined;
        const excess = keys.slice(0, keys.length - MEDIA_MAX_ENTRIES);
        return Promise.all(excess.map((k) => cache.delete(k)));
      })
    )
    .catch(() => { /* ignore */ });
}

// Fetch 전략 (교번 데이터는 번들에 포함)
//  - /_next/static/  : cache-first (해시 파일명 = 불변, 캐시 히트 시 네트워크 안 감)
//  - navigate/manifest/아이콘 : network-first → 코어 캐시
//  - 나머지(audio/pdf/이미지 등 대형) : network-first → 미디어 캐시(상한 60, FIFO)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache API는 http(s)만 지원 — chrome-extension:// 등은 즉시 통과
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // API 요청은 네트워크 only (실시간 데이터)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // GET 외에는 캐시 개입 없음
  if (request.method !== 'GET') {
    return;
  }

  // ── 불변 빌드 자산: cache-first ──
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, clone))
              .catch(() => { /* ignore */ });
          }
          return response;
        });
      })
    );
    return;
  }

  // 코어(HTML 내비게이션·manifest·아이콘)는 메인 캐시, 나머지는 미디어 캐시(상한)
  const isCore =
    request.mode === 'navigate' ||
    url.pathname === '/manifest.json' ||
    url.pathname.startsWith('/favicon') ||
    url.pathname.startsWith('/icons/');

  event.respondWith(
    fetch(request)
      .then((response) => {
        // 성공하면 캐시 업데이트 (오류는 무시 — 캐시 실패가 응답을 막지 않도록)
        if (response.ok) {
          const clone = response.clone();
          if (isCore) {
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, clone))
              .catch(() => { /* ignore — partial response 등 */ });
          } else {
            caches.open(MEDIA_CACHE)
              .then((cache) => cache.put(request, clone).then(trimMediaCache))
              .catch(() => { /* ignore — partial response 등 */ });
          }
        }
        return response;
      })
      .catch(() => {
        // 오프라인이면 캐시에서 반환 (caches.match는 모든 캐시를 탐색)
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // 페이지 요청이면 메인 캐시 반환
          if (request.mode === 'navigate') {
            return caches.match('/').then((home) => home || new Response('오프라인', { status: 503 }));
          }
          return new Response('오프라인', { status: 503 });
        });
      })
  );
});

// ── Web Push 수신 ──
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); } catch { payload = { title: '알림', body: event.data.text() }; }

  const title = payload.title || '기관사 DIA';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [300, 200, 300, 200, 300],
    data: { url: payload.url || '/' },
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── 알림 클릭 → 앱 열기 ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// 업데이트 알림
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
