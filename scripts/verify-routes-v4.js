// v4: 정답 분석을 반영한 정확한 행로 추정
// 핵심 규칙:
// 1. 상행(짝수) 마지막 열차 = 답십리까지 (방화까지 아님!)
// 2. 하행(홀수) 마지막 열차 = 종점까지
// 3. 방향 전환점 = 종점역
// 4. 기지 입출고 = 특수 처리
// 5. 짧은 소요시간 = 중간역 하차 가능
//
// 정답 케이스 분석:
// 51-seg1: 하↑ 마↓ 마↑ = 답방마답 (198분) → 상행 마지막 = 답십리까지
// 51-seg2: 하↓ 하↑ = 답하답 (79분) → 상행 마지막 = 답십리까지
// 52-seg1: 하↓ 회↑ 미↑ = 답하미기 (65분) → 하행→회송→기지
// 52-seg2: 하↑ 하↓ = 답방답 (128분) → 상행→하행 = 방화에서 전환→답
//   실제로 이건 "하↑=하→방, 하↓=방→하" → 그런데 m이 "답방답"
//   즉 하↑ = 답→방 (답십리에서 출발, 방화 방면)
//   하↓ = 방→답 (방화에서 출발, 답십리까지만)
//   128분: 60(답→방) + 60(방→답) = 120분 + 대기 ≈ 128분 ✓
//   아! "답방답"이므로 마지막 하행이 답까지만 간 것
//   근데 5129는 하남 하행인데? → 하남 방면이지만 답십리에서 하차
//
// 다시 분석: 52-seg2: 5130(하↑) 5129(하↓)
//   5130 = 하남 상행 = 하남검단산→방화 방면 열차
//   5129 = 하남 하행 = 방화→하남검단산 방면 열차
//   m = "답방답" = 답십리→방화→답십리
//   이건 답십리에서 5130(상행) 타고 방화까지 → 방화에서 5129(하행) 타고 답십리까지
//   소요시간: 60 + 60 + 대기 = 128분 ✓

// 53-seg2: 5132(하↑) 5655(마↓)
//   m = "답방답" → 이게 아니라 "답방답"인데...
//   잠깐, 53-seg2 m = "답방답"
//   5132 하↑ = 답→방 (60분)
//   5655 마↓ = 방→마천 방면 → 마지막이 마↓인데 m이 "답"으로 끝남
//   133분: 60(답→방) + 마↓ 73분 정도
//   하지만 m = "답방답"이므로 마↓가 답십리까지만 운전
//   133분: 60 + 60 = 120 + 대기 13분... 가능
//
//   아! 5655 = 마천 하행 = 방화→마천 방면
//   답→방(60분) → 방→답(60분) = 120분, 133분이면 대기 포함 맞음
//   마천 방면 하행이지만 답십리에서 내린 것!

// 핵심 발견: "답방답"에서 마지막 열차가 하행이어도 답십리까지만!
// 소요시간이 ~120분이면 답→방→답 왕복

// 54-seg1: 5565(마↓) 5564(마↑) 5601(마↓) = "답마방답" (197분)
//   마↓(답→마) + 마↑(마→방) + 마↓(방→마) = 답→마→방→마
//   하지만 m = "답마방답" = 답→마→방→답
//   마지막 마↓가 답까지만?? 197분이면 26+86+26=138 + 대기...
//   아니면 마↓(방→마) 가 아니라 방→답 인건가
//
//   5601 = 마천 하행 = 방화→마천 방면 열차
//   "답마방답" 이므로 5601 타고 방화에서 답십리까지만 운전 (60분)
//   26(답→마) + 86(마→방) + 60(방→답) = 172분 + 대기 25분 ≈ 197분 ✓

// 결론: **하행 마지막 열차도 중간역(답십리)에서 하차 가능**
// 소요시간 기반으로 판단해야 함

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
  if (num >= 9000 && num <= 9999) return { line: '회9', up: null };
  return { line: '?', up: null };
}

