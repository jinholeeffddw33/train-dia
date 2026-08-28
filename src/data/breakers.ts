// ===== 운전실 일반배전반 — 차단기 배치와 증상 문제 =====
//
// 기준 차종: 5호선 우진전동차.
// 기준 명칭: 실제 배전반에 인쇄된 라벨(사진에서 읽음). 교재(2107)와 다르게 적힌 것이 있으나,
//            기관사가 눈으로 보는 것은 배전반 쪽이므로 그쪽을 정본으로 삼는다.
//
// 출처(증상·조치):
//   [상황별] 제2장 5호선 상황별 조치사항(230404)
//   [출고]   제1장 5호선 출고준비 및 기본 조치사항
//   [경고장] 제4장 5호선 경고장
//   [교재]   5호선 신조전동차(우진) 승무원 교육교재(2107)

export interface Breaker {
  /** 배전반 라벨(영문 약어) */
  id: string;
  /** 배전반 라벨(우리말) */
  ko: string;
  /** 몇 번째 줄 — 실물 배전반의 3단 구성 그대로 */
  row: 1 | 2 | 3;
  /** 배전반에 붉은 글씨로 적힌 것 — 실물에서 중요 표시로 쓰인다 */
  red?: boolean;
  /** 예비(SPARE) */
  spare?: boolean;
  /**
   * 사진에서 노란 잠금 클립에 우리말 라벨이 가려 정확히 읽지 못한 것.
   * 배전반에는 있으므로 화면에는 그대로 두되(오답 선택지로는 쓰인다),
   * 정답으로는 쓰지 않는다 — 못 읽은 것을 정답이라 우기면 잘못 외우게 된다.
   */
  covered?: boolean;
}

/** 돌리는 스위치 — 차단기가 전원을 끊는 것이라면 이쪽은 회로를 우회시킨다 */
export interface PanelSwitch {
  id: string;
  ko: string;
  /** 손잡이가 갈 수 있는 자리 */
  positions: string;
}

// ── 윗줄 ──
const ROW1: Breaker[] = [
  { id: 'RALpN',    ko: '객실 교류 조명등',     row: 1 },
  { id: 'PIDN',     ko: '객실 안내 표시기',     row: 1 },
  { id: 'FTNDDN',   ko: '정면 열번 행선 표시기', row: 1 },
  { id: 'ASHTN',    ko: '공기장치용 난방기',    row: 1 },
  { id: 'ACCONN1',  ko: '교류 콘센트 1',        row: 1 },
  { id: 'ACCONN2',  ko: '교류 콘센트 2',        row: 1 },
  { id: 'CMN',      ko: '주공기압축기',         row: 1 },
  { id: 'RESCN',    ko: '구원제어',             row: 1 },
  { id: 'HTLN',     ko: '전조 · 후미등',        row: 1 },
  { id: 'ELHORNN',  ko: '전기 경적',            row: 1 },
  { id: 'WIPCN',    ko: '와이퍼 제어',          row: 1 },
  { id: 'TCMSDON',  ko: 'TCMS P100',            row: 1, red: true },
  { id: 'ADUN',     ko: 'ATC 화면장치',         row: 1 },
  { id: 'ERN',      ko: '이벤트 레코더',        row: 1 },
  { id: 'PSDN',     ko: '승강장안전문',         row: 1 },
  { id: 'NVRN',     ko: '영상녹화장치',         row: 1 },
  { id: 'TCUN',     ko: '열차 컴퓨터',          row: 1, red: true },
  { id: 'CMGN',     ko: '주공기압축기 조압기',  row: 1 },
];

