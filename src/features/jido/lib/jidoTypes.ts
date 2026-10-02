/** 지도승무 — 화면과 서버가 함께 쓰는 모양 */
export interface JidoRide {
  id: number;
  date: string;              // YYYY-MM-DD
  driverSabun: string;
  driverName: string;
  guideSabun: string | null;
  guideName: string;
  trainNo: string;
  formation: string;
  fromStation: string;
  toStation: string;
  source: 'manual' | 'upload';
  createdBy: string | null;  // 넣은 사람 사번 — 지울 수 있는지 판단
}

export interface JidoRosterEntry {
  driverSabun: string;
  driverName: string;
  manager: string | null;     // 담당부장
  focusReason: string | null; // 중점관리 사유
  focusFrom: string | null;
  focusTo: string | null;
}
