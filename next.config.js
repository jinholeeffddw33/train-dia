const path = require('path');

// 빌드 표식은 한 번만 정한다 — 설정 파일이 빌드 작업자마다 다시 읽혀도 같은 값을 쓰게
// 환경변수에 심어 둔다(작업자는 부모 환경을 물려받는다). Vercel 은 커밋 해시를 쓴다.
process.env.NEXT_PUBLIC_BUILD_ID ||=
  (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || String(Date.now());

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel 서버리스 호환
  output: 'standalone',

  // lockfile 경고 해결
  outputFileTracingRoot: path.join(__dirname),

  // React strict mode
  reactStrictMode: true,

  // 이미지 최적화
  images: {
    unoptimized: false,
  },

  // 환경변수 접두사 (클라이언트 노출용)
  env: {
    NEXT_PUBLIC_APP_VERSION: '2.0.0',
    // 배포마다 바뀌는 빌드 표식 — 서버(/api/version)와 앱 번들에 같은 값이 박힌다.
    // APP_VERSION 은 사람이 올려야 바뀌어서, 올리지 않은 배포는 폰이 새 버전을 알아채지 못했다.
    NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID,
  },
};

module.exports = nextConfig;