// ── 가운뎃줄 ──
const ROW2: Breaker[] = [
  { id: 'TTLpN',   ko: '시각 표시등',            row: 2 },
  { id: 'SPARE2',  ko: '예비',                   row: 2, spare: true },
  { id: 'DCLN',    ko: '좌측 출입문',            row: 2 },
  { id: 'DCRN',    ko: '우측 출입문',            row: 2 },
  { id: 'ESKN',    ko: '연장급전 제어',          row: 2 },
  { id: 'PANUN',   ko: '판토그래프 상승',        row: 2 },
  { id: 'PANDN',   ko: '판토그래프 하강',        row: 2 },
  { id: 'ATCN1',   ko: '주 ATC',                 row: 2, red: true },
  { id: 'ATCN2',   ko: '보조 ATC',               row: 2, red: true },
  { id: 'DODBPN',  ko: '출입문 장애 검지 차단',  row: 2 },
  { id: 'LDCUN',   ko: '좌측 출입문 제어장치',   row: 2 },
  { id: 'RDCUN',   ko: '우측 출입문 제어장치',   row: 2 },
  { id: 'EMBN',    ko: '비상제동 제어',          row: 2, red: true },
  { id: 'BOUN',    ko: '제동작용장치',           row: 2, red: true },
  { id: 'PBN',     ko: '주차제동 제어',          row: 2 },
  { id: 'CMSBN',   ko: '공기압축기 기동장치',    row: 2 },
  { id: 'DIN',     ko: '출입문 인터록 제어',     row: 2 },
  { id: 'SBN',     ko: '보안제동 제어',          row: 2 },
  { id: 'UPN',     ko: '무정전 무선방송조정장치', row: 2 },
  { id: 'ELN',     ko: '열차분리검지',           row: 2 },
  { id: 'ATCDON',  ko: '신호장치 디지털 출력',   row: 2, red: true },
];

// ── 아랫줄 ──
const ROW3: Breaker[] = [
  { id: 'DCUZN',   ko: '출입문 0속도 신호',      row: 3 },
  { id: 'SPARE3',  ko: '예비',                   row: 3, spare: true },
  { id: 'DRN',     ko: '출입문 제어 계전기',     row: 3 },
  { id: 'RDLpN',   ko: '객실 직류 조명등',       row: 3 },
  { id: 'FDN',     ko: '화재 감지기',            row: 3, red: true },
  { id: 'HBCOS',   ko: '정차제동차단',           row: 3 },
  { id: 'TRUN',    ko: '열차무선장치',           row: 3, red: true },
  { id: 'PISCN',   ko: '표시기 제어 설정기',     row: 3 },
  { id: 'PACN',    ko: '방송장치',               row: 3, red: true },
  { id: 'CATVN',   ko: '운전실 제어',            row: 3 },
  { id: 'ENCDN1',  ko: '엔코더 1',               row: 3 },
  { id: 'ENCDN2',  ko: '엔코더 2',               row: 3 },
  { id: 'EHLpN',   ko: '비상 전조등',            row: 3, covered: true },
  { id: 'NCN',     ko: '회로차단기 감시',        row: 3 },
  { id: 'SIVCN1',  ko: 'SIV 제어장치 1',         row: 3 },
  { id: 'SIVCN2',  ko: 'SIV 제어장치 2',         row: 3 },
  { id: 'BATKN1',  ko: '축전지 접촉기 1',        row: 3, red: true },
  { id: 'BATKN2',  ko: '축전지 접촉기 2',        row: 3, red: true },
  { id: 'BATKN3',  ko: '축전지 접촉기 3',        row: 3, covered: true },
  { id: 'BATKBS',  ko: '축전지 접촉기 바이패스', row: 3, covered: true },
  { id: 'DILN',    ko: '출입문 LED 표시등',      row: 3 },
  { id: 'EBON',    ko: '축전지 비상',            row: 3, covered: true },
];

export const BREAKERS: Breaker[] = [...ROW1, ...ROW2, ...ROW3];

export const SWITCHES: PanelSwitch[] = [
  { id: 'PABBPS', ko: '주차제동 바이패스',        positions: 'NORMAL · PASS' },
  { id: 'MRBPS',  ko: '주공기 압력 바이패스',     positions: 'NORMAL · PASS' },
  { id: 'ZVBPS',  ko: 'ZVR 바이패스',             positions: 'NORMAL · PASS' },
  { id: 'DBS',    ko: '출입문 바이패스',          positions: 'NORMAL · PASS' },
  { id: 'DSDBPS', ko: '데드맨 바이패스',          positions: 'NORMAL · PASS' },
  { id: 'PASS',   ko: '대승객 방송 선택',         positions: 'PA · UPS' },
  { id: 'UCPB',   ko: '자동연결기 완해',          positions: '누름 버튼' },
  { id: 'EROS',   ko: '비상 · 구원운전',          positions: 'EO · N · R1 · R2' },
];

