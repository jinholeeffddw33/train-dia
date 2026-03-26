// v2: schedules.ts의 g[] 열차번호를 기반으로 각 세그먼트의 행로를 추정
// 열차번호 시퀀스 + 소요시간(g.d~g.a)으로 정확한 경로 결정

const fs = require('fs');
const path = require('path');

// schedules.ts 파싱
const schedulesPath = path.join(__dirname, '..', 'src', 'data', 'schedules.ts');
const schedulesText = fs.readFileSync(schedulesPath, 'utf8');

// 열차번호 → 방향/노선
function trainDir(num) {
  const even = num % 2 === 0;
  if (num >= 5500 && num <= 5899) return { line: '마천', up: even, desc: even ? '마→방' : '방→마' };
  if (num >= 5000 && num <= 5499) return { line: '하남', up: even, desc: even ? '하→방' : '방→하' };
  if (num >= 1000 && num <= 1999) return { line: '기지', up: even, desc: even ? '기→답' : '답→기' };
  if (num >= 2000 && num <= 2999) return { line: '하남기지', up: even, desc: even ? '미→답' : '답→미' };
  if (num >= 5900 && num <= 5999) return { line: '회송', up: even, desc: '회송' };
  if (num >= 9000 && num <= 9999) return { line: '회송9', up: null, desc: '회송9' };
  return { line: '?', up: null, desc: '?' };
}

// 시간 문자열을 분으로 변환
function timeToMin(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

// 세그먼트의 열차 시퀀스로 경로 추정
// 핵심: 각 열차가 답십리를 기준으로 어디서 어디로 가는지 추적
function estimateSegRoute(trains, durMin) {
  if (!trains || trains.length === 0) return '?';

  const dirs = trains.map(t => ({ num: t, ...trainDir(t) }));

  // 현재 위치 추적 (답=답십리, 방=방화, 마=마천, 하=하남, 기=기지)
  // 열차 방향으로 현재 위치→다음 위치 추론

  const route = [];
  let pos = null; // 현재 위치

  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[i];
    const prev = i > 0 ? dirs[i-1] : null;

    if (d.line === '기지') {
      if (d.up) {
        // 기지→답 방면 (짝수)
        if (pos === null) pos = '기';
        if (route.length === 0 || route[route.length-1] !== '기') route.push('기');
        // 도착은 답 (하지만 답은 다음 열차가 결정)
        pos = '답';
      } else {
        // 답→기지 (홀수)
        if (pos === null) pos = '답';
        pos = '기';
      }
      continue;
    }

    if (d.line === '하남기지') {
      if (d.up) {
        // 미사/기지→답 방면
        if (pos === null) pos = '기';
        if (route.length === 0 || route[route.length-1] !== '기') route.push('기');
        pos = '답';
      } else {
        // 답→미사/기지
        if (pos === null) pos = '답';
        pos = '기';
      }
      continue;
    }

    if (d.line === '회송' || d.line === '회송9') {
      // 회송은 경로 추적 무시 (같은 구간에서 방향 전환)
      continue;
    }

    // 일반 열차
    if (d.line === '하남') {
      if (d.up) {
        // 하남→방화 방향 (상행, 짝수)
        // 실제로는 하남검단산→강동→답십리→방화
        if (pos === null) {
          // 첫 열차가 상행이면, 하남/강동/답십리 중 어디서 출발?
          // 이전에 하행이었으면 하남검단산에서 출발
          pos = '하'; // 하남에서 출발 (보수적)
        }
        if (pos === '하' || pos === '상' || pos === '미') {
          // 하남→답 통과 → 방화 방면
          // 다음 열차가 하행이면 어디까지 갔는지 알 수 있음
        }
        // 상행은 방화 방면으로 이동
        pos = '방'; // 방화 방면 (정확한 종점은 다음 열차로 판단)
      } else {
        // 방화→하남검단산 방향 (하행, 홀수)
        if (pos === null) pos = '답'; // 답십리에서 출발 기본
        // 하행은 하남 방면으로
        pos = '하';
      }
    }

    if (d.line === '마천') {
      if (d.up) {
        // 마천→방화 방향 (상행, 짝수)
        if (pos === null) pos = '마';
        pos = '방';
      } else {
        // 방화→마천 방향 (하행, 홀수)
        if (pos === null) pos = '답';
        pos = '마';
      }
    }
  }

  // route 구성 — 열차 시퀀스에서 경유역 추출
  // 더 단순한 접근: 열차 방향 전환점을 추적
  return buildRoute(dirs, durMin);
}

