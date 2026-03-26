// 최종 분석: 수정 확정 항목 + 의심 케이스 분류
// 정답 확인된 것만 수정, 나머지는 리포트

const fs = require('fs');
const path = require('path');

const schedulesPath = path.join(__dirname, '..', 'src', 'data', 'schedules.ts');
let code = fs.readFileSync(schedulesPath, 'utf8');
code = code.replace(/^import\s+type\s+.*$/gm, '');
code = code.replace(/export const S:\s*ScheduleDB\s*=\s*/, 'var S = ');
eval(code);

function classify(num) {
  const even = num % 2 === 0;
  if (num >= 5500 && num <= 5899) return { line: '마', up: even };
  if (num >= 5000 && num <= 5499) return { line: '하', up: even };
  if (num >= 1000 && num <= 1999) return { line: '기', up: even };
  if (num >= 2000 && num <= 2999) return { line: '미', up: even };
  if (num >= 5900 && num <= 5999) return { line: '회', up: even };
  return { line: '?', up: null };
}
function t2m(str) { const [h,m]=str.split(':').map(Number); return h*60+m; }

// ─── 유형별 분류 ───

// 유형 A: "답X답" 패턴인데 소요시간이 왕복보다 훨씬 길면 → 중간 경유역 누락
// 유형 B: 기지 입출고 경로가 "방마" 왕복으로 표현됨 (실제는 회송+기지)
// 유형 C: 단일 열차 "답" (실제 36분) → 답→어딘가(영?)까지 이동
// 유형 D: "기방마답" (예상 205분, 실제 70분) → 기지 출고+짧은 운행

console.log('=== 확정 수정 (진호 확인) ===\n');

// 다이아 2: "답하답,답하답" → "답하영,영하답"
const d2 = S.p_ord['2'];
console.log(`p_ord 다이아 2:`);
console.log(`  현재: ${d2.m}`);
console.log(`  수정: 답하영,영하답`);
console.log(`  근거: 진호 확인`);
console.log(`  seg1: ${d2.g[0].d}→${d2.g[0].a} (${t2m(d2.g[0].a)-t2m(d2.g[0].d)}분) = 답→하(36)+하→영(60)=96분+대기29분`);
console.log(`  seg2: ${d2.g[1].d}→${d2.g[1].a} (${t2m(d2.g[1].a)-t2m(d2.g[1].d)}분) = 영→하(60)+하→답(36)=96분+대기19분`);

console.log('\n=== 유형별 의심 케이스 (p_ord) ===\n');

// 유형 A: "답X답" 왕복에서 소요시간 불일치
console.log('--- 유형 A: 왕복 소요시간 불일치 ---');
const typeA_ref = {
  '답하답': 72,  // 36+36
  '답마답': 52,  // 26+26
};

for (const [diaNum, data] of Object.entries(S.p_ord)) {
  if (!data.g || data.g.length === 0 || data.m.includes('충당')) continue;
  if (['51','52','53','54'].includes(diaNum)) continue;

  const segs = data.m.split(',');
  for (let si = 0; si < data.g.length && si < segs.length; si++) {
    const m = segs[si];
    const dur = t2m(data.g[si].a) - t2m(data.g[si].d);
    const expected = typeA_ref[m];
    if (expected && dur > expected + 40) {
      console.log(`  다이아${diaNum} seg${si+1}: "${m}" 예상${expected}분 실제${dur}분 (+${dur-expected}분)`);
      console.log(`    열차: ${data.g[si].n.map(t=>`${t}(${classify(t).line}${classify(t).up?'↑':'↓'})`).join(' ')}`);
      // 추정: 답→하→영 왕복?
      if (m === '답하답' && dur > 100) {
        console.log(`    → 가능성: "답하영" 또는 "답하방" (상행으로 더 진행)`);
      }
      if (m === '답마답' && dur > 80) {
        console.log(`    → 가능성: "답마방" (상행으로 더 진행)`);
      }
    }
  }
}

// 유형 B: 기지 입고 패턴
console.log('\n--- 유형 B: 기지 입고 경로 (회송 포함) ---');
for (const [diaNum, data] of Object.entries(S.p_ord)) {
  if (!data.g || data.g.length === 0 || data.m.includes('충당')) continue;
  if (['51','52','53','54'].includes(diaNum)) continue;

  const segs = data.m.split(',');
  for (let si = 0; si < data.g.length && si < segs.length; si++) {
    const m = segs[si];
    const dur = t2m(data.g[si].a) - t2m(data.g[si].d);
    const trains = data.g[si].n;

    // "답마방마기" 패턴 (257분 예상, 실제 ~65분)
    if (m.includes('방마기') && dur < 100) {
      console.log(`  다이아${diaNum} seg${si+1}: "${m}" 실제${dur}분 → 실제 경로는 답→마→(회송)→기?`);
      // 열차 패턴: 마↓ + 회↑ + 회↓ + 기↓ = 답→마→회송→기지
      const pattern = trains.map(t => classify(t).line).join('');
      console.log(`    열차패턴: ${pattern} (${trains.join(',')})`);
    }

    // "기방마답" 패턴 (205분 예상, 실제 ~70분)
    if (m === '기방마답' && dur < 100) {
      console.log(`  다이아${diaNum} seg${si+1}: "${m}" 실제${dur}분 → 실제 경로는 기→(회송)→마→답?`);
      const pattern = trains.map(t => classify(t).line).join('');
      console.log(`    열차패턴: ${pattern} (${trains.join(',')})`);
    }

    // "답방하기" 패턴 — 답→방→하→기? 실제로는?
    if (m === '답방하기' && dur < 200) {
      const expected = 60+96+5; // 답→방(60)+방→하(96)+하→기(5) = 161
      if (dur < expected - 20) {
        console.log(`  다이아${diaNum} seg${si+1}: "${m}" 예상${expected}분 실제${dur}분`);
      }
    }
  }
}

