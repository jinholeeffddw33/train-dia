// 엑셀 행로표에서 개별 열차의 소요시간을 분석하여
// m 필드(행로 약호)를 검증하고 수정 제안을 생성하는 스크립트

const XLSX = require('C:/Users/smrt2/zinosb-marketplace/node_modules/xlsx');
const path = require('path');
const fs = require('fs');

const file = path.join('D:', '교육자료', '다이아 작업',
  '답십리사업소_행로표_260322_210054(엑셀)',
  '답십리사업소_행로표_260322_210054(엑셀).xlsm');

const wb = XLSX.readFile(file, { cellStyles: true, raw: true });

// ─── 역 약호 ───
// 답=답십리, 방=방화, 마=마천, 하=하남검단산, 영=영등포구청
// 강=강동, 군=군자, 상=상일동, 둔=둔촌동, 미=미사
// 기=기지(고덕차량기지)

// ─── 노선도 기준 소요시간 (분) ───
// 답십리 중심 기준
const TRAVEL = {
  // 상행(방화 방면) - 답십리에서
  '답→방': 60,
  '답→영': 24,    // 영등포구청 (상행 약 40% 지점)
  '답→여': 16,    // 여의도 (추정)
  '답→까': 10,    // 까치산 (추정)

  // 하행(마천/하남 방면) - 답십리에서
  '답→강': 15,    // 강동 (분기점)
  '답→길': 17,    // 길동 (추정)
  '답→군': 8,     // 군자
  '답→둔': 20,    // 둔촌동
  '답→상': 30,    // 상일동
  '답→미': 33,    // 미사
  '답→하': 36,    // 하남검단산
  '답→마': 26,    // 마천
  '답→기': 33,    // 기지(고덕) ≈ 상일동 근처 + α

  // 전구간
  '방→마': 86,
  '방→하': 96,
  '방→강': 75,    // 방화→강동
  '방→답': 60,
  '방→기': 93,    // 방화→기지 ≈ 방→상 + α

  '마→답': 26,
  '마→방': 86,
  '하→답': 36,
  '하→방': 96,
  '강→답': 15,
  '영→답': 24,
  '기→답': 33,
  '기→방': 93,

  // 기지 관련
  '기→하': 5,     // 기지↔하남검단산 가까움
  '기→마': 60,    // 기지→마천 (기지→답→마천 대략)
  '기→강': 18,    // 기지→강동

  '상→답': 30,
  '둔→답': 20,
  '미→답': 33,
};

function timeHM(val) {
  if (typeof val !== 'number' || val <= 0 || val >= 2) return null;
  const totalMin = Math.round(val * 1440);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return { h, m, str: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, totalMin };
}

// 열차번호 → 방향/노선
function trainDir(num) {
  const even = num % 2 === 0;
  if (num >= 5500 && num <= 5899) return { line: '마천', up: even };
  if (num >= 5000 && num <= 5499) return { line: '하남', up: even };
  if (num >= 1000 && num <= 1999) return { line: '기지', up: even };
  if (num >= 2000 && num <= 2999) return { line: '하남기지', up: even };
  if (num >= 5900 && num <= 5999) return { line: '회송', up: even };
  if (num >= 9000 && num <= 9999) return { line: '회송9', up: even };
  return { line: '?', up: null };
}

// 세그먼트의 열차 시퀀스로 경로 추정
// 열차들의 첫번째/마지막 + 방향으로 출발역/종착역 결정
function estimateRoute(trains, segDuration) {
  if (!trains || trains.length === 0) return '?';

  const first = trainDir(trains[0]);
  const last = trainDir(trains[trains.length - 1]);

  // 연속된 열차들의 패턴 분석
  const dirs = trains.map(t => trainDir(t));

  // 단일 열차
  if (trains.length === 1) {
    return estimateSingle(trains[0], segDuration);
  }

  // 복수 열차 — 전체 경로 추정
  return estimateMulti(trains, dirs, segDuration);
}

