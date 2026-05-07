// 교번 계산 sanity 점검 — 5/5 기준일 검증
import { CYCLE, DB_STD, CL, P, WEEKDAY_REF, WEEKDAY_DIAS } from '../src/data/cycle.ts';
import { TRANSITION_MAY_2026 } from '../src/data/transition.ts';

const HOL = {};
function isHoliday(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function countWeekdays(from, to) {
  const dir = to >= from ? 1 : -1;
  let count = 0;
  const d = new Date(from);
  if (dir === 1) {
    d.setDate(d.getDate() + 1);
    while (d <= to) { if (!isHoliday(d)) count++; d.setDate(d.getDate() + 1); }
  } else {
    while (d > to) { if (!isHoliday(d)) count--; d.setDate(d.getDate() - 1); }
  }
  return count;
}

function getDia(person, date) {
  if (!person) return '~';
  if (person.w !== undefined) {
    if (isHoliday(date)) return '휴일';
    const wd = countWeekdays(WEEKDAY_REF, date);
    return WEEKDAY_DIAS[((wd + person.w) % 4 + 4) % 4];
  }
  if (date.getFullYear() === 2026 && date.getMonth() === 4) {
    const day = date.getDate();
    if (day >= 1 && day <= 4 && person.s) {
      const tr = TRANSITION_MAY_2026[person.s];
      if (tr) return tr[day - 1];
    }
  }
  const r = CYCLE.indexOf(person.d);
  if (r === -1) return person.d;
  const diff = Math.floor((date.getTime() - DB_STD.getTime()) / 864e5);
  return CYCLE[((r + diff) % CL + CL) % CL];
}

console.log('=== 교번 계산 검증 ===');
console.log(`CYCLE 길이: ${CYCLE.length} (예상 ${CL})`);
console.log(`인원수: ${P.length}`);
console.log(`DB_STD: ${DB_STD.toDateString()}`);

// 1) DB_STD에 각 인원의 d 값과 CYCLE 매칭 검증
console.log('\n=== 기준일(DB_STD) 자기 d 매칭 ===');
let ok = 0, fail = 0;
for (const p of P.slice(0, 20)) {
  if (p.w !== undefined) continue;
  const dia = getDia(p, DB_STD);
  if (dia === p.d) { ok++; }
  else {
    fail++;
    console.log(`  FAIL ${p.n}(${p.I}): d=${p.d}, getDia=${dia}`);
  }
}
console.log(`  처음 20명 중 OK=${ok}, FAIL=${fail}`);

// 2) Transition 검증 (5/1~5/4)
console.log('\n=== Transition 검증 (5/1~5/4) ===');
const t = TRANSITION_MAY_2026['21714375']; // 조임현
for (let day = 1; day <= 4; day++) {
  const d = new Date(2026, 4, day);
  const p = P.find((x) => x.s === '21714375');
  const dia = getDia(p, d);
  const expected = t[day - 1];
  console.log(`  5/${day} ${p.n}: ${dia} (예상: ${expected}) ${dia === expected ? 'OK' : 'FAIL'}`);
}

// 3) 5/5 (오늘) 새 cycle 검증 — 첫 10명
console.log('\n=== 2026-05-05 (오늘) 첫 10명 교번 ===');
const today = new Date(2026, 4, 5);
for (const p of P.slice(0, 10)) {
  const dia = getDia(p, today);
  console.log(`  ${p.n.padEnd(6)} (${p.I.padStart(3)}) d=${p.d.padEnd(6)} → ${dia}`);
}

// 4) 통상근무 4명 검증
console.log('\n=== 통상근무 (51~54) 5/5(화) ===');
for (const p of P) {
  if (p.w !== undefined) {
    const dia = getDia(p, today);
    console.log(`  ${p.n}: w=${p.w} → ${dia}`);
  }
}

// 5) 같은 dia가 같은 날짜에 여러 명 나오는지 확인 (정상이면 1명)
console.log('\n=== 5/5 dia 중복 확인 (정상=중복없음) ===');
const map = new Map();
for (const p of P) {
  if (p.w !== undefined) continue;
  const dia = getDia(p, today);
  if (dia.startsWith('휴') || dia.endsWith('~')) continue; // 휴무/비번 제외
  const list = map.get(dia) || [];
  list.push(p.n);
  map.set(dia, list);
}
let dup = 0;
for (const [dia, list] of map) {
  if (list.length > 1) {
    dup++;
    console.log(`  중복: ${dia} → ${list.join(', ')}`);
  }
}
console.log(`  중복 dia 수: ${dup} (정상=0)`);

// 6) 5/4 → 5/5 연속성 (transition 마지막 → cycle 첫날)
console.log('\n=== 5/4 → 5/5 연속성 (조임현) ===');
const p1 = P.find((x) => x.s === '21714375');
console.log(`  5/4: ${getDia(p1, new Date(2026,4,4))} (transition 마지막)`);
console.log(`  5/5: ${getDia(p1, new Date(2026,4,5))} (cycle 첫날)`);

console.log('\n검증 완료.');
