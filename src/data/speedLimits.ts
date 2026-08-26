// ===== 운행 속도 기준 (SSOT) =====
//
// 기관사가 지켜야 하는 제한속도를 한곳에 모은다. 「제한속도 운전」 게임이 이 목록으로
// 구간을 만들고, 앞으로 속도 관련 화면이 생기면 같은 파일을 본다.
//
// 왜 한곳인가
//   값이 바뀌었는데 게임에만 옛 숫자가 남으면, 게임이 규정보다 오래 기억에 남는다.
//   실제로 기지구내가 25 → 20 으로 바뀐 적이 있다(아래 depot 주석 참고).
//
// 고칠 때
//   숫자만 고치지 말고 source(근거)도 함께 맞출 것. 게임은 틀렸을 때 이 근거를 보여준다.

export type SpeedGroup = 'abnormal' | 'restrict' | 'depot' | 'disaster' | 'fault';

export interface SpeedRule {
  /** 게임 점수·복습에서 구간을 구분하는 키 */
  id: string;
  /** 제한속도 (km/h) — 이 값을 넘기면 안 된다 */
  limit: number;
  /** 화면에 뜨는 상황 */
  label: string;
  /** 틀렸을 때 보여 줄 근거 */
  source: string;
  group: SpeedGroup;
}

export const SPEED_GROUP_LABEL: Record<SpeedGroup, string> = {
  abnormal: '비정상 운행',
  restrict: '각종 속도의 제한',
  depot: '차량기지 구내',
  disaster: '이례상황·재해',
  fault: '차량 고장',
};

