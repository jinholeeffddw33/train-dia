import { flushSync } from 'react-dom';

/** 전환 축 — globals.css 의 html[data-vt='…']::view-transition-* 와 1:1 대응.
 *  forward/back = X축 슬라이드, open/close = Z축 확대·축소, fade = 방향 없음(탭). */
export type ViewTransitionDirection = 'forward' | 'back' | 'open' | 'close' | 'fade';

type ViewTransitionLike = { finished: Promise<unknown> };
type DocumentWithVT = Document & {
  startViewTransition?: (updateCallback: () => void) => ViewTransitionLike;
};

/**
 * View Transitions API 래퍼 — Shared Axis 화면 전환.
 * 미지원 브라우저·모션 감소 설정이면 그냥 실행 (무해 폴백 — data-vt 도 안 붙인다).
 *
 * 어긋난 불투명 구간·축별 움직임은 전부 CSS(globals.css)가 소유한다.
 * 여기서는 전환 직전 <html data-vt="방향"> 을 세팅해 어떤 keyframe 을 태울지 고르고,
 * 애니메이션이 끝나면(finished) 지운다. React 상태 변경은 flushSync 로 스냅샷 안에서 확정.
 */
export function startViewTransition(
  update: () => void,
  direction: ViewTransitionDirection = 'fade',
) {
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

  const root = document.documentElement;
  root.dataset.vt = direction;

  // 전환이 끝나면 방향 표식을 정리한다. 정리 도중 다음 전환이 이미 다른 방향을
  // 세팅했다면(연타) 그건 건드리지 않는다 — 최신 전환의 표식을 지우면 그 애니메이션이 죽는다.
  const clear = () => {
    if (root.dataset.vt === direction) delete root.dataset.vt;
  };

  const transition = doc.startViewTransition(() => {
    flushSync(update);
  });
  transition.finished.then(clear, clear);
}
