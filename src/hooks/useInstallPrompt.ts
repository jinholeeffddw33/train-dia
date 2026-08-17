'use client';

import { useState, useEffect, useCallback } from 'react';
import { isNativeApp } from '@/lib/native/platform';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    /** layout.tsx 의 <head> 스크립트가 붙잡아 둔 설치 신호 */
    __diaInstallEvt?: BeforeInstallPromptEvent | null;
  }
}

/** 카톡·네이버 등 인앱 웹뷰 — 설치가 원천적으로 안 되므로 Chrome 으로 넘겨야 한다 */
const IN_APP_TOKENS = [
  'KAKAOTALK', 'NAVER', 'Instagram', 'FBAN', 'FBAV', 'FB_IAB', 'FBIOS',
  'Line/', 'BAND', 'Daum', 'KAKAOSTORY', 'everytimeApp', 'wadiz', 'trill', 'TikTok',
];

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    /**
     * ★ 네이티브 앱(Capacitor)이면 여기서 끝낸다 — 이미 "설치된 것"의 최종 형태다.
     *
     * 실측(2026-08-18 Z플립3): 네이티브 WebView 에서 `display-mode: standalone` 은 **false**,
     * `navigator.standalone` 도 undefined 다. 그래서 아래 standalone 판정으로는 앱을 못 알아보고
     * `isInstalled=false` + `isAndroid=true` 가 되어, **앱 안에서 "홈 화면 추가" 타일이 보이고
     * 누르면 설치 안내 모달까지 떴다**(이미 앱인데). 홈 화면의 설치 배너도 같은 이유로 떴다.
     *
     * 판정을 이 훅 한 곳에서 끝내면 소비처(설정 타일·홈 배너·안내 모달)가 전부 따라온다.
     */
    if (isNativeApp()) {
      setIsInstalled(true);
      return;
    }

    const ua = navigator.userAgent;
    // iPadOS 13+ 는 UA 가 Mac 으로 위장 — 멀티터치 Mac = iPad 로 판정
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/.test(ua));
    setIsIOS(ios);
    setIsAndroid(/Android/.test(ua));
    setIsInApp(IN_APP_TOKENS.some((t) => ua.includes(t)));

    // 이미 설치됐는지 확인 (standalone — Android + iOS 공통)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setIsInstalled(true);
      return;
    }

    // <head> 스크립트가 이미 붙잡아 둔 신호가 있으면 바로 사용 (대개 여기서 잡힌다)
    if (window.__diaInstallEvt) setDeferredPrompt(window.__diaInstallEvt);

    // 아직 안 왔으면 도착 알림을 기다린다 (조기 캡처 스크립트가 쏴 준다)
    const onReady = () => setDeferredPrompt(window.__diaInstallEvt ?? null);
    const onInstalled = () => { setDeferredPrompt(null); setIsInstalled(true); };
    window.addEventListener('dia-install-ready', onReady);
    window.addEventListener('dia-installed', onInstalled);
    // 조기 스크립트가 없는 경우(캐시된 옛 HTML 등) 대비 — 직접도 듣는다
    const direct = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', direct);

    return () => {
      window.removeEventListener('dia-install-ready', onReady);
      window.removeEventListener('dia-installed', onInstalled);
      window.removeEventListener('beforeinstallprompt', direct);
    };
  }, []);

  const install = useCallback(async () => {
    const evt = deferredPrompt ?? window.__diaInstallEvt;
    if (!evt) return false;

    await evt.prompt();
    const { outcome } = await evt.userChoice;
    // 신호는 1회용 — 성공이든 취소든 소진된다
    window.__diaInstallEvt = null;
    setDeferredPrompt(null);

    if (outcome === 'accepted') {
      setIsInstalled(true);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    isIOS,
    isAndroid,
    /** 카톡·네이버 등 인앱 웹뷰 — 안내를 'Chrome 으로 열기'로 바꿔야 하는 유일한 경우 */
    isInApp,
    install,
  };
}
