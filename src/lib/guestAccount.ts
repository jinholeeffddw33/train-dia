/**
 * 체험 계정 — 발표회·견학에서 누구나 들어와 둘러보는 공용 계정.
 *
 * 로그인은 사번 1234 · 이름 답십리. 여러 사람이 동시에 쓰므로
 *  · 화면은 «그날 5다이아를 타는 기관사»의 근무로 보여준다 (guestView.ts)
 *  · 글쓰기·수정·삭제·제출은 서버에서 막는다 (src/middleware.ts)
 *  · 읽음 현황·인원 집계에는 넣지 않는다 (safetyReaders·integrity·dashboard)
 *
 * 이 파일은 미들웨어(엣지)에서도 읽으므로 다른 모듈을 import 하지 않는다.
 */
export const GUEST_SABUN = '1234';
export const GUEST_NAME = '답십리';
/** 체험 계정이 따라가는 다이아 */
export const GUEST_DIA = '5';

export function isGuest(sabun: string | null | undefined): boolean {
  return sabun === GUEST_SABUN;
}
