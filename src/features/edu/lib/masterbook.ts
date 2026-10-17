/**
 * 5호선 전동차 MASTER BOOK (답십리승무사업소, 2026.9.10) — 교육 › 고장조치 › 전동차 비교
 *
 * 그림은 원본 PDF(글자가 외곽선이라 뽑을 수 없다)를 400dpi 로 그려 상자 단위로 자른 것.
 *   화면용 `src` 폭 1200 · 확대용 `zoom` 폭 2400 (public/images/edu/masterbook)
 * 쪽마다 ABB · 우진 · 로템 세 칸이 나란히 있어 차종별 차이가 한 장에 보인다(비상역행은 우진·로템만).
 * 주공기관 파열(원본 20~27쪽)은 따로 시뮬레이션이 있어 뺐다.
 *
 * link — 원본 QR 자리. 원본 QR(네이버 단축 주소)은 2026-10 확인 때 모두 비활성이라 비워 둔다.
 *        값을 넣으면 항목 화면에 «관련 자료 열기» 단추가 생긴다.
 */

export type MasterBookGroupId = 'brake' | 'door' | 'power' | 'etc' | 'diff';

export interface MasterBookImage {
  src: string;
  zoom: string;
  w: number;
  h: number;
  /** 단계 이름(원본 상자 머리) — 기기 차이점은 기기 이름 */
  label: string;
}

export interface MasterBookTopic {
  group: MasterBookGroupId;
  id: string;
  title: string;
  /** 원본 책 쪽 번호(인쇄 쪽) */
  bookPages: number[];
  images: MasterBookImage[];
  link?: string;
}

export const MASTERBOOK_IMG_BASE = '/images/edu/masterbook/';

export const MASTERBOOK_GROUPS: { id: MasterBookGroupId; title: string; short: string }[] = [
  { id: 'brake', title: '제동 고장', short: '제동' },
  { id: 'door', title: '출입문 고장', short: '출입문' },
  { id: 'power', title: '역행 불능', short: '역행' },
  { id: 'etc', title: '기타 조치', short: '구원' },
  { id: 'diff', title: '차종별 기기 차이점', short: '차이점' },
];

