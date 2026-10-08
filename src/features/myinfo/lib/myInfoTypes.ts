/** GET /api/my-info 응답 — 화면과 API 가 같은 모양을 본다 */
import type { Stage } from './complaintStages';

export interface ComplaintCase {
  date: string | null;
  kind: string;
  kinds: string;
  flags: string;
  station: string;
  timeBand: string;
  direction: string;
  trainNo: string;
  content: string;
  shared: boolean;
}

export interface ComplaintInfo {
  doorEvents: number;
  doorComplaints: number;
  allEvents: number;
  allComplaints: number;
  praise: number;
  injury: number;
  doorStage: Stage;
  allStage: Stage;
  mgmt: string;
  /** 유형별 건수(엑셀 「기관사별」 열 이름 → 건수) */
  types: Record<string, number>;
  mainStations: string;
  mainTimes: string;
  otherComplaints: string;
  chance: string;
  firstDate: string | null;
  lastDate: string | null;
  /** 연도별 불만 사건(민원 날짜 기준) */
  byYear: { year: string; door: number; all: number }[];
  cases: ComplaintCase[];
}

export interface ComplaintSummary {
  periodFrom: string;
  periodTo: string;
  people: number;
  avgDoor: number;
  avgAll: number;
  /** 단계별 인원 [1단계, …, 7단계] */
  doorDist: number[];
  allDist: number[];
  /** 나보다 출입문 사건이 많은 사람 수 / 같은 사람 수 — «상위 몇 %» 계산용 */
  doorMore: number;
  doorSame: number;
}

export interface MyInfoData {
  person: { sabun: string; name: string; role: string };
  /** 열람자가 본인이 아닌 사람을 보는 중인가 */
  viewingOther: boolean;
  complaint: { info: ComplaintInfo | null; summary: ComplaintSummary | null };
  safety: {
    driving: { total: number; read: number; unread: number; unreadTitles: { id: string; title: string; date: string }[] };
    train: { total: number; read: number; unread: number };
    rollcall: { days: number; workDays: number; readDays: number };
  };
  activity: { visitDays30: number; visitDays90: number; lastVisit: string | null; firstLogin: string | null };
  edu: {
    quiz: { count: number; avg: number; best: number; recent: { mode: string; percent: number; score: number; total: number; at: string }[] };
    levels: { name: string; score: number; passed: boolean; at: string }[];
    integrity: { score: number; total: number; at: string } | null;
  };
  games: {
    best: { game: string; label: string; score: number; lowerIsBetter: boolean; plays: number }[];
    fame: { game: string; label: string; year: number; month: number; rank: number }[];
    multi: { game: string; label: string; rating: number; wins: number; losses: number }[];
  };
  jido: { quarter: string; quarterCount: number; total: number; last: string | null } | null;
}
