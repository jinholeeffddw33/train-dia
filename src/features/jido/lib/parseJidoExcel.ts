/**
 * 지도승무 실적 엑셀 → 앱 데이터.
 *
 * 사업소에서 쓰는 두 가지 양식을 모두 읽는다(2026-10 받은 파일 기준).
 *   ① «지도요원 지도승무실적(분기).xlsm»
 *      - [지도승무]            연번 | 승무원(사번·성명) | 지도(사번·성명) | 지도일자 | 월 | 출발역 | 도착역 | 편성번호 | 열차번호
 *      - [지도승무 실적확인]    사번 | 이름 | … | 담당부장          → 기관사별 담당부장
 *      - [중점관리]            지정시작일 | 지정종료일 | 사번 | 성명 | … | 구분 | 사유  → 중점관리자
 *   ② «지도승무실적현황(게시용).xlsx»
 *      - [20xx년 N분기]        사번 | 기관사 | 지도기관사 | 승무날짜 | 편성 | 열차번호 | 출발역 | 도착역
 *        (지도요원 사번이 없고 이름만 있다)
 *
 * 열 위치를 박아 두지 않고 머리글 글자로 찾는다 — 양식이 조금 바뀌어도 읽히게.
 * 화면(브라우저)과 첫 적재 스크립트(scripts/import-jido-excel.ts)가 같은 함수를 쓴다.
 */
import type { WorkBook, WorkSheet } from 'xlsx';

export interface JidoRideInput {
  date: string;            // YYYY-MM-DD
  driverSabun: string;
  driverName: string;
  guideSabun: string | null;
  guideName: string;
  trainNo: string;
  formation: string;
  fromStation: string;
  toStation: string;
}

export interface JidoRosterInput {
  driverSabun: string;
  driverName: string;
  manager?: string;        // 담당부장 이름
  focusReason?: string;    // 중점관리 구분·사유
  focusFrom?: string;      // YYYY-MM-DD
  focusTo?: string;
}

export interface JidoParseResult {
  rides: JidoRideInput[];
  roster: JidoRosterInput[];
  /** 어느 시트에서 몇 건을 읽었는지 — 화면에 그대로 보여 준다 */
  sources: string[];
  /** 읽지 못하고 건너뛴 줄 */
  skipped: number;
}

type Row = unknown[];
type Utils = {
  sheet_to_json: (ws: WorkSheet, opts: { header: 1; raw: true; defval: null }) => Row[];
};

const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, '');
const text = (v: unknown) => String(v ?? '').trim();
const sabunOf = (v: unknown) => {
  const s = text(v).replace(/\.0$/, '');
  return /^[0-9A-Za-z]{6,10}$/.test(s) ? s : '';
};

/** 엑셀 날짜(Date · 일련번호 · '2026.09.30' · '2026-09-30') → YYYY-MM-DD */
export function toISODate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // SheetJS 는 날짜를 «그 지역 자정에서 몇 초 모자란» 시각으로 줄 때가 있다(7/10 → 7/9 23:59:52).
    // 반나절을 더해 가장 가까운 날로 맞춘 뒤 지역 기준으로 읽는다.
    const t = new Date(v.getTime() + 12 * 3600_000);
    const y = t.getFullYear(), m = t.getMonth() + 1, d = t.getDate();
    if (y < 2000) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && v > 30000 && v < 80000) {
    const ms = Math.round((v - 25569) * 864e5);
    const dt = new Date(ms);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
  }
  const m = /^(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/.exec(text(v));
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}

/** 머리글 줄 찾기 — 주어진 낱말이 모두 들어 있는 첫 줄(위 15줄 안) */
function findHeader(rows: Row[], must: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = rows[i].map(norm);
    if (must.every((w) => cells.some((c) => c.includes(w)))) return i;
  }
  return -1;
}

/** 두 줄 머리글(위: 승무원/지도, 아래: 사번/성명)을 한 줄 이름으로 — «승무원.사번», «지도.성명» */
function headerNames(rows: Row[], h: number): string[] {
  const top = rows[h].map(norm);
  const sub = (rows[h + 1] ?? []).map(norm);
  const names: string[] = [];
  let group = '';
  const width = Math.max(top.length, sub.length);
  for (let c = 0; c < width; c++) {
    if (top[c]) group = top[c];
    const s = sub[c];
    names.push(s && (s === '사번' || s === '성명') ? `${group}.${s}` : top[c] || '');
  }
  return names;
}

function readRideSheet(rows: Row[]): { rides: JidoRideInput[]; skipped: number } | null {
  // ① xlsm [지도승무] — 두 줄 머리글
  let h = findHeader(rows, ['승무원', '지도', '지도일자']);
  if (h >= 0) {
    const names = headerNames(rows, h);
    const col = (n: string) => names.findIndex((x) => x === n || x.startsWith(n));
    const c = {
      dS: col('승무원.사번'), dN: col('승무원.성명'), gS: col('지도.사번'), gN: col('지도.성명'),
      date: col('지도일자'), from: col('출발역'), to: col('도착역'), form: col('편성'), train: col('열차번호'),
    };
    if (c.dS < 0 || c.gN < 0 || c.date < 0) return null;
    return collect(rows.slice(h + 2), c);
  }
  // ② 게시용 [20xx년 N분기] — 한 줄 머리글
  h = findHeader(rows, ['사번', '기관사', '지도기관사', '승무날짜']);
  if (h >= 0) {
    const top = rows[h].map(norm);
    const col = (n: string) => top.findIndex((x) => x === n);
    const c = {
      dS: col('사번'), dN: col('기관사'), gS: -1, gN: col('지도기관사'),
      date: col('승무날짜'), from: col('출발역'), to: col('도착역'), form: col('편성'), train: col('열차번호'),
    };
    if (c.dS < 0 || c.gN < 0 || c.date < 0) return null;
    return collect(rows.slice(h + 1), c);
  }
  return null;
}