export const MASTERBOOK_TOPICS: MasterBookTopic[] = [
  { group: 'brake', id: 'brake-release', title: '제동 불완해 시 조치', bookPages: [2], images: [
    { src: 'brake-release-1.webp', zoom: 'brake-release-1-z.webp', w: 1200, h: 425, label: '확인 및 보고' },
    { src: 'brake-release-2.webp', zoom: 'brake-release-2-z.webp', w: 1200, h: 616, label: '우선 조치' },
    { src: 'brake-release-3.webp', zoom: 'brake-release-3-z.webp', w: 1200, h: 860, label: '추가 조치' },
  ] },
  { group: 'brake', id: 'brake-emergency', title: '비상제동 풀림 불가', bookPages: [3], images: [
    { src: 'brake-emergency-1.webp', zoom: 'brake-emergency-1-z.webp', w: 1200, h: 311, label: '확인 및 보고' },
    { src: 'brake-emergency-2.webp', zoom: 'brake-emergency-2-z.webp', w: 1200, h: 865, label: '우선 조치' },
    { src: 'brake-emergency-3.webp', zoom: 'brake-emergency-3-z.webp', w: 1200, h: 685, label: '추가 조치' },
  ] },
  { group: 'brake', id: 'brake-parking', title: '주차제동 풀림 불가', bookPages: [4], images: [
    { src: 'brake-parking-1.webp', zoom: 'brake-parking-1-z.webp', w: 1200, h: 434, label: '확인 및 보고' },
    { src: 'brake-parking-2.webp', zoom: 'brake-parking-2-z.webp', w: 1200, h: 1076, label: '우선 조치' },
    { src: 'brake-parking-3.webp', zoom: 'brake-parking-3-z.webp', w: 1200, h: 388, label: '추가 확인' },
  ] },
  { group: 'brake', id: 'brake-security', title: '보안제동 풀림 불가', bookPages: [5], images: [
    { src: 'brake-security-1.webp', zoom: 'brake-security-1-z.webp', w: 1200, h: 311, label: '확인 및 보고' },
    { src: 'brake-security-2.webp', zoom: 'brake-security-2-z.webp', w: 1200, h: 735, label: '우선 조치' },
    { src: 'brake-security-3.webp', zoom: 'brake-security-3-z.webp', w: 1200, h: 814, label: '추가 확인' },
  ] },
  { group: 'door', id: 'door-lamp', title: '출입문등 소등 시', bookPages: [6, 7], images: [
    { src: 'door-lamp-1.webp', zoom: 'door-lamp-1-z.webp', w: 1200, h: 425, label: '확인 및 보고' },
    { src: 'door-lamp-2.webp', zoom: 'door-lamp-2-z.webp', w: 1200, h: 1170, label: '우선 조치' },
    { src: 'door-lamp-3.webp', zoom: 'door-lamp-3-z.webp', w: 1200, h: 1162, label: '추가 확인' },
  ] },
  { group: 'door', id: 'door-close-all', title: '전체 출입문 닫힘 불능', bookPages: [8], images: [
    { src: 'door-close-all-1.webp', zoom: 'door-close-all-1-z.webp', w: 1200, h: 310, label: '확인 및 보고' },
    { src: 'door-close-all-2.webp', zoom: 'door-close-all-2-z.webp', w: 1200, h: 1023, label: '우선 조치' },
    { src: 'door-close-all-3.webp', zoom: 'door-close-all-3-z.webp', w: 1200, h: 412, label: '추가 확인' },
  ] },
  { group: 'door', id: 'door-close-car', title: '1량 출입문 닫힘 불능', bookPages: [9], images: [
    { src: 'door-close-car-1.webp', zoom: 'door-close-car-1-z.webp', w: 1200, h: 312, label: '확인 및 보고' },
    { src: 'door-close-car-2.webp', zoom: 'door-close-car-2-z.webp', w: 1200, h: 495, label: '우선 조치' },
    { src: 'door-close-car-3.webp', zoom: 'door-close-car-3-z.webp', w: 1200, h: 842, label: '추가 확인' },
  ] },
  { group: 'door', id: 'door-close-one', title: '1개 출입문 닫힘 불능', bookPages: [10], images: [
    { src: 'door-close-one-1.webp', zoom: 'door-close-one-1-z.webp', w: 1200, h: 424, label: '확인 및 보고' },
    { src: 'door-close-one-2.webp', zoom: 'door-close-one-2-z.webp', w: 1200, h: 495, label: '우선 조치' },
    { src: 'door-close-one-3.webp', zoom: 'door-close-one-3-z.webp', w: 1200, h: 971, label: '추가 확인' },
  ] },
  { group: 'door', id: 'door-open-all', title: '전체 출입문 열림 불능', bookPages: [11], images: [
    { src: 'door-open-all-1.webp', zoom: 'door-open-all-1-z.webp', w: 1200, h: 294, label: '확인 및 보고' },
    { src: 'door-open-all-2.webp', zoom: 'door-open-all-2-z.webp', w: 1200, h: 1104, label: '우선 조치' },
    { src: 'door-open-all-3.webp', zoom: 'door-open-all-3-z.webp', w: 1200, h: 503, label: '추가 확인' },
  ] },
  { group: 'door', id: 'door-open-car', title: '1량 출입문 열림 불능', bookPages: [12], images: [
    { src: 'door-open-car-1.webp', zoom: 'door-open-car-1-z.webp', w: 1200, h: 313, label: '확인 및 보고' },
    { src: 'door-open-car-2.webp', zoom: 'door-open-car-2-z.webp', w: 1200, h: 616, label: '우선 조치' },
    { src: 'door-open-car-3.webp', zoom: 'door-open-car-3-z.webp', w: 1200, h: 784, label: '추가 확인' },
  ] },
  { group: 'door', id: 'door-open-one', title: '1개 출입문 열림 불능', bookPages: [13], images: [
    { src: 'door-open-one-1.webp', zoom: 'door-open-one-1-z.webp', w: 1200, h: 288, label: '확인 및 보고' },
    { src: 'door-open-one-2.webp', zoom: 'door-open-one-2-z.webp', w: 1200, h: 593, label: '우선 조치' },
    { src: 'door-open-one-3.webp', zoom: 'door-open-one-3-z.webp', w: 1200, h: 1020, label: '추가 확인' },
  ] },
  { group: 'power', id: 'power-fail', title: '동력(역행)운전 불능', bookPages: [14, 15], images: [
    { src: 'power-fail-1.webp', zoom: 'power-fail-1-z.webp', w: 1200, h: 428, label: '확인 및 보고' },
    { src: 'power-fail-2.webp', zoom: 'power-fail-2-z.webp', w: 1200, h: 1264, label: '우선 조치' },
    { src: 'power-fail-3.webp', zoom: 'power-fail-3-z.webp', w: 1200, h: 1154, label: '추가 확인' },
  ] },
  { group: 'power', id: 'power-tc', title: 'TC 컴퓨터 고장 시', bookPages: [16], images: [
    { src: 'power-tc-1.webp', zoom: 'power-tc-1-z.webp', w: 1200, h: 409, label: '확인 및 보고' },
    { src: 'power-tc-2.webp', zoom: 'power-tc-2-z.webp', w: 1200, h: 900, label: '우선 조치' },
    { src: 'power-tc-3.webp', zoom: 'power-tc-3-z.webp', w: 1200, h: 593, label: '추가 확인' },
  ] },
  { group: 'power', id: 'power-deadman', title: '데드맨 스위치 고장', bookPages: [17], images: [
    { src: 'power-deadman-1.webp', zoom: 'power-deadman-1-z.webp', w: 1200, h: 399, label: '확인 및 보고' },
    { src: 'power-deadman-2.webp', zoom: 'power-deadman-2-z.webp', w: 1200, h: 604, label: '우선 조치' },
    { src: 'power-deadman-3.webp', zoom: 'power-deadman-3-z.webp', w: 1200, h: 505, label: '추가 확인' },
  ] },
  { group: 'power', id: 'power-eo', title: '비상역행 (EO 모드)', bookPages: [18], images: [
    { src: 'power-eo-1.webp', zoom: 'power-eo-1-z.webp', w: 1200, h: 405, label: '확인 및 보고' },
    { src: 'power-eo-2.webp', zoom: 'power-eo-2-z.webp', w: 1200, h: 672, label: '우선 조치' },
    { src: 'power-eo-3.webp', zoom: 'power-eo-3-z.webp', w: 1200, h: 505, label: '추가 조치' },
  ] },
  { group: 'etc', id: 'etc-rescue', title: '차종별 구원운전', bookPages: [19], images: [
    { src: 'etc-rescue-1.webp', zoom: 'etc-rescue-1-z.webp', w: 1200, h: 343, label: '구원 순서' },
    { src: 'etc-rescue-2.webp', zoom: 'etc-rescue-2-z.webp', w: 1200, h: 756, label: '조합별 조치 ①' },
    { src: 'etc-rescue-3.webp', zoom: 'etc-rescue-3-z.webp', w: 1200, h: 758, label: '조합별 조치 ②' },
  ] },
  { group: 'diff', id: 'diff-1', title: '주차제동 바이패스', bookPages: [29], images: [
    { src: 'diff-1-1.webp', zoom: 'diff-1-1-z.webp', w: 1200, h: 841, label: '주차제동 바이패스' },
  ] },
  { group: 'diff', id: 'diff-2', title: '주차제동 릴리스 전자변', bookPages: [29], images: [
    { src: 'diff-2-1.webp', zoom: 'diff-2-1-z.webp', w: 1200, h: 842, label: '주차제동 릴리스 전자변' },
  ] },
  { group: 'diff', id: 'diff-3', title: '주차제동 수동 당김고리', bookPages: [30], images: [
    { src: 'diff-3-1.webp', zoom: 'diff-3-1-z.webp', w: 1200, h: 841, label: '주차제동 수동 당김고리' },
  ] },
  { group: 'diff', id: 'diff-4', title: 'ALL DOOR BY-PASS', bookPages: [30], images: [
    { src: 'diff-4-1.webp', zoom: 'diff-4-1-z.webp', w: 1200, h: 842, label: 'ALL DOOR BY-PASS' },
  ] },
  { group: 'diff', id: 'diff-5', title: 'MR BY-PASS', bookPages: [31], images: [
    { src: 'diff-5-1.webp', zoom: 'diff-5-1-z.webp', w: 1200, h: 841, label: 'MR BY-PASS' },
  ] },
  { group: 'diff', id: 'diff-6', title: 'ATC', bookPages: [31], images: [
    { src: 'diff-6-1.webp', zoom: 'diff-6-1-z.webp', w: 1200, h: 842, label: 'ATC' },
  ] },
  { group: 'diff', id: 'diff-7', title: '주 컴퓨터 전원 (TC)', bookPages: [32], images: [
    { src: 'diff-7-1.webp', zoom: 'diff-7-1-z.webp', w: 1200, h: 841, label: '주 컴퓨터 전원 (TC)' },
  ] },
  { group: 'diff', id: 'diff-8', title: 'EROS (비상구원운전)', bookPages: [32], images: [
    { src: 'diff-8-1.webp', zoom: 'diff-8-1-z.webp', w: 1200, h: 842, label: 'EROS (비상구원운전)' },
  ] },
  { group: 'diff', id: 'diff-9', title: '밀착 연결기', bookPages: [33], images: [
    { src: 'diff-9-1.webp', zoom: 'diff-9-1-z.webp', w: 1200, h: 1192, label: '밀착 연결기' },
  ] },
  { group: 'diff', id: 'diff-10', title: 'SR 코크 (제동완해)', bookPages: [33], images: [
    { src: 'diff-10-1.webp', zoom: 'diff-10-1-z.webp', w: 1200, h: 836, label: 'SR 코크 (제동완해)' },
  ] },
  { group: 'diff', id: 'diff-11', title: 'CM 제어', bookPages: [34], images: [
    { src: 'diff-11-1.webp', zoom: 'diff-11-1-z.webp', w: 1200, h: 1597, label: 'CM 제어' },
  ] },
  { group: 'diff', id: 'diff-12', title: '차종별 출입문 수동 취급법', bookPages: [35], images: [
    { src: 'diff-12-1.webp', zoom: 'diff-12-1-z.webp', w: 1200, h: 1458, label: '차종별 출입문 수동 취급법' },
  ] },
];

export function findMasterBookTopic(id: string): MasterBookTopic | undefined {
  return MASTERBOOK_TOPICS.find((t) => t.id === id);
}
