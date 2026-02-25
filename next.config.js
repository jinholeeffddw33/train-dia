/** @type {import('next').NextConfig} */
const nextConfig = {
  // 정적 빌드 (Vercel 서버리스와 호환 + 필요시 GitHub Pages 폴백)
  output: 'standalone',

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
