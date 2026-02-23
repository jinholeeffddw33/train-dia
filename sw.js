// Service Worker — 오프라인 지원 + 자동 업데이트
const CACHE_NAME = 'dia-v65';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.js',
  './subway.js',
  './manifest.json',
  './logo.png'
];

// 설치 — 핵심 파일 캐시
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 활성화 — 이전 캐시 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 요청 — 네트워크 우선 (3초 타임아웃), 실패/지연 시 캐시 폴백
self.addEventListener('fetch', e => {
  // 외부 CDN 요청은 SW가 관여하지 않음 (Supabase 등)
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    Promise.race([
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      }),
      new Promise((_, reject) => setTimeout(reject, 3000))
    ]).catch(() => caches.match(e.request))
  );
});
