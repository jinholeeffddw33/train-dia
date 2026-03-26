// v3: schedules.ts를 eval로 로드하고, 각 세그먼트별 열차 시퀀스로 행로 추정
// 핵심: "열차번호 방향"으로 경유역 추적

const fs = require('fs');
const path = require('path');

// ─── schedules.ts 로드 (eval) ───
const schedulesPath = path.join(__dirname, '..', 'src', 'data', 'schedules.ts');
let code = fs.readFileSync(schedulesPath, 'utf8');
// TypeScript import/type 제거
code = code.replace(/^import\s+type\s+.*$/gm, '');
code = code.replace(/export const S:\s*ScheduleDB\s*=\s*/, 'var S = ');
eval(code);
if (typeof S === 'undefined') throw new Error('S not loaded');

// ─── 열차 방향 ───
// 5호선 기준:
//   짝수 = 상행 = 마천/하남 → 답십리 → 방화 방면
//   홀수 = 하행 = 방화 → 답십리 → 마천/하남 방면
//
// 열차번호 대역:
//   5000-5499: 하남검단산 지선
//   5500-5899: 마천 지선
//   5900-5999: 회송
//   1000-1999: 고덕기지 입출고
//   2000-2999: 하남기지(미사 근처) 입출고
//   9000-9999: 특수(회송 등)

function classify(num) {
  const even = num % 2 === 0;
  if (num >= 5500 && num <= 5899) return { line: '마', up: even };
  if (num >= 5000 && num <= 5499) return { line: '하', up: even };
  if (num >= 1000 && num <= 1999) return { line: '기', up: even };
  if (num >= 2000 && num <= 2999) return { line: '미', up: even };  // 하남기지=미사 근처
  if (num >= 5900 && num <= 5999) return { line: '회', up: even };
  if (num >= 9000 && num <= 9999) return { line: '회9', up: null };
  return { line: '?', up: null };
}

