#!/usr/bin/env node
/**
 * 계정 정합성 점검 — 코드 명단(cycle.ts · auth.ts) vs Supabase driver_profiles
 *
 * 왜 필요한가:
 *   create-accounts.js 는 insert 만 하고 기존 계정은 스킵한다.
 *   그래서 코드 명단이 바뀌어도(퇴직·복귀·직책변경) DB 는 예전 값 그대로 남는다.
 *   2026-07 실제 사례 3건:
 *     - 최창욱·이지훈: 병가 중 내근직 → 승무 복귀했는데 person_id 가 '0'(내근직 표식) 그대로
 *     - 조임현: 일반 기관사인데 role='admin' 이 남아 관리자 대시보드 접근 가능
 *
 * 사용법:
 *   node scripts/audit-accounts.js          # 점검만 (아무것도 바꾸지 않음)
 *   node scripts/audit-accounts.js --fix    # 자동 수정 가능한 항목만 수정
 *
 * --fix 로 고치는 것 (기계적으로 정답이 정해지는 것만):
 *   [A] 개발자가 아닌데 role='admin'  → 'driver'
 *   [B] person_id 가 코드 순번과 불일치 → 코드 값으로 갱신
 *
 * --fix 로도 안 고치는 것 (사람이 판단해야 함 — 보고만):
 *   [C] 내근직 명단에 있는데 승무 교번 보유 (신분 모순)
 *   [D] 코드 어디에도 없는 계정 (퇴직자 잔여 등) — 삭제는 위험하므로 보고만
 *   [E] 코드에 있는데 DB 계정 없음 (로그인 실패) → create-accounts.js 안내
 *   [F] 이름 불일치
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const FIX = process.argv.includes('--fix');

/**
 * DB role='admin' 을 가져야 하는 개발자 계정.
 * 사업소 관리자(auth.ts ADMIN_SABUNS)와는 별개 체계 — 소장·부소장도 role 은 'driver' 가 정상.
 */
const DEV_ADMINS = {
  '00000001': '이진호(관리자)',
  '030827': 'jinho',
  '21711694': '이현구',
};

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
);

