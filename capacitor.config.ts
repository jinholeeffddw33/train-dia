import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Train-DIA 네이티브 앱 설정 (Capacitor 8) — 2026-08-18
 *
 * ★ Remote URL 방식: Vercel 배포(https://dia5.kr)를 WebView 로 로드한다.
 *   정적 export 를 쓰지 않는 이유 = API 라우트 40개 + `output: 'standalone'`.
 *   서버가 필요한 앱이라 번들 안에 웹을 넣을 수 없다 (ZINOSB 와 동일 구조).
 *
 * ⚠️ appName 은 **스토어 노출명이 아니라 런처 아이콘 밑 이름**이고, 진호가 최종 이름을
 *   정하면 여기 한 줄 + android/app/src/main/res/values/strings.xml 만 바꾸면 된다.
 *   appId(kr.dia5.app)는 도메인 기반이라 이름과 무관 — 스토어 등록 후엔 변경 불가.
 */
const config: CapacitorConfig = {
  appId: 'kr.dia5.app',
  // TODO(진호 결정 대기): 스토어 이름 확정 시 여기 + strings.xml 동시 변경
  appName: '기관사DIA',
  // 원격 URL 모드라 실제로 로드되지 않지만 Capacitor 는 webDir 을 요구한다.
  // public/ 을 가리키면 audio 수백 MB 가 통째로 APK 에 들어가므로 전용 경량 폴더를 쓴다.
  webDir: 'native/www',
  server: {
    url: 'https://dia5.kr',
    cleartext: false,
    // 네트워크 실패 시 보여줄 페이지 (native/www/offline.html → assets 로 복사됨)
    errorPath: 'offline.html',
    // 자체 도메인 + Supabase 만 WebView 안에서 처리. 나머지는 외부 브라우저로 핸드오프.
    allowNavigation: ['dia5.kr', '*.dia5.kr', '*.supabase.co'],
  },
  android: {
    backgroundColor: '#0F172A', // tokens.css --dia-bg (다크 퍼스트)
    // 웹에서 네이티브를 식별하는 토큰. 'append' 라 기본 UA(Chrome feature detection,
    // WebAuthn 지원 판정 등)는 보존된다. ⚠️ ios.appendUserAgent 와 반드시 동일 문자열.
    appendUserAgent: 'TrainDiaApp',
    // release 빌드에서도 chrome://inspect 로 폰 WebView 를 PC 에서 직접 진단.
    // (ZINOSB 사고: release WebView 를 들여다볼 수 없어 며칠 추측으로 헤맴)
    webContentsDebuggingEnabled: true,
  },
  ios: {
    scrollEnabled: false,
    contentInset: 'never',
    backgroundColor: '#0F172A',
    preferredContentMode: 'mobile',
    appendUserAgent: 'TrainDiaApp',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      androidSplashResourceName: 'splash',
      backgroundColor: '#0F172A',
      showSpinner: false,
      launchShowDuration: 0,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
