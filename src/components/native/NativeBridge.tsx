'use client';

import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { hasOpenBackHandler } from '@/hooks/useHistoryBack';
import { isNativeApp, isNativeAndroid, isNativeIOS } from '@/lib/native/platform';
import { useThemeStore } from '@/stores/theme';
import { showToast } from '@/stores/toast';

/**
 * 네이티브 셸 배선 — layout 에 한 번만 마운트한다 (2026-08-18).
 *
 * 웹에서는 통째로 no-op 이다. 브라우저·PWA 사용자는 이 컴포넌트가 아무 일도 안 한다.
 *
 * 여기서 다루는 것 4가지 — 전부 "안 하면 앱이 망가지는" 것들이다:
 *   1. 스플래시 내리기   — launchAutoHide:false 라 우리가 안 내리면 **영원히 안 사라진다**
 *   2. 하드웨어 뒤로가기 — 안드로이드 기본값은 "더 물러날 곳 없으면 즉시 종료"
 *   3. 상태바           — 안 맞추면 다크 배경 위에 검은 글씨(또는 반대)로 시각이 죽는다
 *   4. 키보드 리사이즈   — 입력창이 키보드 뒤에 깔리는 사고 방지
 *
 * ⚠️ 플러그인은 **정적 import** 한다. Capacitor 플러그인은 번들 시점에 등록돼야 해서
 *   dynamic import 하면 네이티브에서 등록 누락으로 조용히 죽는다(ZINOSB 사례).
 *   웹 빌드에도 딸려 들어오지만 각 플러그인이 web 구현을 갖고 있어 로드는 안전하고,
 *   실제 호출은 전부 isNativeApp() 안쪽에서만 일어난다.
 */

/** 종료 확인 유효 시간 — 이 안에 한 번 더 누르면 진짜 닫는다 */
const EXIT_CONFIRM_MS = 2000;

export default function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;

    // addListener 는 Promise 를 준다. 언마운트가 등록보다 먼저일 수 있어(StrictMode 이중 마운트)
    // 핸들을 모아 두고 마지막에 한꺼번에 정리한다.
    const pendingHandles: Promise<{ remove: () => Promise<void> }>[] = [];

    // ── 1. 스플래시 내리기 ──────────────────────────────────────────
    // 이 컴포넌트가 마운트됐다 = 원격 URL 이 로드되고 React 가 살아났다 = 보여줄 게 생겼다.
    SplashScreen.hide().catch(() => {
      /* 이미 내려갔거나 플러그인 부재 — 어느 쪽이든 사용자에게 영향 없다 */
    });

    // ── 2. 하드웨어 뒤로가기 ────────────────────────────────────────
    let lastExitPress = 0;
    pendingHandles.push(
      CapApp.addListener('backButton', () => {
        // 열려 있는 화면(모달·오버레이·상세)이 있으면 그걸 먼저 닫는다.
        // history.back() → useHistoryBack 의 popstate 리스너가 top 핸들러를 실행한다.
        // ★ Capacitor 가 주는 canGoBack 을 쓰지 않는 이유: 이 앱은 화면을 열 때마다
        //   더미 히스토리 엔트리를 쌓으므로 canGoBack 은 거의 항상 true 라 판별력이 없다.
        //   "닫을 화면이 있나"는 핸들러 스택만이 정확히 안다.
        if (hasOpenBackHandler()) {
          window.history.back();
          return;
        }

        // 최상위 화면 — 여기서 한 번 더 누르면 앱이 닫힌다.
        // 50-60대 사용자가 근무 확인 중 실수로 종료하는 것을 막는 한 단계.
        const now = Date.now();
        if (now - lastExitPress < EXIT_CONFIRM_MS) {
          CapApp.exitApp();
          return;
        }
        lastExitPress = now;
        showToast('한 번 더 누르면 앱이 닫혀요', 'info');
      })
    );

    // ── 3. 상태바 ──────────────────────────────────────────────────
    // overlay:false → 상태바 영역을 네이티브가 칠하고 WebView 는 그 아래에서 시작한다.
    // 웹 CSS 의 safe-area 처리와 겹쳐 이중 여백이 생기는 것을 원천 차단한다(안드로이드 전용 API).
    if (isNativeAndroid()) {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    }

    /** 테마에 맞춰 상태바 글자색/배경을 바꾼다. 다크=밝은 글씨. */
    const applyStatusBar = (theme: 'dark' | 'light') => {
      // Capacitor 의 Style.Dark 는 "어두운 배경용 = 밝은 글씨" 라는 뜻이다(이름이 헷갈린다).
      StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch(() => {});
      if (isNativeAndroid()) {
        // tokens.css 의 --dia-bg 와 동일한 값
        StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#0F172A' : '#F0F4F8' }).catch(
          () => {}
        );
      }
    };

    applyStatusBar(useThemeStore.getState().theme);
    const unsubTheme = useThemeStore.subscribe((state, prev) => {
      if (state.theme !== prev.theme) applyStatusBar(state.theme);
    });

    // ── 4. 키보드 ──────────────────────────────────────────────────
    if (isNativeIOS()) {
      // Native 리사이즈 = 키보드가 뜨면 WebView 자체가 줄어든다.
      // (Body/Ionic 모드는 iOS 에서 sticky 하단 요소가 키보드 뒤로 숨는 사고가 잦다)
      Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});
      Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
    }

    return () => {
      unsubTheme();
      pendingHandles.forEach((p) => {
        p.then((h) => h.remove()).catch(() => {});
      });
    };
  }, []);

  return null;
}
