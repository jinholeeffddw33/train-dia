'use client';

import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    // iPadOS 13+ 는 UA 가 Mac 으로 위장 — 멀티터치 Mac = iPad 로 판정
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/.test(ua));
    const android = /Android/.test(ua);
    setIsIOS(ios);
    setIsAndroid(android);

    // 이미 설치됐는지 확인 (standalone — Android + iOS 공통)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
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
    install,
  };
}
