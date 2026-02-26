import type { Metadata, Viewport } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--dia-font',
});

export const metadata: Metadata = {
  title: '기관사 DIA — 답십리 5호선',
  description: '서울교통공사 5호선 답십리 승무사업소 기관사 교번 조회',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '기관사DIA',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#F0F4F8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={notoSansKR.variable}>
      <head>
        {/* 다크모드 FOUC 방지: hydration 전에 즉시 실행 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=JSON.parse(localStorage.getItem('dia-theme')||'{}');if(t&&t.state&&t.state.theme==='dark'){return}document.documentElement.classList.add('light')}catch(e){document.documentElement.classList.add('light')}})()`,
          }}
        />
      </head>
      <body className={notoSansKR.className}>{children}</body>
    </html>
  );
}