// ── 코드 명단 파싱 (TS 를 직접 import 할 수 없어 정규식으로 읽는다) ──
function readCode() {
  const root = path.join(__dirname, '..');
  const cycleSrc = fs.readFileSync(path.join(root, 'src/data/cycle.ts'), 'utf8');
  const authSrc = fs.readFileSync(path.join(root, 'src/lib/auth.ts'), 'utf8');

  // cycle.ts: {I:"36",d:"24",n:"최창욱",s:"21715684"}
  // ⚠️ 뒤에 필드가 더 붙는 경우가 있다 — 통상근무 기관사는 {I:"W1",...,s:"...",w:3}
  //    따라서 닫는 중괄호를 요구하면 안 된다(W1~W4 가 통째로 누락됨).
  const cycle = new Map();
  for (const m of cycleSrc.matchAll(/\{I:"([^"]*)",d:"([^"]*)",n:"([^"]+)",s:"([^"]+)"/g)) {
    cycle.set(m[4], { I: m[1], d: m[2], n: m[3], s: m[4] });
  }

  // auth.ts 의 export const <NAME>: Person[] = [ ... ];
  const block = (name) => {
    const i = authSrc.indexOf(`export const ${name}`);
    if (i < 0) throw new Error(`auth.ts 에서 ${name} 를 찾지 못했습니다`);
    return authSrc.slice(i, authSrc.indexOf('];', i));
  };
  const people = (txt) =>
    [...txt.matchAll(/n:\s*'([^']+)',\s*s:\s*'([^']+)'/g)].map((m) => ({ n: m[1], s: m[2] }));

  const extra = people(block('EXTRA_USERS'));
  const intern = people(block('INTERN_USERS'));

  // ADMIN_SABUNS = new Set([...])
  const ai = authSrc.indexOf('const ADMIN_SABUNS');
  const adminBlk = authSrc.slice(ai, authSrc.indexOf(']', ai));
  const admins = new Set((adminBlk.match(/'(\d{8})'/g) || []).map((x) => x.replace(/'/g, '')));

  return { cycle, extra, intern, admins };
}

/** 이 사번의 올바른 person_id (모르면 null) */
function expectedPersonId(sabun, code) {
  const c = code.cycle.get(sabun);
  if (c) return c.I; // 승무 순번 보유(W1~W5 포함)가 최우선
  if (code.extra.some((u) => u.s === sabun) || code.intern.some((u) => u.s === sabun)) return '0';
  return null; // 코드에 없는 계정 → 판단 불가
}

/** 코드상 이름 (모르면 null) */
function codeName(sabun, code) {
  return (
    code.cycle.get(sabun)?.n ??
    code.extra.find((u) => u.s === sabun)?.n ??
    code.intern.find((u) => u.s === sabun)?.n ??
    null
  );
}

async function main() {
  const code = readCode();
  const { data: profiles, error } = await supabase
    .from('driver_profiles')
    .select('sabun,name,role,person_id,is_active');
  if (error) {
    console.error('❌ DB 조회 실패:', error.message);
    process.exit(1);
  }
  const bySabun = new Map(profiles.map((p) => [p.sabun, p]));

  console.log(`\n📋 계정 정합성 점검 ${FIX ? '(--fix: 자동 수정 실행)' : '(점검만 — 아무것도 바꾸지 않음)'}`);
  console.log(`   코드: 기관사 ${code.cycle.size}명 · 내근직 ${code.extra.length}명 · 인턴 ${code.intern.length}명 · 사업소관리자 ${code.admins.size}명`);
  console.log(`   DB  : 계정 ${profiles.length}개\n`);

  const A = [], B = [], C = [], D = [], E = [], F = [];

  for (const p of profiles) {
    if (p.person_id === 'ADMIN') continue; // 개발자 전용 계정 — 순번 검사 대상 아님

    // [A] 개발자가 아닌데 role='admin'
    if (p.role === 'admin' && !DEV_ADMINS[p.sabun]) A.push(p);

    // [B] person_id 불일치
    const want = expectedPersonId(p.sabun, code);
    if (want !== null && p.person_id !== want) B.push({ ...p, want });

    // [D] 코드 어디에도 없는 계정
    if (want === null) D.push(p);

    // [F] 이름 불일치
    const cn = codeName(p.sabun, code);
    if (cn && cn !== p.name) F.push({ ...p, codeName: cn });
  }

  // [C] 내근직 명단에 있는데 승무 교번 보유 (d='내근' 인 부소장은 정상)
  for (const u of code.extra) {
    const c = code.cycle.get(u.s);
    if (c && c.d !== '내근') C.push({ ...u, I: c.I, d: c.d });
  }

  // [E] 코드에 있는데 DB 계정 없음
  const codeAll = [
    ...[...code.cycle.values()].filter((c) => !c.n.startsWith('결원')),
    ...code.extra,
    ...code.intern,
  ];
  for (const u of codeAll) if (!bySabun.has(u.s)) E.push(u);

  // ── 보고 ──
  const section = (title, rows, render) => {
    console.log(`── ${title} : ${rows.length}건 ${rows.length ? '❌' : '✅'}`);
    rows.forEach((r) => console.log(`     ${render(r)}`));
    if (rows.length) console.log('');
  };

  section('[A] 개발자 아닌데 관리자 권한(role=admin)', A, (r) => `${r.name}(${r.sabun}) — role='admin' → 'driver' 로 회수 필요`);
  section('[B] person_id 가 코드 순번과 불일치', B, (r) => `${r.name}(${r.sabun}) — DB='${r.person_id}' → 코드='${r.want}'`);
  section('[C] 내근직 명단인데 승무 교번 보유 (사람 판단 필요)', C, (r) => `${r.n}(${r.s}) — cycle 순번 ${r.I}, 교번 '${r.d}' · 승무 복귀했다면 내근직 명단에서 제거`);
  section('[D] 코드에 없는 계정 (퇴직자 잔여 등 · 보고만)', D, (r) => `${r.name}(${r.sabun}) — person_id='${r.person_id}', active=${r.is_active}`);
  section('[E] 코드에 있는데 DB 계정 없음 (로그인 실패)', E, (r) => `${r.n}(${r.s}) — node scripts/create-accounts.js 로 생성 필요`);
  section('[F] 이름 불일치', F, (r) => `${r.sabun} — DB='${r.name}' vs 코드='${r.codeName}'`);

  // ── 자동 수정 ──
  const fixable = A.length + B.length;
  if (!FIX) {
    console.log(`📊 자동 수정 가능: ${fixable}건 (A ${A.length} · B ${B.length})`);
    if (fixable) console.log('   → 수정하려면: node scripts/audit-accounts.js --fix');
    console.log(`   사람 판단 필요: ${C.length + D.length + E.length + F.length}건 (C ${C.length} · D ${D.length} · E ${E.length} · F ${F.length})\n`);
    return;
  }

  let done = 0, fail = 0;
  for (const r of A) {
    const { error: e } = await supabase.from('driver_profiles').update({ role: 'driver' }).eq('sabun', r.sabun);
    if (e) { console.log(`  ❌ ${r.name} role 회수 실패 — ${e.message}`); fail++; }
    else { console.log(`  ✅ ${r.name}(${r.sabun}) role: 'admin' → 'driver'`); done++; }
  }
  for (const r of B) {
    const { error: e } = await supabase.from('driver_profiles').update({ person_id: r.want }).eq('sabun', r.sabun);
    if (e) { console.log(`  ❌ ${r.name} person_id 갱신 실패 — ${e.message}`); fail++; }
    else { console.log(`  ✅ ${r.name}(${r.sabun}) person_id: '${r.person_id}' → '${r.want}'`); done++; }
  }
  console.log(`\n📊 수정 ${done}건, 실패 ${fail}건`);
  console.log(`   사람 판단 필요 ${C.length + D.length + E.length + F.length}건은 그대로 두었습니다.\n`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