// 시간 → 분
function t2m(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

// ─── 세그먼트별 행로 약호 추정 ───
// 열차 시퀀스에서 운전자가 이동하는 경로를 추정
//
// 운전자 관점:
// - 하행(홀) 열차 탑승 = 방화→마천/하남 방향 운전
//   → 답십리에서 타면 마천/하남 종점까지
// - 상행(짝) 열차 탑승 = 마천/하남→방화 방향 운전
//   → 답십리에서 타면 방화까지
// - 중간역에서 하차 가능 (소요시간으로 판단)
//
// 핵심 참조 소요시간:
// 답→방 60분 / 답→마 26분 / 답→하 36분
// 답→영 24분 / 답→강 15분 / 답→상 30분 / 답→기 33분

function estimateSeg(trains, dep, arr) {
  if (!trains || trains.length === 0) return '?';

  const dur = t2m(arr) - t2m(dep);
  const dirs = trains.map(t => classify(t));

  // 경로 추적: 운전자의 출발역→경유역→도착역
  const stops = [];
  let pos = null; // 현재 위치

  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[i];
    const num = trains[i];
    const prev = i > 0 ? dirs[i-1] : null;

    // === 특수 열차 처리 ===
    if (d.line === '회' || d.line === '회9') {
      // 회송은 방향 전환 구간 — 경로에 직접 영향 안 줌
      // 단, 입고 전 회송이면 위치 유지
      continue;
    }

    if (d.line === '기') {
      if (d.up) {
        // 기지→답 방면 출고 (짝수)
        pos = '기';
        if (stops.length === 0) stops.push('기');
      } else {
        // 답→기지 입고 (홀수)
        pos = '기';
        // 입고는 마지막에 '기' 추가
      }
      continue;
    }

    if (d.line === '미') {
      if (d.up) {
        // 미사(하남기지)→답 방면 출고
        pos = '기';
        if (stops.length === 0) stops.push('기');
      } else {
        // 답→미사 기지 입고
        pos = '기';
      }
      continue;
    }

    // === 일반 열차 ===
    // 첫 열차일 때 출발역 결정
    if (stops.length === 0) {
      if (d.up) {
        // 상행(짝) = 종점에서 방화 방면
        // 첫 열차가 상행이면, 종점에서 출발
        // 하지만! 답십리에서도 상행 탑승 가능 (답→방)
        // 소요시간으로 판단
        // 짝수 상행이면 종점(마/하)에서 출발 OR 답에서 출발
        // → 해당 세그먼트의 전체 소요시간과 열차 개수로 판단해야 함
        // 간단히: 세그먼트 시작이 상행이면, 어디서 시작?
        //   → 보통 답십리에서 시작 (운전자 기준)
        //   → 소요시간이 긴 경우 종점에서 출발일 수도 있음
        stops.push('답'); // 기본: 답십리 출발
        pos = '답';
      } else {
        // 하행(홀) = 방화에서 종점 방면
        stops.push('답'); // 기본: 답십리 출발
        pos = '답';
      }
    }

    // 이전 열차와 방향 전환 체크
    if (prev && isNormalLine(prev) && isNormalLine(d)) {
      if (prev.up && !d.up) {
        // 상행→하행: 방화에서 방향 전환
        if (stops[stops.length-1] !== '방') stops.push('방');
        pos = '방';
      } else if (!prev.up && d.up) {
        // 하행→상행: 종점에서 방향 전환
        const term = prev.line; // 마 or 하
        if (stops[stops.length-1] !== term) stops.push(term);
        pos = term;
      } else if (prev.up && d.up && prev.line !== d.line) {
        // 상행→상행이지만 노선 전환 (마→하 or 하→마)
        // 답십리에서 갈아탐
        if (stops[stops.length-1] !== '답') stops.push('답');
        pos = '답';
      } else if (!prev.up && !d.up && prev.line !== d.line) {
        // 하행→하행 노선 전환
        // 강동에서 분기 — 답십리 경유
        if (stops[stops.length-1] !== '답') stops.push('답');
        pos = '답';
      }
    }

    // 이전이 특수열차(기지 출고 등)였고 현재가 일반열차
    if (prev && (prev.line === '기' || prev.line === '미') && isNormalLine(d)) {
      // 기지 출고 후 일반 열차 탑승
      // pos는 이미 '기' or '답'
    }

    // 현재 열차의 도착 추적
    if (d.up) {
      pos = '방'; // 방화 방면
    } else {
      pos = d.line; // 마천 or 하남
    }
  }

  // 마지막 역 추가
  const lastDir = dirs[dirs.length - 1];
  if (lastDir.line === '기' || lastDir.line === '미') {
    if (stops[stops.length-1] !== '기') stops.push('기');
  } else if (lastDir.line === '회' || lastDir.line === '회9') {
    // 회송으로 끝나면, 바로 앞 일반 열차 기준으로 판단
    // 회송 전 일반열차의 도착지에서 기지 입고 준비일 가능성 높음
    // → 별도 처리하지 않음 (이전 stop이 정확할 것)
  } else if (isNormalLine(lastDir)) {
    if (lastDir.up) {
      // 상행으로 끝 = 방화 방면 도착
      // 소요시간으로 중간역 판단
      const lastStop = stops[stops.length - 1];
      // 마지막 역에서부터 상행 방향 소요시간
      const endPos = estimateEndPos(lastStop, lastDir, dur, trains, dirs);
      if (stops[stops.length-1] !== endPos) stops.push(endPos);
    } else {
      // 하행으로 끝 = 종점 도착
      if (stops[stops.length-1] !== lastDir.line) stops.push(lastDir.line);
    }
  }

  // 연속 중복 제거
  const deduped = [];
  for (const s of stops) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== s) {
      deduped.push(s);
    }
  }

  return deduped.join('');
}

function isNormalLine(d) {
  return d.line === '마' || d.line === '하';
}

