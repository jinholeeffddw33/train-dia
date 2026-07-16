import type { Metadata, Viewport } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import DevThemeToggle from '@/components/dev/DevThemeToggle';
import GlassTapSweep from '@/components/common/GlassTapSweep';
import ServiceWorkerRegistrar from '@/components/common/ServiceWorkerRegistrar';
import ToastContainer from '@/components/common/Toast';
import Provenance from '@/components/common/Provenance';
import { COPYRIGHT_NOTICE, COPYRIGHT_OWNER, WATERMARK } from '@/lib/provenance';

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
  // icons 명시 제거 — src/app/icon.png + apple-icon.png 파일 컨벤션이 자동 처리 (기존 /favicon.ico 는 404였음)
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '기관사DIA',
  },
  // 저작권·원작 지문 — 서빙되는 HTML <head> 에 각인(무단복제 판별). @/lib/provenance
  authors: [{ name: COPYRIGHT_OWNER }],
  other: {
    copyright: COPYRIGHT_NOTICE,
    'x-traindia-wm': WATERMARK,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0F172A',
  // 키보드가 뜨면 뷰포트를 리사이즈 — sticky 입력바/CTA 가 키보드 뒤에 깔리는 것 방지
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={notoSansKR.variable} suppressHydrationWarning>
      <head>
        {/* 다크모드 + 글자 크기 FOUC 방지: hydration 전에 즉시 실행 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('dia-theme');if(t==='light'){d.classList.add('light')}else if(t&&t.charAt(0)==='{'){var p=JSON.parse(t);if(p&&p.state&&p.state.theme==='light'){d.classList.add('light');localStorage.setItem('dia-theme','light')}}var f=JSON.parse(localStorage.getItem('dia-font-size')||'{}');if(f&&f.state&&f.state.size){var s=f.state.size;if(s==='small')d.classList.add('font-small');else if(s==='large')d.classList.add('font-large');else if(s==='xlarge')d.classList.add('font-xlarge')}if(d.classList.contains('light')){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','#F0F4F8')}}catch(e){}})()`,
          }}
        />
        {/*
          설치 신호(beforeinstallprompt) 조기 캡처 — hydration 전에 실행돼야 한다.
          Chrome 은 이 신호를 딱 한 번 보내는데, useEffect 로 듣기 시작하면 이미 지나간 뒤라
          영영 놓친다. 놓치면 '홈 화면에 추가하기'가 진짜 설치창 대신 안내 팝업으로 빠졌다.
          여기서 붙잡아 두면 useInstallPrompt 가 나중에 꺼내 쓸 수 있다.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{window.__diaInstallEvt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__diaInstallEvt=e;window.dispatchEvent(new Event('dia-install-ready'))});window.addEventListener('appinstalled',function(){window.__diaInstallEvt=null;window.dispatchEvent(new Event('dia-installed'))})}catch(e){}})()`,
          }}
        />
      </head>
      <body className={notoSansKR.className}>
        {/* 원작 지문 각인 + 무단 호스트 감지(킬 스위치) — @/lib/provenance, @/lib/originGuard */}
        <Provenance />
        {children}
        <ServiceWorkerRegistrar />
        <GlassTapSweep />
        <DevThemeToggle />
        {/* 전역 토스트 — AppShell(근무 월드) 밖 안전/생활/대기 월드에서도 showToast 동작 */}
        <ToastContainer />
      </body>
    </html>
  );
}
