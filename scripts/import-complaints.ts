/**
 * 민원 분석 집계표(엑셀) → DB — 내 정보 화면의 민원 등급·원문.
 *
 * 사용: npx tsx scripts/import-complaints.ts ["<집계표.xlsx>"] [--dry-run]
 *   기본 경로: 바탕화면 «출입문 관련 자료\민원분석\민원 분석 집계표.xlsx»
 *   - 시트: 「단계(출입문)」「단계(전체 불만)」(단계·사건 수) · 「기관사별」(유형별 건수) · 「전체목록」(한 건씩)
 *   - 이름 → 사번은 앱 명부(getRoster 오늘 + 내근 + 인턴)로 맞춘다. 못 맞추면 멈춘다.
 *   - 매번 통째로 바꾼다(새 달 자료가 오면 엑셀을 다시 만들고 이것만 다시 돌리면 된다).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { getRoster } from '../src/data/cycle';
import { officeUsers, internUsers } from '../src/lib/auth';
import { stageOf, type Stage } from '../src/features/myinfo/lib/complaintStages';

const DEFAULT = path.join(os.homedir(), 'Desktop', '출입문 관련 자료', '민원분석', '민원 분석 집계표.xlsx');
const file = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? DEFAULT;
const DRY = process.argv.includes('--dry-run');

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }),
);

type Row = (string | number | null)[];
const rowsOf = (wb: XLSX.WorkBook, name: string): Row[] => {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`엑셀에 「${name}」 시트가 없어요`);
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null, raw: true });
};
const str = (v: unknown) => (v == null ? '' : String(v).trim());
const num = (v: unknown) => (typeof v === 'number' ? v : Number(str(v)) || 0);
const day = (v: unknown) => (/^\d{4}-\d{2}-\d{2}/.test(str(v)) ? str(v).slice(0, 10) : null);

/** 「단계(…)」 시트의 명단 — 헤더(단계·구분·기관사…) 아래 줄들 */
function stageList(rows: Row[]) {
  const h = rows.findIndex((r) => str(r[0]) === '단계' && str(r[2]) === '기관사');
  if (h < 0) throw new Error('단계 명단 머리줄을 못 찾았어요');
  return rows.slice(h + 1).filter((r) => /^\d단계$/.test(str(r[0])) && str(r[2]));
}