function estimateEndPos(lastStop, lastDir, totalDur, trains, dirs) {
  // 마지막 상행 열차의 도착 위치 추정
  // 전체 소요시간에서 역추산

  // 간단한 접근: 마지막 열차의 개별 소요시간 불명이므로,
  // 전체 세그먼트 소요시간과 열차 수로 대략 추정

  // 열차가 1개이고 상행이면:
  if (trains.length === 1) {
    // 답십리에서 출발, 상행 방향
    if (totalDur >= 50) return '방';
    if (totalDur >= 20) return '영';  // 영등포구청
    return '답';
  }

  // 마지막 열차가 상행이면 보통 방화까지 or 답십리까지
  // 이전 stop 참고
  if (lastStop === '마' || lastStop === '하') {
    // 종점에서 출발한 상행 → 답십리 통과 → 방화
    if (totalDur >= 80) return '방';
    return '답';
  }
  if (lastStop === '방') {
    // 방화에서 출발 → 하행 → 종점 → 상행 → 답십리/방화
    return '답';
  }
  return '답';
}

// ─── 분석 실행 ───
const PROTECTED = {
  'p_ord': ['51', '52', '53', '54'],
  'p_ordord': ['82'],
};

const diffs = [];
let totalChecked = 0;
let matchCount = 0;

for (const [prefix, dias] of Object.entries(S)) {
  for (const [diaNum, data] of Object.entries(dias)) {
    if (!data.g || data.g.length === 0) continue;
    if (data.m.includes('충당') || data.m.includes('운휴') || data.m.includes('대휴')) continue;

    totalChecked++;

    // 세그먼트별 경로 추정
    const segRoutes = [];
    for (const seg of data.g) {
      const route = estimateSeg(seg.n, seg.d, seg.a);
      segRoutes.push(route);
    }
    const estimated = segRoutes.join(',');

    if (estimated === data.m) {
      matchCount++;
    } else {
      const isProtected = (PROTECTED[prefix] || []).includes(diaNum);
      diffs.push({
        prefix, diaNum, currentM: data.m, estimated, isProtected,
        segments: data.g.map(s => ({
          d: s.d, a: s.a,
          dur: t2m(s.a) - t2m(s.d),
          trains: s.n,
          desc: s.n.map(t => {
            const c = classify(t);
            const dir = c.up ? '↑' : '↓';
            return `${t}(${c.line}${dir})`;
          }).join(' '),
        })),
      });
    }
  }
}

// ─── 출력 ───
console.log(`검사: ${totalChecked}건 | 일치: ${matchCount}건 | 차이: ${diffs.length}건\n`);

const prot = diffs.filter(d => d.isProtected);
const norm = diffs.filter(d => !d.isProtected);

if (prot.length > 0) {
  console.log('=== [보호] 정답 확인된 다이아 — 추정과의 차이 ===');
  for (const d of prot) {
    console.log(`  ${d.prefix}/${d.diaNum}`);
    console.log(`    현재(정답): ${d.currentM}`);
    console.log(`    추정:       ${d.estimated}`);
    for (const s of d.segments) {
      console.log(`      ${s.d}→${s.a}(${s.dur}분) ${s.desc}`);
    }
  }
  console.log('');
}

console.log('=== 수정 후보 ===\n');

// prefix별로 정리
const byPrefix = {};
for (const d of norm) {
  if (!byPrefix[d.prefix]) byPrefix[d.prefix] = [];
  byPrefix[d.prefix].push(d);
}

for (const [prefix, items] of Object.entries(byPrefix)) {
  console.log(`--- ${prefix} ---`);
  for (const d of items) {
    console.log(`  다이아 ${d.diaNum}:`);
    console.log(`    현재: ${d.currentM}`);
    console.log(`    추정: ${d.estimated}`);
    for (const s of d.segments) {
      console.log(`      ${s.d}→${s.a}(${s.dur}분) ${s.desc}`);
    }
  }
  console.log('');
}
