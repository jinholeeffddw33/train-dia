// ===== 행로도(노선 축) 지오메트리 — 교번별 · 근무별 =====
// 가로 = 노선 위치: 왼쪽 방화 방향, 오른쪽 마천·하남 방향.
// 근무(1근무/2근무)별로 잘라서(seg) 각 근무 칸에 인라인 표시한다.
// 원본(답십리사업소_행로표 .xlsm 도형) 좌표를 옮긴다.
//
// ⚠️ 현재 교번 79만 수록(원본 대조 검증본). 나머지는 .xlsm 도형 파싱으로 확장 예정.

export interface RDText {
  t: string;
  x: number;
  y: number;
  anchor?: 'start' | 'end' | 'middle';
  kind: 'time' | 'km';
  /** 출발시각 — 크고 진하게 강조 */
  dep?: boolean;
}
export interface RDPill { t: string; x: number; y: number }

/** 근무 1개의 행로도(잘린 조각) */
export interface RDSeg {
  /** viewBox [x, y, w, h] — 이 근무 영역만 크롭 */
  viewBox: [number, number, number, number];
  paths: string[];      // 연결선 path d
  nodes: { x: number; y: number }[]; // ● 기지 출고 시작점
  pills: RDPill[];      // 열차번호 알약 (좌상단 x,y — 46×22 고정)
  texts: RDText[];      // 시각/km
}

export interface RDDiagram {
  /** 근무 index(0=1근무, 1=2근무) 순 */
  segs: RDSeg[];
}

// ── 교번 79 (야간: 1근무 답마방기 / 2근무 기방화마답) ──
// 역 간격을 압축해 카드 폭에 스크롤 없이 맞춘다(좌우 순서·위치 관계 유지, 빈 구간만 축소).
const DIA_79: RDDiagram = {
  segs: [
    // 1근무 (top chart) — 5687 → 5668 → 1558 (오른쪽 마천쪽 → 왼쪽 방화쪽)
    {
      viewBox: [0, 138, 396, 128],
      paths: [
        'M165,202 H100 V232 H85',  // 5668 → 방화 코너 → 1558
        'M62,243 V257',            // 1558 아래 화살표 세로
        'M56,251 L62,258 L68,251', // 화살표 촉(∨)
        'M211,202 H355',           // 5668 → 20:25 (오른쪽 마천 방면)
        'M315,172 H355',           // 5687 → 20:06 (윗선)
        'M355,172 V202',           // 분기 세로(선 끝점)
      ],
      nodes: [],
      pills: [
        { t: '5687', x: 269, y: 161 },
        { t: '5668', x: 165, y: 191 },
        { t: '1558', x: 39, y: 221 },
      ],
      texts: [
        { t: '63.7km', x: 8, y: 150, kind: 'km' },
        { t: '19:40', x: 264, y: 177, anchor: 'end', kind: 'time', dep: true },
        { t: '20:06', x: 361, y: 177, kind: 'time' },
        { t: '20:25', x: 361, y: 207, kind: 'time' },
        { t: '21:52', x: 8, y: 207, kind: 'time' },
        { t: '21:57', x: 35, y: 236, anchor: 'end', kind: 'time' },
        { t: '21:52', x: 104, y: 236, kind: 'time' },
      ],
    },
    // 2근무 (bottom chart) — 1501·5901(왼쪽 방화쪽) → 5513·5518(오른쪽 마천쪽)
    {
      viewBox: [-16, 306, 374, 152],
      paths: [
        'M60,330 V341',            // ● 출고 → 1501
        'M60,363 V378 H67',        // 1501 → 5901
        'M90,389 V415 H152',       // 5901 → 5513
        'M198,415 H320',           // 5513 → 06:49
        'M320,415 V442',           // 분기 세로(선 끝점)
        'M283,442 H320',           // 5518 → 06:57
        'M218,442 H237',           // 07:24 → 5518
      ],
      nodes: [{ x: 60, y: 330 }],
      pills: [
        { t: '1501', x: 37, y: 341 },
        { t: '5901', x: 67, y: 367 },
        { t: '5513', x: 152, y: 404 },
        { t: '5518', x: 237, y: 431 },
      ],
      texts: [
        { t: '63.7km', x: 8, y: 318, kind: 'km' },
        { t: '05:19', x: 34, y: 357, anchor: 'end', kind: 'time', dep: true },
        { t: '05:24', x: 92, y: 357, kind: 'time' },
        { t: '05:24', x: 58, y: 383, anchor: 'end', kind: 'time' },
        { t: '05:35', x: 115, y: 383, kind: 'time' },
        { t: '05:37', x: 82, y: 410, anchor: 'end', kind: 'time' },
        { t: '06:49', x: 326, y: 420, kind: 'time' },
        { t: '07:24', x: 214, y: 447, anchor: 'end', kind: 'time' },
        { t: '06:57', x: 326, y: 447, kind: 'time' },
      ],
    },
  ],
};

export const ROUTE_DIAGRAMS: Record<string, RDDiagram> = {
  '79': DIA_79,
};

/** 교번 → 행로도 데이터 (없으면 undefined) */
export function getRouteDiagram(dia?: string | null): RDDiagram | undefined {
  if (!dia) return undefined;
  return ROUTE_DIAGRAMS[dia.replace(/\D/g, '')];
}