async function main() {
  console.log('엑셀:', file);
  const wb = XLSX.read(fs.readFileSync(file));

  // 이름 → 사번 (앱 명부)
  const people = [...getRoster(new Date()), ...officeUsers(), ...internUsers()]
    .filter((p) => p.s && !/^결원/.test(p.n));
  const byName = new Map<string, Set<string>>();
  for (const p of people) {
    const set = byName.get(p.n) ?? new Set<string>();
    set.add(p.s!); byName.set(p.n, set);
  }
  const sabunOf = (name: string) => {
    const set = byName.get(name);
    if (!set || set.size === 0) throw new Error(`앱 명부에 없는 이름: ${name}`);
    if (set.size > 1) throw new Error(`같은 이름이 둘 이상: ${name} (${[...set].join(', ')})`);
    return [...set][0];
  };

  // 단계 두 기준
  const door = new Map(stageList(rowsOf(wb, '단계(출입문)')).map((r) => [str(r[2]), r]));
  const all = new Map(stageList(rowsOf(wb, '단계(전체 불만)')).map((r) => [str(r[2]), r]));
  // 기관사별 — 유형별 건수
  const pr = rowsOf(wb, '기관사별');
  const head = pr[0].map(str);
  const col = (n: string) => { const i = head.indexOf(n); if (i < 0) throw new Error(`「기관사별」에 «${n}» 열이 없어요`); return i; };
  const TYPE_COLS = ['신체끼임', '승하차중 닫음', '부상 주장', '닫힘방송 없음', '하차중 닫힘', '탑승 실패', '교통약자', '조기출발', '안내방송', '운전·정차'];
  const perPerson = new Map(pr.slice(1).filter((r) => str(r[0])).map((r) => [str(r[0]), r]));

  // 전체목록 — 분석 포함 건만
  const lr = rowsOf(wb, '전체목록');
  const lh = lr[0].map(str);
  const L = (n: string) => { const i = lh.indexOf(n); if (i < 0) throw new Error(`「전체목록」에 «${n}» 열이 없어요`); return i; };
  const included = lr.slice(1).filter((r) => str(r[L('분석 포함')]) === '포함');
  const dates = included.map((r) => day(r[L('날짜')])).filter((d): d is string => !!d).sort();
  const periodFrom = dates[0], periodTo = dates[dates.length - 1];

  const now = new Date().toISOString();
  const peopleRows = [...door.keys()].map((name) => {
    const d = door.get(name)!, a = all.get(name), p = perPerson.get(name);
    if (!a || !p) throw new Error(`두 기준·기관사별 시트에 같이 있지 않은 이름: ${name}`);
    const doorStage = Number(str(d[0])[0]) as Stage, allStage = Number(str(a[0])[0]) as Stage;
    const doorEvents = num(d[3]), allEvents = num(a[3]), praise = num(d[5]);
    if (stageOf('door', doorEvents, praise) !== doorStage) console.warn(`  ! ${name}: 출입문 ${doorEvents}건인데 ${doorStage}단계`);
    if (stageOf('all', allEvents, praise) !== allStage) console.warn(`  ! ${name}: 전체 ${allEvents}건인데 ${allStage}단계`);
    return {
      sabun: sabunOf(name), name,
      door_events: doorEvents, door_complaints: num(p[col('출입문 민원수')]),
      all_events: allEvents, all_complaints: num(p[col('전체 불만')]),
      praise, injury: num(d[6]),
      door_stage: doorStage, all_stage: allStage,
      mgmt: str(p[col('관리 구분')]),
      detail: {
        types: Object.fromEntries(TYPE_COLS.map((c) => [c, num(p[col(c)])])),
        mainStations: str(p[col('주요 역')]), mainTimes: str(p[col('주요 시간대')]),
        otherComplaints: str(d[8]), chance: str(p[col('우연일 확률')]),
      },
      first_date: day(p[col('첫 민원')]), last_date: day(p[col('마지막 민원')]),
      period_from: periodFrom, period_to: periodTo, updated_at: now,
    };
  });

  // 원본 표에서 두 줄로 적힌 이름이 붙어 오는 경우(«원천연이석칠») — 명부의 두 이름으로 나뉘면 나눈다
  const splitKnown = (s: string): string[] => {
    if (byName.has(s)) return [s];
    for (let i = 2; i <= s.length - 2; i++) {
      if (byName.has(s.slice(0, i)) && byName.has(s.slice(i))) return [s.slice(0, i), s.slice(i)];
    }
    return [s];
  };
  const caseRows: Record<string, unknown>[] = [];
  for (const r of included) {
    const names = str(r[L('기관사')]).split(/[/,\n]/).map((s) => s.trim())
      .filter((s) => s && !s.startsWith('(수습)')).flatMap(splitKnown);
    for (const name of names) {
      caseRows.push({
        sabun: sabunOf(name), name, row_no: num(r[L('번호')]), case_date: day(r[L('날짜')]),
        kind: str(r[L('다시 분류(주)')]), kinds: str(r[L('다시 분류(전체)')]), flags: str(r[L('표시')]),
        report_type: str(r[L('보고서 유형')]), station: str(r[L('역')]), time_band: str(r[L('시간대')]),
        direction: str(r[L('방향')]), train_no: str(r[L('열차번호')]), formation: str(r[L('편성')]),
        content: str(r[L('민원 내용')]), shared: names.length > 1,
      });
    }
  }
  console.log(`기관사 ${peopleRows.length}명 · 민원 ${included.length}건(사람별 ${caseRows.length}줄) · 기간 ${periodFrom} ~ ${periodTo}`);
  if (DRY) return;

  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  for (const t of ['complaint_cases', 'complaint_people']) {
    const { error } = await sb.from(t).delete().neq('sabun', '');
    if (error) throw error;
  }
  const { error: e1 } = await sb.from('complaint_people').insert(peopleRows);
  if (e1) throw e1;
  for (let i = 0; i < caseRows.length; i += 500) {
    const { error } = await sb.from('complaint_cases').insert(caseRows.slice(i, i + 500));
    if (error) throw error;
  }
  console.log('DB 에 넣었어요.');
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