export const SPEED_RULES: SpeedRule[] = [
  // ── 비정상 운행 (신규기관사 핸드북) ──
  { id: 'jeollyeong', limit: 25, label: '전령법 시행', source: '전령법 25km/h 이하 · 01코드 현시 시 15km/h 스위치', group: 'abnormal' },
  { id: 'jiryeong', limit: 45, label: '지령식 시행', source: '지령식 45km/h 이하 · 폐색구간마다 관제 출발지시', group: 'abnormal' },
  { id: 'milgi', limit: 25, label: '추진(밀기)운전', source: '추진운전 25km/h 이하 · 구원 연결하여 추진운전 시', group: 'abnormal' },
  { id: 'toehaeng', limit: 15, label: '퇴행운전', source: '퇴행운전 15km/h 이하 · 열차 표지 변경하지 않음', group: 'abnormal' },
  { id: 'bisang', limit: 15, label: '비상운전', source: '비상운전 15km/h 이하 · 관제 지시를 받을 수 없어 무폐색운전', group: 'abnormal' },

  // ── 각종 속도의 제한 (운전취급규정 제104조) ──
  { id: 'doedori', limit: 25, label: '되돌이운전', source: '제104조 · 25km/h (승인 못 받았을 때는 15km/h 이하)', group: 'restrict' },
  { id: 'hubu', limit: 25, label: '후부 자력운전', source: '제104조 · 25km/h', group: 'restrict' },
  { id: 'mupyesaek', limit: 15, label: '무폐색운전', source: '제104조 · 15km/h · 운전관제 승인 후 시행', group: 'restrict' },
  { id: 'susinho', limit: 25, label: '진행수신호로 진입', source: '제104조 · 25km/h · 다음 신호기 또는 정차위치까지', group: 'restrict' },
  { id: 'atcbi', limit: 25, label: 'ATC 비설비구간 운전', source: '제104조 · 25km/h', group: 'restrict' },
  { id: 'jinro', limit: 25, label: '진로개통표시 불량', source: '제104조 · 25km/h · 최후부 차량이 표시기를 통과할 때까지', group: 'restrict' },
  { id: 'atcgojang', limit: 45, label: 'ATC·ATO 고장', source: '제104조 · 45km/h (확인운전 시 15km/h)', group: 'restrict' },
  { id: 'daehyang', limit: 25, label: '선로전환기 대향 운전', source: '제104조 · 25km/h · 연동장치로 잠금한 경우는 제외', group: 'restrict' },
  { id: 'tonggwa', limit: 45, label: '정거장 승강장 통과', source: '제104조 · 45km/h · 정차하는 열차는 예외', group: 'restrict' },
  { id: 'jidotongsin', limit: 45, label: '지도통신식 시행', source: '제104조 · 45km/h', group: 'restrict' },

  // ── 차량기지 구내 (제100조 · 차량기지운전취급내규 제11조) ──
  // 2026년 25 → 20 으로 변경. 규정 원문과 옛 표에는 아직 25 로 남아 있으니 여기 값이 기준이다.
  { id: 'gijigunae', limit: 20, label: '기지구내 수동운전', source: '기지구내 20km/h 이하 (25 → 20 변경) · 환호도 20(YARD)', group: 'depot' },
  /* 차량입환은 제104조에 25 로 적혀 있지만, 기지구내에서 하는 입환은 기지구내 속도(20)를 따른다.
     답십리 기관사가 실제로 하는 입환은 기지구내라 20 이 맞다. */
  { id: 'iphwan', limit: 20, label: '차량입환 (기지구내)', source: '기지구내 입환 20km/h 이하 · 제104조 차량입환은 25 이지만 기지구내는 20', group: 'depot' },
  { id: 'gongjang', limit: 5, label: '검수고·공장 내 운전', source: '제100조 · 5km/h 이하', group: 'depot' },
  { id: 'jeonsak', limit: 5, label: '전삭고선·하부검사선 진입', source: '5km/h 이하 · 우선멈춤표지 5m 전방 일단정차 후 협의', group: 'depot' },
  { id: 'sechuk', limit: 5, label: '자동세척기로 세척', source: '5km/h 이하 · 세척고 전방 일단정차 후', group: 'depot' },
  { id: 'sechukno', limit: 15, label: '세척하지 않고 세척고 통과', source: '15km/h 이하', group: 'depot' },
  { id: 'insang', limit: 15, label: '인상선 진입', source: '제100조 · 15km/h 이하', group: 'depot' },
  { id: 'banghyang', limit: 15, label: '방향전환선 운전', source: '차량기지운전취급내규 제11조 · 15km/h 이하', group: 'depot' },
  /* 시험선 운전(60) 제외 — ATC 지령속도를 따르는 자리라 "정해진 한 숫자"를 외우는
     이 게임의 문제로는 맞지 않는다(진호 요청). */

  // ── 이례상황·재해 (제349·356조) ──
  { id: 'jijingyeongbo', limit: 25, label: '지진경보 발령', source: '제356조 · 25km/h 이하 주의운전', group: 'disaster' },
  { id: 'jijinbisang', limit: 15, label: '지진 비상경보 발령', source: '제356조 · 15km/h 이하 주의운전', group: 'disaster' },
  { id: 'chimsu', limit: 15, label: '선로 침수 (레일면 이하)', source: '제349조 · 일단정차 후 확인, 15km/h 이하 주의운전', group: 'disaster' },

  // ── 차량 고장 ──
  /* TCU 고장·EO 선택(45)과 컴퓨터(TC·LIU) 고장(35) 제외 — 차종에 따라 값이 달라
     하나로 외울 숫자가 아니다(진호 요청). */
  { id: 'jedongchuk80', limit: 60, label: '제동축수 80% 이상', source: '연결축수 100에 대하여 제동축수 80% 이상 · 60km/h 이하', group: 'fault' },
  { id: 'jedongchuk40', limit: 45, label: '제동축수 40~80% 미만', source: '연결축수 100에 대하여 40% 이상~80% 미만 · 45km/h 이하', group: 'fault' },
  { id: 'sidan', limit: 60, label: '승강장 시단 진입 (요구제동)', source: '요구제동 취급상태에서 60km/h 이하', group: 'fault' },
];
