'use client';

import { useEffect, useState } from 'react';

// 페북/카톡/네이버/인스타/라인/밴드/다음 등 주요 인앱 웹뷰 식별 토큰
const IN_APP_TOKENS = [
  'KAKAOTALK',
  'NAVER',
  'Instagram',
  'FBAN',
  'FBAV',
  'FB_IAB',
  'FBIOS',
  'Line/',
  'BAND',
  'Daum',
  'KAKAOSTORY',
  'everytimeApp',
  'wadiz',
  'trill',
  'TikTok',
];

function detect(ua: string) {
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const inApp = IN_APP_TOKENS.some((t) => ua.includes(t));
  return { isIOS, isAndroid, inApp };
}

export interface InAppInfo {
  ready: boolean;
  inApp: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

export function useInAppBrowser(): InAppInfo {
  const [info, setInfo] = useState<InAppInfo>({
    ready: false,
    inApp: false,
    isIOS: false,
    isAndroid: false,
  });

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const d = detect(ua);
    setInfo({ ready: true, inApp: d.inApp, isIOS: d.isIOS, isAndroid: d.isAndroid });
  }, []);

  return info;
}

// 외부에서도 쓸 수 있게 헬퍼 export
export function openInChrome(): void {
  if (typeof window === 'undefined') return;
  const ua = navigator.userAgent || '';
  const { host, pathname, search } = window.location;

  if (/Android/.test(ua)) {
    // Android: Chrome intent — 크롬 미설치면 Play 스토어로 fallback
    window.location.href =
      `intent://${host}${pathname}${search}` +
      `#Intent;scheme=https;package=com.android.chrome;` +
      `S.browser_fallback_url=${encodeURIComponent(
        'https://play.google.com/store/apps/details?id=com.android.chrome'
      )};end`;
    return;
  }

  if (/iPhone|iPad|iPod/.test(ua)) {
    // iOS: Chrome 앱 scheme. 미설치면 아무 일도 안 일어나므로 호출 후 폴백 안내가 필요.
    const url = `googlechromes://${host}${pathname}${search}`;
    window.location.href = url;
    return;
  }

  // 기타: 현재 URL 그대로 새 창
  window.open(`https://${host}${pathname}${search}`, '_blank', 'noopener,noreferrer');
}