function t2m(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function isNormal(d) { return d.line === '마' || d.line === '하'; }

// ─── 소요시간 기준 (분) ───
const T = {
  '답방': 60, '답마': 26, '답하': 36, '답영': 24, '답강': 15,
  '답상': 30, '답기': 33, '답둔': 20, '답미': 33,
  '방답': 60, '마답': 26, '하답': 36, '영답': 24,
  '마방': 86, '하방': 96, '방마': 86, '방하': 96,
  '기답': 33, '기방': 93,
};

function estimateSeg(trains, dep, arr) {
  if (!trains || trains.length === 0) return '?';

  const dur = t2m(arr) - t2m(dep);
  const dirs = trains.map(t => ({ num: t, ...classify(t) }));

  // 일반 열차(마/하)만 필터하되 순서 유지
  const normals = dirs.filter(d => isNormal(d));

  // 특수열차 위치 분석
  const hasKijiEnd = dirs.length > 0 && (dirs[dirs.length-1].line === '기' || dirs[dirs.length-1].line === '미');
  const hasKijiEndUp = hasKijiEnd && dirs[dirs.length-1].up;
  const hasKijiStart = dirs.length > 0 && (dirs[0].line === '기' || dirs[0].line === '미');
  const hasKijiStartUp = hasKijiStart && dirs[0].up;

  // 기지 입고로 끝나는 경우 체크 (회송 후 기지 입고)
  let endsWithKiji = false;
  for (let i = dirs.length - 1; i >= 0; i--) {
    if (dirs[i].line === '회' || dirs[i].line === '회9') continue;
    if (dirs[i].line === '기' && !dirs[i].up) { endsWithKiji = true; break; }
    if (dirs[i].line === '미' && !dirs[i].up) { endsWithKiji = true; break; } // 2000대 홀수도 기지 입고
    break;
  }
  // 기지 출고로 시작하는 경우
  let startsFromKiji = false;
  for (let i = 0; i < dirs.length; i++) {
    if (dirs[i].line === '회' || dirs[i].line === '회9') continue;
    if (dirs[i].line === '기' && dirs[i].up) { startsFromKiji = true; break; }
    if (dirs[i].line === '미' && dirs[i].up) { startsFromKiji = true; break; }
    break;
  }
  // 2000대도 확인 - 하남기지 출고(짝수) / 입고(홀수)
  if (!startsFromKiji && dirs[0].line === '미' && dirs[0].up) startsFromKiji = true;
  // 2000대 홀수(하남기지 입고) — 답→미사 방면
  if (!endsWithKiji) {
    for (let i = dirs.length - 1; i >= 0; i--) {
      if (dirs[i].line === '회' || dirs[i].line === '회9') continue;
      if (dirs[i].line === '미' && dirs[i].up) { /* 출고는 시작 */ break; }
      if (dirs[i].line === '미' && !dirs[i].up) { endsWithKiji = true; break; }
      break;
    }
  }

  const route = [];

  // ─── 출발역 ───
  if (startsFromKiji) {
    route.push('기');
  } else {
    // 첫번째 일반 열차 기준
    if (normals.length > 0) {
      const first = normals[0];
      if (first.up) {
        // 상행 출발 — 종점에서? 답십리에서?
        // 정답 분석: 상행 첫 열차 = 항상 답십리에서 출발 (기본)
        // 단, 세그먼트 시작이 종점(마/하)에서일 수도 있음
        // → 이전 세그먼트의 도착지가 종점이었으면 그곳에서 출발
        // → 단일 세그먼트 분석에서는 모르므로, 답십리 기본
        route.push('답');
      } else {
        route.push('답');
      }
    } else {
      route.push('답');
    }
  }

  // ─── 경유역 (방향 전환점) ───
  let prevNormal = null;
  for (const d of normals) {
    if (prevNormal === null) {
      prevNormal = d;
      continue;
    }

    // 방향 전환
    if (prevNormal.up && !d.up) {
      // 상행→하행 = 방화에서 전환
      route.push('방');
    } else if (!prevNormal.up && d.up) {
      // 하행→상행 = 종점에서 전환
      route.push(prevNormal.line);
    } else if (prevNormal.up && d.up) {
      // 상행→상행
      if (prevNormal.line !== d.line) {
        // 노선 전환: 답십리에서 환승
        route.push('답');
      }
      // 같은 노선 상행 연속: 연속 운행 or 답십리 경유
      // → 보통 답십리에서 교대
      else {
        route.push('답');
      }
    } else if (!prevNormal.up && !d.up) {
      // 하행→하행
      if (prevNormal.line !== d.line) {
        route.push('답');
      } else {
        // 같은 노선 하행 연속은 드문 케이스
        // 종점 도착 후 다시 같은 방향? → 답십리 경유
        route.push('답');
      }
    }

    prevNormal = d;
  }

  // ─── 도착역 ───
  if (endsWithKiji) {
    route.push('기');
  } else if (normals.length > 0) {
    const last = normals[normals.length - 1];
    if (last.up) {
      // 상행 마지막 = 답십리까지 (핵심 규칙!)
      // 단, 소요시간이 매우 짧으면 중간역
      route.push('답');
    } else {
      // 하행 마지막 = 소요시간으로 판단
      // 전체 경로에서 마지막 하행의 도착 추정
      // → 기본적으로 종점까지
      // → 단, 소요시간이 짧으면 중간역(강동/답십리 등)

      // 마지막 하행 열차의 시작점과 소요시간 추정
      const lastTurnIdx = route.length - 1;
      const lastTurn = route[lastTurnIdx];

      // 마지막 경유역에서 하행 종점까지의 예상 소요시간
      // → 너무 복잡하므로, 기본적으로 종점으로 판단
      // → 정답 확인: 54-seg1 "답마방답" — 마↓ 마지막인데 "답"
      //   이건 소요시간 기반으로 중간 하차를 판단해야 하는 케이스

      // 더 정확한 방법: 누적 소요시간 계산
      const endStation = estimateLastStation(route, last, dur);
      route.push(endStation);
    }
  }

  // 연속 중복 제거
  const deduped = [];
  for (const s of route) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== s) {
      deduped.push(s);
    }
  }

  return deduped.join('');
}

