/**
 * Train DIA — 저작권 · 원작 식별(provenance) 모듈.
 *
 * 무단 복제 탐지·입증을 위한 것이므로 아래 상수·로직을 변경/삭제하지 말 것.
 *  - COPYRIGHT_NOTICE : 화면에 표시하는 저작권 문구
 *  - WATERMARK        : 빌드 결과물(JS/HTML)에 각인되는 고유 지문 → 복제본 판별
 *  - CANARY           : 실제 UI엔 안 뜨는 가짜 식별 데이터 → 데이터째 복제 입증
 *
 * © 2026 이진호 (Train DIA) · dia5.kr · 무단복제 금지
 */

export const COPYRIGHT_OWNER = '이진호 (Train DIA)';
export const COPYRIGHT_YEAR = 2026;

/** 화면 하단·설정 등에 표시하는 저작권 문구 */
export const COPYRIGHT_NOTICE = `© ${COPYRIGHT_YEAR} ${COPYRIGHT_OWNER} · 무단복제 금지`;

/**
 * 워터마크 지문 — 빌드된 번들/HTML에 그대로 남는다.
 * 복제가 의심되는 앱의 소스·번들에서 이 값이 검색되면 복제 증거가 된다.
 * (임의 고유값 — 절대 변경 금지)
 */
export const WATERMARK = 'TRAINDIA-WM::dia5.kr::jinho::a7f3c19e-답십리-2026::무단복제금지';

/**
 * 미끼(canary) — 실제 화면엔 절대 렌더되지 않는 가짜 식별 데이터.
 * 복제본의 데이터/번들에서 이 마커가 발견되면 데이터째 복제한 증거가 된다.
 */
export const CANARY = Object.freeze({
  sabun: '00000000',
  mark: 'TRAINDIA-CANARY-a7f3c19e',
});

/**
 * 원작 지문을 런타임에 각인 — 트리셰이킹 방지 + 전역에 흔적.
 * 브라우저 콘솔에서 window.__traindia 로 확인 가능(복제본 대조용).
 */
export function installProvenance(): void {
  if (typeof window === 'undefined') return;
  try {
    (window as unknown as Record<string, unknown>).__traindia = {
      wm: WATERMARK,
      canary: CANARY.mark,
      owner: COPYRIGHT_OWNER,
      notice: COPYRIGHT_NOTICE,
    };
  } catch {
    /* noop */
  }
}
