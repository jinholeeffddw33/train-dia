import { flushSync } from 'react-dom';

type DocumentWithVT = Document & {
  startViewTransition?: (updateCallback: () => void) => unknown;
};

/**
 * View Transitions API 래퍼 — 탭/월드 전환에 네이티브급 크로스페이드.
 * 미지원 브라우저·모션 감소 설정이면 그냥 실행 (무해 폴백).
 * React 상태 변경은 flushSync 로 트랜지션 스냅샷 안에서 확정.
 */
export function startViewTransition(update: () => void) {
  if (typeof document === 'undefined') {
    update();
    return;
  }
  const doc = document as DocumentWithVT;
  const reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof doc.startViewTransition !== 'function' || reducedMotion) {
    update();
    return;
  }
  doc.startViewTransition(() => {
    flushSync(update);
  });
}
