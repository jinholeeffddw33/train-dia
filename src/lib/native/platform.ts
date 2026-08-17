/**
 * 네이티브 앱 판별 SSOT — 2026-08-18
 *
 * 이 앱은 **하나의 웹 빌드**가 세 곳에서 돈다:
 *   ① 모바일 브라우저  ② 홈 화면에 추가한 PWA  ③ Capacitor 네이티브 앱(WebView)
 * 셋 다 같은 JS 를 받으므로, 네이티브에서만 되는 것(진짜 햅틱·FCM 푸시·상태바)과
 * 네이티브에서만 안 되는 것(웹푸시·WebAuthn)을 가르려면 판별이 한 곳에 있어야 한다.
 *
 * ⚠️ userAgent 문자열('TrainDiaApp')로 직접 판별하지 말 것 —
 *   그건 **서버가** 네이티브 요청을 알아보기 위한 수단이고(브라우저는 JS 를 못 보여준다),
 *   클라이언트에는 Capacitor 자신이 심어 준 정확한 신호가 이미 있다.
 *   UA 는 사용자가 데스크톱 모드 등으로 바꿀 수 있어 판별용으로 더 약하다.
 */
import { Capacitor } from '@capacitor/core';

export type NativePlatform = 'ios' | 'android' | 'web';

/**
 * Capacitor 네이티브 셸 안에서 돌고 있는가.
 * SSR(서버 렌더)에서는 항상 false — 서버는 어느 셸이 받을지 모른다.
 * 그래서 이 값으로 **초기 렌더 결과를 가르면 hydration 불일치**가 난다.
 * 반드시 useEffect / 이벤트 핸들러 안에서 쓸 것.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform();
}

export function nativePlatform(): NativePlatform {
  if (typeof window === 'undefined') return 'web';
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : 'web';
}

export function isNativeIOS(): boolean {
  return nativePlatform() === 'ios';
}

export function isNativeAndroid(): boolean {
  return nativePlatform() === 'android';
}