function collect(
  body: Row[],
  c: { dS: number; dN: number; gS: number; gN: number; date: number; from: number; to: number; form: number; train: number },
): { rides: JidoRideInput[]; skipped: number } {
  const rides: JidoRideInput[] = [];
  let skipped = 0;
  const at = (r: Row, i: number) => (i >= 0 ? r[i] : null);
  for (const r of body) {
    const driverSabun = sabunOf(at(r, c.dS));
    const guideName = text(at(r, c.gN)).replace(/\(.*?\)/g, '').trim();
    const date = toISODate(at(r, c.date));
    // 빈 줄(연번만 있는 줄)은 조용히 넘기고, 반쯤 찬 줄만 «건너뜀»으로 센다
    if (!driverSabun && !guideName && !date) continue;
    if (!driverSabun || !guideName || !date) { skipped++; continue; }
    rides.push({
      date,
      driverSabun,
      driverName: text(at(r, c.dN)),
      guideSabun: sabunOf(at(r, c.gS)) || null,
      guideName,
      trainNo: text(at(r, c.train)),
      formation: text(at(r, c.form)),
      fromStation: text(at(r, c.from)),
      toStation: text(at(r, c.to)),
    });
  }
  return { rides, skipped };
}

/** [지도승무 실적확인] — 기관사별 담당부장 */
function readManagerSheet(rows: Row[]): JidoRosterInput[] | null {
  const h = findHeader(rows, ['사번', '이름', '담당부장']);
  if (h < 0) return null;
  const top = rows[h].map(norm);
  const cS = top.indexOf('사번'), cN = top.indexOf('이름'), cM = top.findIndex((x) => x.startsWith('담당부장'));
  const out: JidoRosterInput[] = [];
  for (const r of rows.slice(h + 1)) {
    const s = sabunOf(r[cS]);
    const m = text(r[cM]);
    if (!s || !m) continue;
    out.push({ driverSabun: s, driverName: text(r[cN]), manager: m });
  }
  return out;
}

/** [중점관리] — 중점관리자 지정 기간·사유 */
function readFocusSheet(rows: Row[]): JidoRosterInput[] | null {
  const h = findHeader(rows, ['지정시작일', '지정종료일', '사번', '성명']);
  if (h < 0) return null;
  const top = rows[h].map(norm);
  const ci = (n: string) => top.findIndex((x) => x === n);
  const cFrom = ci('지정시작일'), cTo = ci('지정종료일'), cS = ci('사번'), cN = ci('성명'), cK = ci('구분'), cR = ci('사유');
  const out: JidoRosterInput[] = [];
  for (const r of rows.slice(h + 1)) {
    const s = sabunOf(r[cS]);
    const from = toISODate(r[cFrom]);
    const to = toISODate(r[cTo]);
    if (!s || !from || !to) continue;
    const kind = text(r[cK]);
    const why = text(r[cR]);
    out.push({
      driverSabun: s,
      driverName: text(r[cN]),
      focusFrom: from,
      focusTo: to,
      focusReason: [kind, why && why !== kind ? why : ''].filter(Boolean).join(' · '),
    });
  }
  return out;
}

/**
 * 통합 문서 전체를 읽는다. 숨긴 시트도 읽는다(xlsm 의 담당부장·중점관리 시트가 숨겨져 있다).
 * 기록 시트가 여러 개면(게시용 파일의 지난 분기 시트) 모두 읽되, 사번이 없는 옛 양식 줄은 건너뛴다.
 */
export function parseJidoWorkbook(wb: WorkBook, utils: Utils): JidoParseResult {
  const rides: JidoRideInput[] = [];
  const roster = new Map<string, JidoRosterInput>();
  const sources: string[] = [];
  let skipped = 0;

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

    const r = readRideSheet(rows);
    if (r && r.rides.length > 0) {
      rides.push(...r.rides);
      skipped += r.skipped;
      sources.push(`${name}: 지도승무 ${r.rides.length}건`);
      continue;
    }
    const m = readManagerSheet(rows);
    if (m && m.length > 0) {
      for (const x of m) roster.set(x.driverSabun, { ...roster.get(x.driverSabun), ...x });
      sources.push(`${name}: 담당부장 ${m.length}명`);
      continue;
    }
    const f = readFocusSheet(rows);
    if (f && f.length > 0) {
      for (const x of f) {
        const prev = roster.get(x.driverSabun);
        roster.set(x.driverSabun, { ...prev, ...x, driverName: prev?.driverName || x.driverName });
      }
      sources.push(`${name}: 중점관리자 ${f.length}명`);
    }
  }

  // 같은 기록이 두 번 들어 있으면 하나만(같은 날·같은 기관사·같은 지도요원·같은 열차)
  const seen = new Set<string>();
  const unique = rides.filter((x) => {
    const k = `${x.date}|${x.driverSabun}|${x.guideName}|${x.trainNo}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { rides: unique, roster: [...roster.values()], sources, skipped };
}