function estimateLastStation(route, lastDir, totalDur) {
  // 전체 경로의 누적 소요시간 계산하여 마지막 역 추정
  // route: 지금까지의 경유역 배열
  // lastDir: 마지막 일반 열차 방향
  // totalDur: 세그먼트 총 소요시간(분)

  // 누적 소요시간 계산
  let cumulativeTime = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i];
    const to = route[i + 1];
    const key = `${from}${to}`;
    cumulativeTime += (T[key] || 30); // 기본 30분
  }

  // 남은 시간
  const remaining = totalDur - cumulativeTime;
  const lastStop = route[route.length - 1];

  // 마지막 역에서 하행 방향으로 remaining 분 이동한 곳
  if (lastDir.line === '마') {
    // 마천 하행
    const distToMa = T[`${lastStop}마`] || T[`답마`] || 26;
    const distToGang = T[`${lastStop}강`] || T[`답강`] || 15;
    const distToAns = T[`${lastStop}답`] || T[`방답`] || 60;

    if (remaining >= distToMa - 5) return '마';
    if (remaining >= distToGang - 5) return '강';
    return '답'; // 짧으면 답십리까지만
  }

  if (lastDir.line === '하') {
    const distToHa = T[`${lastStop}하`] || T[`답하`] || 36;
    const distToSang = T[`${lastStop}상`] || T[`답상`] || 30;
    const distToAns = T[`${lastStop}답`] || T[`방답`] || 60;

    if (remaining >= distToHa - 5) return '하';
    if (remaining >= distToSang - 5) return '상';
    return '답';
  }

  return lastDir.line;
}

// ─── 보호 다이아 ───
const PROTECTED = {
  'p_ord': ['51', '52', '53', '54'],
  'p_ordord': ['82'],
};

// ─── 다이아 2번 특수 처리 검증 ───
// 정답: "답하영,영하답" (w: "8:59")
// 이건 현재 schedules.ts에서 "답하답,답하답"로 되어있음

// ─── 분석 실행 ───
const diffs = [];
let total = 0, match = 0;

for (const [prefix, dias] of Object.entries(S)) {
  for (const [diaNum, data] of Object.entries(dias)) {
    if (!data.g || data.g.length === 0) continue;
    if (data.m.includes('충당') || data.m.includes('운휴') || data.m.includes('대휴')) continue;

    total++;
    const segRoutes = [];
    for (const seg of data.g) {
      segRoutes.push(estimateSeg(seg.n, seg.d, seg.a));
    }
    const estimated = segRoutes.join(',');

    if (estimated === data.m) {
      match++;
    } else {
      diffs.push({
        prefix, diaNum, currentM: data.m, estimated,
        isProtected: (PROTECTED[prefix] || []).includes(diaNum),
        segs: data.g.map(s => ({
          d: s.d, a: s.a, dur: t2m(s.a) - t2m(s.d),
          trains: s.n,
          tdesc: s.n.map(t => { const c = classify(t); return `${t}(${c.line}${c.up?'↑':'↓'})`; }).join(' '),
        })),
      });
    }
  }
}

console.log(`검사 ${total} | 일치 ${match} | 차이 ${diffs.length}\n`);

// 보호 다이아 확인
const prot = diffs.filter(d => d.isProtected);
if (prot.length > 0) {
  console.log('=== 보호 다이아 (추정 오차 확인) ===');
  for (const d of prot) {
    console.log(`  ${d.prefix}/${d.diaNum}: 정답="${d.currentM}" 추정="${d.estimated}"`);
    for (const s of d.segs) console.log(`    ${s.d}→${s.a}(${s.dur}분) ${s.tdesc}`);
  }
  console.log('');
}

// p_ord만 상세 출력 (평일)
const normOrd = diffs.filter(d => !d.isProtected && d.prefix === 'p_ord');
console.log(`=== p_ord 수정 후보 (${normOrd.length}건) ===\n`);
for (const d of normOrd) {
  console.log(`다이아 ${d.diaNum}: "${d.currentM}" → "${d.estimated}"`);
  for (const s of d.segs) console.log(`  ${s.d}→${s.a}(${s.dur}분) ${s.tdesc}`);
}

// 나머지 시트 요약
console.log(`\n=== 다른 시트 차이 요약 ===`);
for (const prefix of ['p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol']) {
  const items = diffs.filter(d => !d.isProtected && d.prefix === prefix);
  if (items.length > 0) {
    console.log(`\n--- ${prefix} (${items.length}건) ---`);
    for (const d of items) {
      console.log(`  ${d.diaNum}: "${d.currentM}" → "${d.estimated}"`);
    }
  }
}