function buildRoute(dirs, durMin) {
  // 방향 전환점으로 경로 추정
  // 핵심 규칙:
  // - 상행(짝) 다음 하행(홀) = 방화(또는 중간역)에서 전환
  // - 하행(홀) 다음 상행(짝) = 종점(마천/하남)에서 전환
  // - 같은 방향 연속 = 답십리에서 전환 (탑승자 교대)

  const route = [];
  let startStation = null;
  let lastNormalDir = null; // 마지막 일반 열차 방향

  // 회송/기지 제외한 일반 열차만 필터
  const normals = dirs.filter(d => d.line === '마천' || d.line === '하남');
  const specials = dirs.filter(d => d.line === '기지' || d.line === '하남기지' || d.line === '회송' || d.line === '회송9');

  // 첫번째 특수열차가 기지 출고인 경우
  const firstTrain = dirs[0];
  if (firstTrain.line === '기지' && firstTrain.up) {
    route.push('기');
  } else if (firstTrain.line === '하남기지' && firstTrain.up) {
    route.push('기');
  } else {
    // 일반 열차 시작
    // 첫 열차가 상행(짝) = 어딘가에서 방화 방면 출발
    // 첫 열차가 하행(홀) = 어딘가에서 종점 방면 출발
    if (firstTrain.line === '마천' || firstTrain.line === '하남') {
      if (firstTrain.up) {
        // 상행 출발 → 종점에서 출발
        if (firstTrain.line === '마천') route.push('마');
        else route.push('하');
      } else {
        // 하행 출발 → 방화 쪽에서 출발 → 대부분 답십리
        route.push('답');
      }
    }
  }

  // 방향 전환 추적 (일반 열차만)
  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[i];

    // 특수 열차 처리
    if (d.line === '회송' || d.line === '회송9') continue;
    if (d.line === '기지') {
      if (!d.up) {
        // 기지 입고 — 마지막이면 '기' 추가
        if (i === dirs.length - 1 || isAllSpecialAfter(dirs, i + 1)) {
          route.push('기');
        }
      } else if (d.up && route[route.length - 1] !== '기') {
        // 기지 출고 — 이미 기 추가 안했으면
        // 세그먼트 시작이면 '기' 추가
        if (i === 0) { /* 이미 처리됨 */ }
      }
      continue;
    }
    if (d.line === '하남기지') {
      if (!d.up) {
        // 하남기지 입고
        if (i === dirs.length - 1 || isAllSpecialAfter(dirs, i + 1)) {
          route.push('기');
        }
      }
      continue;
    }

    // 일반 열차
    if (lastNormalDir === null) {
      lastNormalDir = d;
      continue;
    }

    // 방향 전환 감지
    if (lastNormalDir.up !== d.up) {
      // 방향이 바뀜
      if (lastNormalDir.up && !d.up) {
        // 상행→하행: 방화에서 전환
        route.push('방');
      } else if (!lastNormalDir.up && d.up) {
        // 하행→상행: 종점에서 전환
        if (lastNormalDir.line === '마천') route.push('마');
        else if (lastNormalDir.line === '하남') route.push('하');
      }
    } else {
      // 같은 방향 — 노선만 다르면 답십리에서 전환
      if (lastNormalDir.line !== d.line) {
        route.push('답');
      }
      // 같은 방향 같은 노선이면 연속 운행 (전환 없음)
    }

    lastNormalDir = d;
  }

  // 마지막 역 추가
  const lastDir = dirs[dirs.length - 1];
  if (lastDir.line === '기지' || lastDir.line === '하남기지') {
    if (route[route.length - 1] !== '기') route.push('기');
  } else if (lastDir.line === '마천' || lastDir.line === '하남') {
    if (lastDir.up) {
      // 상행으로 끝 = 답십리(또는 방화 방면)에 도착
      // 소요시간으로 판단
      route.push('답');
    } else {
      // 하행으로 끝 = 종점 도착
      if (lastDir.line === '마천') route.push('마');
      else route.push('하');
    }
  } else if (lastDir.line === '회송' || lastDir.line === '회송9') {
    // 회송 바로 전의 일반열차 기준
    if (route.length > 0) {
      // 이미 처리됨
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

function isAllSpecialAfter(dirs, startIdx) {
  for (let i = startIdx; i < dirs.length; i++) {
    const d = dirs[i];
    if (d.line === '마천' || d.line === '하남') return false;
  }
  return true;
}

// ─── schedules.ts에서 모든 다이아 데이터 추출 ───
function parseSchedules(text) {
  const result = {};
  const schedKeys = ['p_ord', 'p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol'];

  for (const key of schedKeys) {
    result[key] = {};
    // 해당 키의 섹션 찾기
    const keyStart = text.indexOf(`${key}:`);
    if (keyStart === -1) continue;

    // 다이아별 데이터 추출
    const diaRegex = /"(\d+)":\s*\{s:"([^"]*)",e:"([^"]*)",m:"([^"]*)"(?:,w:"([^"]*)")?(?:,g:\[([\s\S]*?)\])?\}/g;
    // 섹션 끝 찾기
    let depth = 0;
    let sectionStart = text.indexOf('{', keyStart);
    let sectionEnd = sectionStart;
    for (let i = sectionStart; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') {
        depth--;
        if (depth === 0) { sectionEnd = i + 1; break; }
      }
    }
    const section = text.substring(sectionStart, sectionEnd);

    // 각 다이아 파싱
    const entryRegex = /"([^"]+)":\s*\{s:"([^"]*)",e:"([^"]*)",m:"([^"]*)"[^}]*?\}/g;
    let match;
    while ((match = entryRegex.exec(section)) !== null) {
      const diaNum = match[1];
      const m = match[4];

      // g 배열 파싱
      const gStart = section.indexOf('g:[', match.index);
      if (gStart === -1 || gStart > match.index + match[0].length + 100) {
        result[key][diaNum] = { m, g: [] };
        continue;
      }

      // g 배열의 세그먼트 파싱
      const segments = [];
      const gSection = section.substring(gStart);
      const segRegex = /\{d:"([^"]*)",a:"([^"]*)",n:\[([^\]]*)\]\}/g;
      let segMatch;
      while ((segMatch = segRegex.exec(gSection)) !== null) {
        if (segMatch.index > 500) break; // 다음 다이아로 넘어가지 않도록
        const trains = segMatch[3].split(',').map(Number).filter(n => n > 0);
        segments.push({
          d: segMatch[1],
          a: segMatch[2],
          n: trains,
          dur: timeToMin(segMatch[2]) - timeToMin(segMatch[1]),
        });
      }
      result[key][diaNum] = { m, g: segments };
    }
  }
  return result;
}