function estimateSingle(num, dur) {
  const d = trainDir(num);

  if (d.line === '기지') {
    if (d.up) return '기답';  // 기지→답십리 방면
    return '답기';
  }
  if (d.line === '하남기지') {
    if (d.up) return '기답';
    return '답기';
  }

  if (d.up) {
    // 상행 (방화 방면)
    if (dur <= 20) return '답군';   // 짧은 구간
    if (dur <= 30) return '답영';   // 중간
    if (dur <= 45) return '답방';   // 이건 좀 짧지만...
    return '답방';
  } else {
    // 하행
    if (d.line === '마천') {
      if (dur <= 15) return '답강';
      if (dur <= 22) return '답마';
      return '답마';
    }
    if (d.line === '하남') {
      if (dur <= 15) return '답강';
      if (dur <= 25) return '답둔';
      if (dur <= 32) return '답상';
      if (dur <= 38) return '답하';
      return '답하';
    }
  }
  return '답?';
}

function estimateMulti(trains, dirs, dur) {
  // 첫 열차와 마지막 열차로 전체 경로 추정
  const first = dirs[0];
  const last = dirs[dirs.length - 1];

  // 시작점: 첫 열차 출발 기준
  // 끝점: 마지막 열차 도착 기준

  // 패턴 분석: 상행→하행 = 방화 찍고 돌아오는 패턴
  // 하행→상행 = 종점 찍고 돌아오는 패턴

  const route = [];

  // 출발역 결정 (첫 열차 기준)
  let startStation = getStartStation(trains[0], dirs[0]);
  route.push(startStation);

  // 각 열차 전환점 추적
  let prevUp = dirs[0].up;
  for (let i = 1; i < dirs.length; i++) {
    const currUp = dirs[i].up;
    const currLine = dirs[i].line;
    const prevLine = dirs[i-1].line;

    // 방향 전환 감지
    if (currUp !== prevUp || isSpecialTrain(trains[i]) || isSpecialTrain(trains[i-1])) {
      // 전환점의 역 추정
      const turnStation = getTurnStation(trains[i-1], dirs[i-1], trains[i], dirs[i]);
      if (turnStation && turnStation !== route[route.length - 1]) {
        route.push(turnStation);
      }
    }
    prevUp = currUp;
  }

  // 종착역 결정 (마지막 열차 기준)
  let endStation = getEndStation(trains[trains.length - 1], dirs[dirs.length - 1]);
  if (endStation !== route[route.length - 1]) {
    route.push(endStation);
  }

  return route.join('');
}

function isSpecialTrain(num) {
  return (num >= 1000 && num <= 2999) || (num >= 5900 && num <= 5999) || (num >= 9000 && num <= 9999);
}

function getStartStation(num, dir) {
  if (dir.line === '기지' || dir.line === '하남기지') return '기';
  if (num >= 2000 && num <= 2999) return '기';  // 하남기지도 기지 출발
  // 일반 열차는 답십리 출발 기본
  if (dir.up) {
    // 상행 첫 열차 → 답십리에서 출발
    return '답';
  } else {
    // 하행 첫 열차 → 답십리에서 출발
    return '답';
  }
}

function getEndStation(num, dir) {
  if (dir.line === '기지') return '기';
  if (dir.line === '하남기지') return '기';
  if (num >= 2000 && num <= 2999) return '기';

  if (dir.up) {
    // 상행 마지막 열차 → 답십리에서 끝 (또는 중간역)
    return '답';
  } else {
    // 하행 마지막 열차
    if (dir.line === '마천') return '마';
    if (dir.line === '하남') return '하';
    return '?';
  }
}

function getTurnStation(prevNum, prevDir, currNum, currDir) {
  // 회송/기지 열차 처리
  if (isSpecialTrain(prevNum) && isSpecialTrain(currNum)) {
    return null; // 기지/회송 연속은 중간역 생략
  }

  if (isSpecialTrain(prevNum)) {
    // 이전이 특수열차면 기지/회송선 도착점
    if (prevDir.line === '기지' || prevDir.line === '하남기지') return '기';
    if (prevDir.line === '회송' || prevDir.line === '회송9') return null;
    return null;
  }

  if (isSpecialTrain(currNum)) {
    // 다음이 특수열차면, 이전 열차의 종점이 전환점
    if (currDir.line === '기지') {
      return null; // 기지 입고는 마지막에 '기'로
    }
    if (currDir.line === '회송' || currDir.line === '회송9') return null;
    if (currDir.line === '하남기지') return null;
    return null;
  }

  // 일반 열차 방향 전환
  if (prevDir.up && !currDir.up) {
    // 상행→하행: 방화에서 전환
    return '방';
  }
  if (!prevDir.up && prevDir.up !== null && currDir.up) {
    // 하행→상행: 종점에서 전환
    if (prevDir.line === '마천') return '마';
    if (prevDir.line === '하남') return '하';
    return '?';
  }
  if (prevDir.up && currDir.up) {
    // 같은 방향이면 답십리에서 전환 (내려서 다시 탐)
    return '답';
  }
  if (!prevDir.up && !currDir.up) {
    // 하행→하행이면 답십리에서 전환
    return '답';
  }
  return null;
}