// 유형 C: 단일 열차 "답"
console.log('\n--- 유형 C: 단일 열차 "답" (0분→36분) ---');
for (const [diaNum, data] of Object.entries(S.p_ord)) {
  if (!data.g || data.g.length === 0 || data.m.includes('충당')) continue;
  if (['51','52','53','54'].includes(diaNum)) continue;

  const segs = data.m.split(',');
  for (let si = 0; si < data.g.length && si < segs.length; si++) {
    if (segs[si] === '답') {
      const dur = t2m(data.g[si].a) - t2m(data.g[si].d);
      const train = data.g[si].n[0];
      const c = classify(train);
      console.log(`  다이아${diaNum} seg${si+1}: "답" 실제${dur}분 열차:${train}(${c.line}${c.up?'↑':'↓'})`);
      if (c.up && dur > 20) {
        console.log(`    → 가능성: "답영" (상행 24분 구간)`);
      }
    }
  }
}

// 유형 D: "답방하" (156분 예상, 실제 ~130분)
console.log('\n--- 유형 D: "답방하" 소요시간 불일치 (모든 인스턴스) ---');
let count = 0;
for (const [prefix, dias] of Object.entries(S)) {
  for (const [diaNum, data] of Object.entries(dias)) {
    if (!data.g || data.g.length === 0 || data.m.includes('충당')) continue;
    const segs = data.m.split(',');
    for (let si = 0; si < data.g.length && si < segs.length; si++) {
      if (segs[si] === '답방하') {
        const dur = t2m(data.g[si].a) - t2m(data.g[si].d);
        if (count < 5) {
          console.log(`  ${prefix}/${diaNum} seg${si+1}: "${segs[si]}" 실제${dur}분`);
        }
        count++;
      }
    }
  }
}
console.log(`  (총 ${count}건, "답방하" = 실제 ~129-135분, 예상 156분)`);
console.log(`  → 이건 대기시간 미포함 계산이 156분이고, 교대/대기 시간이 마이너스가 될 수 없으므로`);
console.log(`  → "답방하" 경로에서 하남검단산까지 안 가고 중간역(상일동?)에서 끝나거나`);
console.log(`  → 기준 소요시간이 틀렸을 가능성 (답→방이 60분보다 짧거나)`);

// 유형 E: "답방마" (146분 예상, 실제 ~129-135분) - 비슷한 패턴
console.log('\n--- 유형 E: "답방마" 소요시간 불일치 (모든 인스턴스) ---');
let countE = 0;
for (const [prefix, dias] of Object.entries(S)) {
  for (const [diaNum, data] of Object.entries(dias)) {
    if (!data.g || data.g.length === 0 || data.m.includes('충당')) continue;
    const segs = data.m.split(',');
    for (let si = 0; si < data.g.length && si < segs.length; si++) {
      if (segs[si] === '답방마') {
        const dur = t2m(data.g[si].a) - t2m(data.g[si].d);
        if (countE < 5) {
          console.log(`  ${prefix}/${diaNum} seg${si+1}: "${segs[si]}" 실제${dur}분`);
        }
        countE++;
      }
    }
  }
}
console.log(`  (총 ${countE}건, "답방마" = 실제 ~129-135분, 예상 146분)`);
console.log(`  → 교대 시간 ~15분이면 146-15=131분, 합리적. 이건 OK.`);

console.log('\n=== 결론 ===');
console.log('확정 수정: 다이아 2 (p_ord) "답하답,답하답" → "답하영,영하답"');
console.log('의심 - 유형 B (기지 입출고): 약호가 실제 경로와 다를 수 있으나, 업계 관행일 수 있음');
console.log('의심 - 유형 D/E: 소요시간 차이가 있지만 대기시간 변동 범위 내');
console.log('');
console.log('진호 확인 필요:');
console.log('1. "답마방마기" (65분) - 답→마→(회송)→기지가 맞는지, 또는 약호가 관행적 표현인지');
console.log('2. "기방마답" (70분) - 기지→(회송)→마→답이 맞는지');
console.log('3. "답방하" (130분) - 하남검단산까지 아니면 상일동/중간역까지인지');
console.log('4. "답" 단일 열차 (36분) - 답→영등포구청인지');