const schedules = parseSchedules(schedulesText);

// ─── 분석 ───
const PROTECTED = {
  'p_ord': ['51', '52', '53', '54'],
  'p_ordord': ['82'],
};

const diffs = [];

for (const [prefix, dias] of Object.entries(schedules)) {
  for (const [diaNum, data] of Object.entries(dias)) {
    if (!data.g || data.g.length === 0) continue;
    if (data.m.includes('충당') || data.m.includes('운휴') || data.m.includes('대휴')) continue;

    // 세그먼트별 경로 추정
    const segRoutes = [];
    for (const seg of data.g) {
      const route = estimateSegRoute(seg.n, seg.dur);
      segRoutes.push(route);
    }
    const estimated = segRoutes.join(',');

    if (estimated !== data.m) {
      const isProtected = (PROTECTED[prefix] || []).includes(diaNum);
      diffs.push({
        prefix, diaNum, currentM: data.m, estimated, isProtected,
        segments: data.g.map(s => ({
          d: s.d, a: s.a, dur: s.dur,
          trains: s.n,
          trainDirs: s.n.map(t => `${t}(${trainDir(t).desc})`).join(' '),
        })),
      });
    }
  }
}

// ─── 출력 ───
console.log(`${'='.repeat(80)}`);
console.log(`행로 약호 검증 (v2 — schedules.ts g[] 기반)`);
console.log(`${'='.repeat(80)}`);
console.log(`차이 발견: ${diffs.length}건\n`);

const protDiffs = diffs.filter(d => d.isProtected);
const normDiffs = diffs.filter(d => !d.isProtected);

if (protDiffs.length > 0) {
  console.log('=== [정답 확인] 보호된 다이아 ===');
  for (const d of protDiffs) {
    console.log(`  ${d.prefix}/${d.diaNum}: "${d.currentM}" → 추정: "${d.estimated}"`);
    for (const s of d.segments) {
      console.log(`    ${s.d}→${s.a} (${s.dur}분) 열차: ${s.trainDirs}`);
    }
  }
  console.log('');
}

// 추정 일치 항목도 표시
let matchCount = 0;
for (const [prefix, dias] of Object.entries(schedules)) {
  for (const [diaNum, data] of Object.entries(dias)) {
    if (!data.g || data.g.length === 0) continue;
    if (data.m.includes('충당') || data.m.includes('운휴') || data.m.includes('대휴')) continue;
    const segRoutes = [];
    for (const seg of data.g) {
      segRoutes.push(estimateSegRoute(seg.n, seg.dur));
    }
    if (segRoutes.join(',') === data.m) matchCount++;
  }
}
console.log(`정확히 일치: ${matchCount}건\n`);

console.log('=== 수정 후보 (보호 제외) ===\n');
for (const d of normDiffs) {
  console.log(`[${d.prefix}] 다이아 ${d.diaNum}:`);
  console.log(`  현재: ${d.currentM}`);
  console.log(`  추정: ${d.estimated}`);
  for (const s of d.segments) {
    console.log(`    ${s.d}→${s.a} (${s.dur}분) 열차: ${s.trainDirs}`);
  }
  console.log('');
}