// ─── schedules.ts에서 현재 m 필드 읽기 ───
const schedulesPath = path.join(__dirname, '..', 'src', 'data', 'schedules.ts');
const schedulesText = fs.readFileSync(schedulesPath, 'utf8');

function getCurrentM(schedKey, diaNum) {
  // 간단한 정규식으로 m 필드 추출
  const regex = new RegExp(`"${diaNum}"\\s*:\\s*\\{[^}]*m:"([^"]*)"`, 'g');
  const sections = schedulesText.split(/p_\w+/);

  // schedKey별 섹션 찾기
  const sectionMap = {};
  const keyRegex = /(p_\w+)\s*:\s*\{/g;
  let match;
  const keys = [];
  while ((match = keyRegex.exec(schedulesText)) !== null) {
    keys.push({ key: match[1], pos: match.index });
  }

  for (let i = 0; i < keys.length; i++) {
    const start = keys[i].pos;
    const end = i + 1 < keys.length ? keys[i+1].pos : schedulesText.length;
    const section = schedulesText.substring(start, end);
    sectionMap[keys[i].key] = section;
  }

  const section = sectionMap[schedKey];
  if (!section) return null;

  const mRegex = new RegExp(`"${diaNum}"\\s*:\\s*\\{[^}]*?m:"([^"]*)"`, 's');
  const m = mRegex.exec(section);
  return m ? m[1] : null;
}

// ─── 엑셀 파싱 + 행로 추정 ───
const ALL_SHEETS = {
  '평일': { prefix: 'p_ord', diaRange: [1, 54] },
  '휴일': { prefix: 'p_hol', diaRange: [1, 38] },
  '평평': { prefix: 'p_ordord', diaRange: [62, 91] },
  '평휴': { prefix: 'p_ordhol', diaRange: [62, 91] },
  '휴평': { prefix: 'p_holord', diaRange: [62, 91] },
  '휴휴': { prefix: 'p_holhol', diaRange: [62, 91] },
};

// 수정 불가 다이아 (정답 확인됨)
const PROTECTED = {
  'p_ord': [51, 52, 53, 54],
  'p_ordord': [82],
};

const results = [];

for (const [sheetName, config] of Object.entries(ALL_SHEETS)) {
  const ws = wb.Sheets[sheetName];
  if (!ws) continue;
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    if (typeof row[0] !== 'string') continue;
    if (!row[0].includes('출근') || !row[0].includes('시각')) continue;

    let clockInRow = null;
    for (let sr = r + 1; sr < Math.min(r + 6, data.length); sr++) {
      const srow = data[sr];
      if (srow && typeof srow[0] === 'number' && srow[0] > 0 && srow[0] < 1) {
        clockInRow = sr;
        break;
      }
    }
    if (clockInRow === null) continue;

    let diaNum = null;
    for (let dr = clockInRow + 1; dr < Math.min(clockInRow + 5, data.length); dr++) {
      const drow = data[dr];
      if (!drow) continue;
      const v = drow[0];
      if (typeof v === 'number' && v >= config.diaRange[0] && v <= config.diaRange[1]) {
        diaNum = v;
        break;
      }
    }
    if (!diaNum) continue;

    let retireRow = null;
    for (let rr = clockInRow + 3; rr < Math.min(clockInRow + 60, data.length); rr++) {
      const rrow = data[rr];
      if (rrow && typeof rrow[0] === 'string' &&
          rrow[0].includes('퇴근') && rrow[0].includes('시각')) {
        retireRow = rr;
        break;
      }
    }
    if (!retireRow) continue;

    // 구간별 시간 추출
    const segments = [];
    const headerRow = retireRow + 1;
    const upperRow = retireRow + 2;
    const lowerRow = retireRow + 3;

    if (lowerRow < data.length) {
      const upper = data[upperRow];
      const lower = data[lowerRow];
      if (upper && lower) {
        for (let si = 0; si < 3; si++) {
          const col = 3 + si;
          const startVal = lower[col];
          const endVal = upper[col];
          if (startVal != null && typeof startVal === 'number' && startVal > 0 && startVal < 2) {
            const dep = timeHM(startVal);
            const arr = (endVal != null && typeof endVal === 'number') ? timeHM(endVal) : null;
            if (dep && arr) {
              segments.push({ dep, arr, dur: arr.totalMin - dep.totalMin });
            }
          }
        }
      }
    }

    // 열차번호 추출 (행 순서대로)
    const trainEntries = [];
    for (let yr = clockInRow; yr < retireRow; yr++) {
      const yrow = data[yr];
      if (!yrow) continue;
      for (let c = 0; c < Math.min(yrow.length || 0, 25); c++) {
        const v = yrow[c];
        if (typeof v === 'number' && v >= 1000 && v <= 9999) {
          // 중복 제거 (같은 행의 같은 번호)
          const existing = trainEntries.find(e => e.num === v && e.row === yr);
          if (!existing) {
            trainEntries.push({ row: yr, col: c, num: v });
          }
        }
      }
    }

    // 세그먼트별 열차 그룹핑
    // 현재 schedules.ts의 g 배열에서 열차번호 참조
    const currentM = getCurrentM(config.prefix, String(diaNum));
    if (!currentM || currentM.includes('충당') || currentM.includes('운휴') || currentM.includes('대휴')) continue;

    // 현재 g의 열차번호에서 세그먼트 경계 파악
    // 대신 간격 기반으로 세그먼트 분리
    const sorted = trainEntries.sort((a, b) => a.row - b.row);
    const segTrains = [[]];
    let lastRow = sorted.length > 0 ? sorted[0].row : 0;

    for (const e of sorted) {
      if (e.row - lastRow > 5 && segTrains[segTrains.length - 1].length > 0) {
        segTrains.push([]);
      }
      // 같은 세그먼트에 같은 번호 이미 있으면 스킵
      const currSeg = segTrains[segTrains.length - 1];
      if (!currSeg.find(x => x.num === e.num)) {
        currSeg.push(e);
      }
      lastRow = e.row;
    }

    // 세그먼트별 경로 추정
    const estimatedSegRoutes = [];
    for (let si = 0; si < segTrains.length; si++) {
      const segT = segTrains[si].map(e => e.num);
      const segDur = si < segments.length ? segments[si].dur : 0;
      const route = estimateRoute(segT, segDur);
      estimatedSegRoutes.push(route);
    }

    const estimatedM = estimatedSegRoutes.join(',');

    // 현재 m과 비교
    const isProtected = (PROTECTED[config.prefix] || []).includes(diaNum);

    if (estimatedM !== currentM) {
      results.push({
        sheet: sheetName,
        prefix: config.prefix,
        dia: diaNum,
        currentM,
        estimatedM,
        protected: isProtected,
        segments: segments.map(s => `${s.dep.str}-${s.arr.str}(${s.dur}분)`),
        trains: segTrains.map(st => st.map(e => e.num)),
      });
    }
  }
}

