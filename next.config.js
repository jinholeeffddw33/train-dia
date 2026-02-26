const path = require('path');

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
  },
};

module.exports = nextConfig;