const BY_ID = new Map<string, Breaker | PanelSwitch>([
  ...BREAKERS.map((b) => [b.id, b] as const),
  ...SWITCHES.map((s) => [s.id, s] as const),
]);

/** 화면에 이름을 띄울 때 — 없는 id 는 그대로 돌려준다 */
export function labelOf(id: string): string {
  const item = BY_ID.get(id);
  return item ? item.ko : id;
}

export interface BreakerQuiz {
  id: string;
  /** 문제 — 기관사가 마주하는 증상 */
  symptom: string;
  /** 정답. 둘 이상이면 모두 취급해야 정답이다 */
  answer: string[];
  /** 왜 그 차단기인지 한 줄 */
  explain: string;
  /** 근거 문서 */
  src: string;
  /** 이름만 알아서는 틀리는 것 — 정답을 맞혀도 함께 보여준다 */
  trap?: string;
}

/* 문서에 조치가 적힌 것만 문제로 낸다. 지어내면 잘못 외우게 된다.
   라벨이 가려 못 읽은 차단기(covered)는 정답으로 쓰지 않는다 — 그래서 축전지 0V 복구
   절차(BATKN3 → EBON → BATKBS)는 지금 빠져 있다. 가리지 않은 사진이 생기면 넣는다. */
export const BREAKER_QUIZ: BreakerQuiz[] = [
  // ── 제동 ──
  {
    id: 'q-brake-force',
    symptom: '제동 7단을 취급했는데 그 차량의 제동압력이 생성되지 않습니다. (제동력 부족)',
    answer: ['BOUN'],
    explain: '제동작용장치. 고장 차호의 BOUN을 OFF/ON 해 리셋한 뒤, 마스콘을 N에서 제동 7단까지 수회 취급해 소거되는지 본다.',
    src: '상황별 p31',
  },
  {
    id: 'q-brake-stuck',
    symptom: '강제제동완해(CPRS)를 취급했는데도 제동이 풀리지 않습니다.',
    answer: ['BOUN'],
    explain: '관제 보고 후 고장 차호의 BOUN을 OFF/ON 해 리셋한다. 그래도 안 되면 해당 차량 제동풀림콕크를 90° 취급.',
    src: '상황별 p33',
  },
  {
    id: 'q-brake-comm',
    symptom: 'TCMS 화면 하단에 제동장치 통신고장이 떴습니다. (고장코드 4000)',
    answer: ['BOUN'],
    explain: '제동 계통 고장코드(통신고장·자기진단·회생제동요구 비정상)는 모두 해당 차호 BOUN OFF/ON 리셋이 기본 조치다.',
    src: '경고장 p19',
  },
  {
    id: 'q-park-shown',
    symptom: '동력운전이 되지 않고 TCMS 화면에 「주차」가 현시됩니다.',
    answer: ['PBN'],
    explain: '전·후부차 PBN을 확인 복귀한 뒤 주차제동 완해 스위치를 취급한다.',
    src: '상황별 p26',
    trap: '전부차 PBN이 복귀되지 않으면 동력 취급할 때만 PBBS를 누른 상태로 회송하거나, 후부 운전실 추진운전으로 회송한다(관제 승인).',
  },
  {
    id: 'q-park-trip',
    symptom: '역행 불능입니다. 모니터에 「주차제동 동작」이 현시됩니다.',
    answer: ['PBN'],
    explain: '주차제동 제어 차단기가 트립되면 모니터에 주차제동 동작으로 뜬다. 전후부 운전실 배전반을 함께 확인한다.',
    src: '상황별 p28',
  },
  {
    id: 'q-hb',
    symptom: '정차제동(HB)이 완해되지 않습니다. BC압력이 남아 있습니다.',
    answer: ['HBCOS'],
    explain: '제어대의 정차제동 개방 스위치를 개방 취급하고 BC압력이 0인지 확인한다.',
    src: '상황별 p28',
    trap: 'HBCOS를 개방한 뒤에는 역 정차 시 정차제동이 체결되지 않는다. 기본 고장조치(Reset)는 보안제동 취급 후 시행할 것.',
  },
  {
    id: 'q-sb',
    symptom: '역행 불능 조치 중, 보안제동이 복귀되지 않습니다.',
    answer: ['SBN'],
    explain: '보안제동 제어 차단기를 OFF 취급한다.',
    src: '상황별 p26',
  },

  // ── 출입문 ──
  {
    id: 'q-door-open-r',
    symptom: '우측 출입문 1량이 열리지 않습니다. DOS를 여러 번 취급해도 그대로입니다.',
    answer: ['RDCUN'],
    explain: '불량 차호를 확인하고 해당 차량 배전반의 우측 출입문 제어장치 차단기를 확인 복귀한다. 불능이면 관제 승인 후 회송.',
    src: '상황별 p17',
  },
  {
    id: 'q-door-open-l',
    symptom: '좌측 출입문 1량이 열리지 않습니다.',
    answer: ['LDCUN'],
    explain: '해당 차량 배전반의 좌측 출입문 제어장치 차단기를 확인 복귀한다.',
    src: '상황별 p17',
  },
  {
    id: 'q-door-close-l',
    symptom: '좌측 출입문 1량이 닫히지 않습니다.',
    answer: ['DCLN'],
    explain: '해당차 배전반의 좌측 출입문 차단기를 확인 복귀한 뒤 DOS ⇒ DCS 를 취급하면 닫힌다.',
    src: '상황별 p20',
  },
  {
    id: 'q-door-close-r',
    symptom: '우측 출입문 1량이 닫히지 않습니다.',
    answer: ['DCRN'],
    explain: '해당차 배전반의 우측 출입문 차단기를 확인 복귀한 뒤 DOS ⇒ DCS 를 취급하면 닫힌다.',
    src: '상황별 p20',
  },
  {
    id: 'q-door-stuck',
    symptom: '전 차량 출입문이 닫히지 않습니다. DOS 고착인지 DROS 고착인지 가려내려 합니다.',
    answer: ['DRN'],
    explain: '전부 운전실 주분전함의 DRN을 OFF 후 ON 한다. 문이 닫혔다 다시 열리면 DOS 고착, 열리지 않으면 DROS 고착이다.',
    src: '상황별 p20',
    trap: 'DOS 고착이면 DRN을 ON 하는 즉시 그 방향 출입문이 열린다. 정상 운행이 불가능하므로 승객 하차 후 즉시 회송.',
  },
  {
    id: 'q-doorlamp',
    symptom: 'DOOR등(발차지시등)이 점등되지 않습니다.',
    answer: ['DILN'],
    explain: '전·후 운전실 배전반의 DILN이 트립되지 않았는지 확인한다.',
    src: '상황별 p16',
    trap: '전부차 DILN OFF — DU에 「출입문 닫힘」 표시. 후부차 OFF — DU에 「출입문 열림」 표시. 둘 다 DOOR등은 꺼지고 역행은 된다.',
  },

  // ── ATC · 신호 ──
  {
    id: 'q-atc-both',
    symptom: 'ATC 1, 2 가 동시에 고장났습니다. 리셋하려 합니다.',
    answer: ['ATCN1', 'ATCN2'],
    explain: '두 차단기를 동시에 OFF → ON 하여 복귀 여부를 확인한다. 복귀되지 않으면 ATC 고장이다.',
    src: '상황별 p30',
  },
  {
    id: 'q-atc-force',
    symptom: 'ATC1이 고장인데 ATC2로 자동절체가 되지 않습니다. 강제로 넘기려 합니다.',
    answer: ['ATCN1'],
    explain: 'ATCN1을 OFF 하여 ATC2로 강제 절체한다.',
    src: '상황별 p30',
    trap: 'ATC2만 고장이거나 ATC1 고장으로 자동절체가 됐다면 종착역까지 그대로 운행한다.',
  },
  {
    id: 'q-alldoor-atc',
    symptom: '전 차량 출입문이 열리지 않습니다. DOS를 3회 취급한 뒤 다음으로 확인할 차단기는?',
    answer: ['ATCN1', 'ATCN2'],
    explain: '전부 운전실 ATCN1, 2를 확인 복귀한다. 복귀 불능이거나 ZVR 계전기 불량이면 다음 단계로 넘어간다.',
    src: '상황별 p19',
  },
  {
    id: 'q-adu',
    symptom: '비상제동이 완해되지 않습니다. ATC 화면장치 쪽을 확인하려 합니다.',
    answer: ['ADUN'],
    explain: '전부차 ADUN 또는 ATCN1, 2 차단 후 복귀 불능이면 관제 승인 후 운전모드선택(OMS) 비상을 취급한다.',
    src: '상황별 p29',
  },
  {
    id: 'q-sots',
    symptom: '열차분리 검지 SOTS1이 발생했고 비상제동은 걸리지 않았습니다. 지금 TC2 운전실입니다.',
    answer: ['ELN'],
    explain: 'SOTS1이면 TC2의 ELN을 OFF → ON 하고 정상 동작 여부를 확인한다.',
    src: '상황별 p42',
    trap: 'SOTS1이면 TC2, SOTS2이면 TC1 — 반대쪽 차다. 비상제동이 걸린 경우에는 차단기를 만지지 말고 관제에 연락, 구원 도착까지 선로를 통제한다.',
  },

  // ── 축전지 · 판토 · 급전 ──
  {
    id: 'q-batt-meter',
    symptom: '축전지 전압계만 0V로 현시됩니다.',
    answer: ['BATKN2'],
    explain: '이 차단기가 차단되면 축전지 전압계만 0V로 보인다. 실제 축전지가 죽은 것과 구분해야 한다.',
    src: '상황별 p8',
  },
  {
    id: 'q-pan-down-bat',
    symptom: '전 차량 판토그래프가 하강하지 않습니다. 축전지 접촉기 쪽을 확인하려 합니다.',
    answer: ['BATKN1'],
    explain: 'BATKN1이 차단됐으면 확인 복귀한 뒤 PanDS를 취급한다.',
    src: '상황별 p12',
  },
  {
    id: 'q-pan-down',
    symptom: '전 차량 판토그래프가 하강하지 않습니다. 판토 하강 제어 쪽을 확인하려 합니다.',
    answer: ['PANDN'],
    explain: 'PANDN이 차단됐으면 확인 복귀한 뒤 PanDS를 취급한다. 그래도 안 되면 M차 배전반의 PANVN과 Pan 콕크를 차단한다.',
    src: '상황별 p12',
  },
  {
    id: 'q-arrester-1',
    symptom: '피뢰기가 동작했습니다. 완전부동취급 후 연장급전을 하려 합니다. 첫 조작은?',
    answer: ['PANDN'],
    explain: '해당차량 PANDN을 먼저 OFF 하고, 그 다음 SIVCN1, 2를 OFF 한다. 순서가 있다.',
    src: '상황별 p13',
  },
  {
    id: 'q-arrester-2',
    symptom: '피뢰기 동작으로 해당차량 PANDN을 껐습니다. 다음 조작은?',
    answer: ['SIVCN1', 'SIVCN2'],
    explain: '해당차량 SIVCN1, 2를 OFF 하여 연장급전으로 넘긴다.',
    src: '상황별 p13',
  },
  {
    id: 'q-siv-front',
    symptom: 'SIV가 고장인데 연장급전이 되지 않습니다. 전부 운전실에서 강제로 넘기려 합니다.',
    answer: ['SIVCN1'],
    explain: 'SIVCN1을 OFF 하여 강제 연장급전시킨다. 그 뒤 ESKN 상태를 확인한다.',
    src: '상황별 p15',
    trap: '오취급 방지 — 운전 중인 측(전부)이 SIVN1, 반대측(후부)이 SIVN2. 반대로 끊으면 멀쩡한 쪽을 죽인다.',
  },
  {
    id: 'q-siv-rear',
    symptom: 'SIV 고장, 후부 운전실에서 강제 연장급전을 하려 합니다.',
    answer: ['SIVCN2'],
    explain: '후부는 SIVCN2를 OFF 한다.',
    src: '상황별 p15',
  },
  {
    id: 'q-esk',
    symptom: '강제 연장급전을 시켰습니다. 이어서 상태를 확인할 차단기는?',
    answer: ['ESKN'],
    explain: '연장급전 제어 NFB 상태를 확인한다.',
    src: '상황별 p15',
  },
  {
    id: 'q-acm',
    symptom: '보조공기압축기(ACM)가 구동되지 않습니다. 판토 상승 제어를 취급해 확인하려 합니다.',
    answer: ['PANUN'],
    explain: 'PANUN 취급으로 TCMS 프로토콜 PANR이 동작하지 않으면 M1차 배전반의 ACMCS 취급을 요청한다.',
    src: '상황별 p9',
  },

  // ── 공기 ──
  {
    id: 'q-mr-burst',
    symptom: 'MR 배관이 파열됐습니다. Tc차 압축기 구동을 멈추려 합니다.',
    answer: ['CMN', 'CMSBN'],
    explain: '해당 MR 콕크(인접차)를 차단하고, Tc 차량 파손 시 해당 유니트의 CMN과 CMSBN을 OFF 해 구동을 정지시킨다.',
    src: '상황별 p53',
  },

  // ── 주행 · 엔코더 ──
  {
    id: 'q-enc-fault',
    symptom: '동력운전이 되지 않고 TCMS에 엔코더 고장이 현시됩니다.',
    answer: ['ENCDN1', 'ENCDN2'],
    explain: '전부차 엔코더 차단기를 확인 복귀하고 OFF 후 ON 을 시도한다. 복귀 불능이면 EROS 「EO」 모드로 넘어간다.',
    src: '상황별 p26',
  },
  {
    id: 'q-eo-first',
    symptom: 'EO 모드로 넘어가려 합니다. 배전반에서 먼저 내릴 차단기는?',
    answer: ['ENCDN1', 'ENCDN2'],
    explain: 'EO 모드 절차 ① 엔코더 NFB OFF ② EROS 「EO」 선택 ③ 운전모드 수동 또는 비상 선택.',
    src: '상황별 p37',
    trap: 'EO 모드는 45km/h 이하, 상용제동은 단계와 관계없이 B7로 현시되고, 역행은 P4, 후진은 되지 않는다.',
  },

  // ── TCMS · 표시 · 방송 ──
  {
    id: 'q-tcms-blank',
    symptom: 'TCMS 화면에 아무것도 현시되지 않습니다.',
    answer: ['TCUN'],
    explain: '열차컴퓨터 본체 전원이다. 차단됐으면 확인 복귀한다.',
    src: '상황별 p34',
  },
  {
    id: 'q-tcms-err',
    symptom: 'TCMS 열차정보 에러가 발생했습니다.',
    answer: ['TCMSDON'],
    explain: 'TCMSDON을 차단한 뒤 복귀시킨다.',
    src: '상황별 p34',
    trap: '차단하고 바로 넣으면 안 된다. 약 30초 이상 지난 뒤 복귀시키는 것이 절차다.',
  },
  {
    id: 'q-pis-setter',
    symptom: '표시기(PIS) 통신고장입니다. 표시기 설정기 전원을 확인하려 합니다.',
    answer: ['PISCN'],
    explain: 'PISC의 PWR LED 점등을 확인하고 배전반의 PISCN을 확인한다.',
    src: '상황별 p35',
  },
  {
    id: 'q-pis-front',
    symptom: 'PIS 통신고장 — 정면 열번 행선 표시기 전원을 확인하려 합니다.',
    answer: ['FTNDDN'],
    explain: '전원이 차단됐으면 복귀시킨 뒤 TCMS 고장 소거를 확인한다.',
    src: '상황별 p35',
  },
  {
    id: 'q-pis-cabin',
    symptom: 'PIS 통신고장 — 객실 안내 표시기 전원을 확인하려 합니다.',
    answer: ['PIDN'],
    explain: '전원이 차단됐으면 복귀시킨 뒤 TCMS 고장 소거를 확인한다.',
    src: '상황별 p35',
  },
  {
    id: 'q-pa',
    symptom: '해당 운전실의 방송과 통화가 되지 않습니다.',
    answer: ['PACN'],
    explain: '자동방송장치(PAC) 전원이다. 차단 여부를 확인하고 POWER 보드의 5V·15V·24V LED 점등도 확인한다.',
    src: '상황별 p36',
  },

  // ── 조명 ──
  {
    id: 'q-light-ac',
    symptom: '객실등이 모두 꺼졌습니다. 교류 조명등 쪽을 확인하려 합니다.',
    answer: ['RALpN'],
    explain: '배전반과 제어대 양쪽의 RALpN을 확인 복귀한다.',
    src: '상황별 p25',
  },
  {
    id: 'q-light-dc',
    symptom: '객실등이 모두 꺼졌습니다. 직류 조명등 쪽을 확인하려 합니다.',
    answer: ['RDLpN'],
    explain: '배전반과 제어대 양쪽의 RDLpN을 확인 복귀한다. 직류 실내등은 비상조명 역할을 겸한다.',
    src: '상황별 p25',
  },

  // ── 돌리는 스위치 ──
  {
    id: 'q-pabbps',
    symptom: '주차제동이 완해 스위치·수동조작기구·수동완해 고리로도 풀리지 않아 동력운전이 불가합니다.',
    answer: ['PABBPS'],
    explain: 'Tc차 운전실 백월부의 주차제동 바이패스를 취급한다(관제와 협의).',
    src: '상황별 p32',
  },
  {
    id: 'q-zvbps',
    symptom: '영속도계전기(ZVR) 고장으로 출입문 개폐 취급이 되지 않습니다.',
    answer: ['ZVBPS'],
    explain: '바이패스로 조작하여 출입문 개폐가 되게 한다.',
    src: '교재 p63',
  },
  {
    id: 'q-dbs',
    symptom: '전 차량 출입문이 열리지 않습니다. DOS 3회, ATCN 확인까지 했는데도 안 됩니다.',
    answer: ['DBS'],
    explain: '관제 승인 후 전·후부차 DBS를 취급하고 열기를 시도한다.',
    src: '상황별 p19',
    trap: '출입문이 열린 상태에서도 DBS를 취급하면 DOOR등이 점등된다. 운행 중 DOOR등이 꺼지면 즉시 비상정차.',
  },
  {
    id: 'q-mrbps',
    symptom: '주공기압력스위치 고장으로 비상제동이 체결됐습니다.',
    answer: ['MRBPS'],
    explain: '바이패스로 조작하여 비상제동을 완해할 수 있다.',
    src: '교재 p63',
  },
  {
    id: 'q-eros',
    symptom: 'EO 모드 절차 중입니다. 엔코더 NFB를 내렸습니다. 다음으로 취급할 것은?',
    answer: ['EROS'],
    explain: 'EROS에서 EO 모드를 선택한 뒤 운전모드를 수동 또는 비상으로 고른다.',
    src: '상황별 p37',
    trap: 'EROS는 넣는 것만 조치가 아니다. 비상제동이 완해되지 않을 때 전·후부 EROS가 EO/R1/R2에 있으면 N으로 되돌리는 것이 조치다.',
  },
  {
    id: 'q-ucpb',
    symptom: '자동연결기로 연결된 열차를 분리하려 합니다. MR 밸브를 닫아 MR 공급을 차단했습니다.',
    answer: ['UCPB'],
    explain: '자동연결기 완해 버튼을 누르면 해방용 전자밸브가 여자되어 연결기가 풀린다. 분리 후 다시 눌러 복귀시킨다.',
    src: '교재 p124',
  },
];
