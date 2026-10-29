/**
 * 직원 얼굴 찾기 — 설정 › «직원 얼굴». 이름(또는 초성)을 넣으면 사업소 직원 얼굴이 나온다.
 * 기관사 나침반 «선배 찾기»(gigwansa-site)를 옮겨 온 것 — 같은 Supabase 의 gw_seniors 표·gw-seniors 보관함을 함께 쓴다.
 *
 * - 다이아 앱 «지금 명단»(발령일 반영 기관사 + 내근 + 인턴)에 있는 사람만 보인다. 퇴직·전출자 사진은 나가지 않는다.
 * - 선배 찾기 원본(«직원현황사진»)에 없는 직원은 사업소 사진에서 얼굴을 잘라 비공개 보관함 dia-faces 에 따로 둔다
 *   (선배 찾기 명단에는 섞지 않는다).
 *     interns/<사번>.webp — 2026-10-21 신규 인턴 5명(환영 팝업 사진)
 *     staff/<사번>.webp   — 2026-05 입사 5명(바탕화면 «새내기» 사진: 5/22 두 분 사진, 5/17 전동차 사진)
 *   아직 사진이 없는 사람: 이태원 부소장·김명 기관사
 * - 실명·얼굴은 코드에 두지 않는다 — 사진은 로그인한 직원에게만 1시간짜리 서명 주소로 보여 준다.
 */

export interface StaffFace {
  /** 화면 key — 같은 이름 두 사람(김성준A·B)은 한 칸으로 묶는다 */
  key: string;
  name: string;
  /** 소장·부소장·부장·대리·인턴·기관사 */
  role: string;
  /** 사진 주소(서명) — 없으면 빈 배열 */
  photos: string[];
  /** 같은 이름 직원 수(2 이상이면 사진이 누구 것인지 화면에 알린다) */
  same: number;
}

export interface StaffFacesResponse {
  people: StaffFace[];
  withPhoto: number;
}

/** 선배 찾기 원본에 없어 따로 올린 얼굴 — dia-faces 보관함의 경로 */
export const EXTRA_FACE_BUCKET = 'dia-faces';
export const EXTRA_FACES: Record<string, string> = {
  '22601509': 'interns/22601509.webp',
  '22601542': 'interns/22601542.webp',
  '22601553': 'interns/22601553.webp',
  '22601568': 'interns/22601568.webp',
  '22601584': 'interns/22601584.webp',
  '22600439': 'staff/22600439.webp', // 김경률
  '22600472': 'staff/22600472.webp', // 최승빈
  '22600519': 'staff/22600519.webp', // 박민석
  '22601004': 'staff/22601004.webp', // 한지승
  '22601008': 'staff/22601008.webp', // 강미진
};

/** «김성준A» → «김성준» — 앱 명부는 같은 이름에 A·B 를 붙인다 */
export const baseName = (n: string) => n.replace(/[A-Z]$/, '');

/** 한글 초성 — «김성준» → «ㄱㅅㅈ» */
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
export function chosung(s: string): string {
  return [...s].map((c) => {
    const code = c.charCodeAt(0) - 0xac00;
    return code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : c;
  }).join('');
}

/** 이름 또는 초성으로 찾기 — 띄어쓰기는 무시 */
export function matchFace(name: string, query: string): boolean {
  const q = query.replace(/\s/g, '');
  if (!q) return false;
  if (name.includes(q)) return true;
  return /^[ㄱ-ㅎ]+$/.test(q) && chosung(name).includes(q);
}