// ─── 결과 출력 ───
console.log(`\n${'='.repeat(80)}`);
console.log('행로 약호 검증 결과');
console.log(`${'='.repeat(80)}`);
console.log(`차이 발견: ${results.length}건\n`);

// 보호된 항목 먼저 확인
const protectedDiffs = results.filter(r => r.protected);
const normalDiffs = results.filter(r => !r.protected);

if (protectedDiffs.length > 0) {
  console.log('=== 보호된 다이아 (수정하지 않음 — 정답 확인됨) ===');
  for (const r of protectedDiffs) {
    console.log(`  ${r.sheet} 다이아${r.dia}: 현재="${r.currentM}" / 추정="${r.estimatedM}"`);
    console.log(`    구간: ${r.segments.join(' | ')}`);
    console.log(`    열차: ${r.trains.map(t => t.join(',')).join(' | ')}`);
  }
  console.log('');
}

console.log('=== 수정 가능 후보 ===');
for (const r of normalDiffs) {
  console.log(`[${r.sheet}] 다이아 ${r.dia}:`);
  console.log(`  현재: ${r.currentM}`);
  console.log(`  추정: ${r.estimatedM}`);
  console.log(`  구간: ${r.segments.join(' | ')}`);
  console.log(`  열차: ${r.trains.map(t => t.join(',')).join(' | ')}`);
  console.log('');
}

// JSON으로도 저장
const outPath = path.join(__dirname, 'route-analysis.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
console.log(`\n결과 저장: ${outPath}`);
