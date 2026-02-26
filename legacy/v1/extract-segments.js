// 전 교번 × 전 시트 — 구간별(운전1/2/3) 출발·도착·열차번호 추출
// 퇴근시각 블록의 요약 행에서 시간 추출 (가장 신뢰성 높은 방법)
// 열차번호는 본문 노란셀 행 기준 스캔
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const file = path.join('C:', 'Users', 'smrt2', 'Downloads', '답십리사업소_행로표_260223_113556.xlsm');
const wb = XLSX.readFile(file, { cellStyles: true, raw: true });

// HH:MM (초 제외)
function timeHM(val) {
  if (typeof val !== 'number' || val <= 0 || val >= 2) return null;
  const totalSec = Math.round(val * 86400);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 30) return null;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function isYellow(ws, r, c) {
  const addr = XLSX.utils.encode_cell({r, c});
  const cell = ws[addr];
  if (!cell || !cell.s) return false;
  const fill = cell.s.fgColor || (cell.s.fill && cell.s.fill.fgColor);
  return !!(fill && fill.rgb && fill.rgb.includes('FFFF00'));
}

const ALL_SHEETS = {
  '평일': { prefix: 'p_ord', diaRange: [1, 44] },
  '휴일': { prefix: 'p_hol', diaRange: [1, 44] },
  '평평': { prefix: 'p_ordord', diaRange: [62, 91] },
  '평휴': { prefix: 'p_ordhol', diaRange: [62, 91] },
  '휴평': { prefix: 'p_holord', diaRange: [62, 91] },
  '휴휴': { prefix: 'p_holhol', diaRange: [62, 91] }
};

const results = {};
let totalDia = 0;
let totalSegs = 0;

for (const [sheetName, config] of Object.entries(ALL_SHEETS)) {
  const ws = wb.Sheets[sheetName];
  if (!ws) { console.error(`Sheet "${sheetName}" not found`); continue; }
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  results[config.prefix] = {};

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    // "출근\n시각" 또는 "출근시각" 라벨 찾기
    if (typeof row[0] !== 'string') continue;
    if (!row[0].includes('출근') || !row[0].includes('시각')) continue;

    // 출근시각 값 행 찾기 (라벨 아래 5행 이내)
    let clockInRow = null;
    for (let sr = r + 1; sr < Math.min(r + 6, data.length); sr++) {
      const srow = data[sr];
      if (srow && typeof srow[0] === 'number' && srow[0] > 0 && srow[0] < 1) {
        clockInRow = sr;
        break;
      }
    }
    if (clockInRow === null) continue;

    // 교번 번호 찾기 (출근시각 값 행 아래 4행 이내)
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

    // 퇴근시각 블록 찾기 (출근시각 이후 50행 이내)
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

    // 퇴근시각 블록 파싱
    // 구조: 퇴근시각 label(retireRow) → header(+1) → upper(+2) → lower(+3) → duration(+4)
    const headerRow = retireRow + 1;
    const upperRow = retireRow + 2;
    const lowerRow = retireRow + 3;

    if (lowerRow >= data.length) continue;
    const upper = data[upperRow];
    const lower = data[lowerRow];
    if (!upper || !lower) continue;

    // 운전1/2/3 — lower C3-C5 = 시작, upper C3-C5 = 끝
    const segments = [];
    for (let si = 0; si < 3; si++) {
      const col = 3 + si;
      const startVal = lower[col];
      const endVal = upper[col];

      if (startVal != null && typeof startVal === 'number' && startVal > 0 && startVal < 2) {
        const dep = timeHM(startVal);
        const arr = (endVal != null && typeof endVal === 'number') ? timeHM(endVal) : null;
        if (dep) {
          segments.push({ d: dep, a: arr, n: [] });
        }
      }
    }

    // 열차번호 추출 — 노란셀 기준으로 구간 매칭
    const yellowRows = [];
    for (let yr = clockInRow; yr < retireRow; yr++) {
      const yrow = data[yr];
      if (!yrow) continue;
      for (let c = 0; c < Math.min(yrow.length || 0, 25); c++) {
        if (isYellow(ws, yr, c) && typeof yrow[c] === 'number' && yrow[c] > 0 && yrow[c] < 2) {
          yellowRows.push(yr);
          break;
        }
      }
    }

    // 각 세그먼트에 열차번호 매칭
    for (let si = 0; si < segments.length && si < yellowRows.length; si++) {
      const scanStart = yellowRows[si];
      const scanEnd = (si + 1 < yellowRows.length) ? yellowRows[si + 1] : retireRow;

      const trains = new Set();
      for (let tr = scanStart; tr < scanEnd; tr++) {
        const trow = data[tr];
        if (!trow) continue;
        for (let c = 0; c < Math.min(trow.length || 0, 25); c++) {
          const v = trow[c];
          if (typeof v === 'number' && v >= 1000 && v <= 9999) {
            trains.add(v);
          }
        }
      }
      segments[si].n = Array.from(trains);
    }

    // 빈 열차번호 배열 정리
    for (const seg of segments) {
      if (seg.n.length === 0) delete seg.n;
    }

    // 퇴근시각 추출
    const clockOut = typeof lower[0] === 'number' ? timeHM(lower[0]) : null;

    results[config.prefix][String(diaNum)] = {
      g: segments
    };

    totalDia++;
    totalSegs += segments.length;
  }
}

// 결과 저장
const outPath = path.join(__dirname, 'segments-data.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
console.log(`추출 완료: ${totalDia}개 교번, ${totalSegs}개 구간`);
console.log(`저장: ${outPath}`);

// 교번 16 평일 검증
console.log('\n=== 교번 16 평일 검증 ===');
const d16 = results.p_ord && results.p_ord['16'];
if (d16) {
  for (let i = 0; i < d16.g.length; i++) {
    const seg = d16.g[i];
    console.log(`  ${i+1}구간: 출발=${seg.d} → 도착=${seg.a}, 열차=${(seg.n||[]).join('/')}`);
  }
} else {
  console.log('  교번 16 데이터 없음!');
}

// 교번 15 평일 검증 (3구간 교번)
console.log('\n=== 교번 15 평일 ===');
const d15 = results.p_ord && results.p_ord['15'];
if (d15) {
  for (let i = 0; i < d15.g.length; i++) {
    const seg = d15.g[i];
    console.log(`  ${i+1}구간: 출발=${seg.d} → 도착=${seg.a}, 열차=${(seg.n||[]).join('/')}`);
  }
}

// 교번 1 평일 검증 (일반)
console.log('\n=== 교번 1 평일 ===');
const d1 = results.p_ord && results.p_ord['1'];
if (d1) {
  for (let i = 0; i < d1.g.length; i++) {
    const seg = d1.g[i];
    console.log(`  ${i+1}구간: 출발=${seg.d} → 도착=${seg.a}, 열차=${(seg.n||[]).join('/')}`);
  }
}

// 야간 교번 90 평평 검증
console.log('\n=== 교번 90 평평 ===');
const d90 = results.p_ordord && results.p_ordord['90'];
if (d90) {
  for (let i = 0; i < d90.g.length; i++) {
    const seg = d90.g[i];
    console.log(`  ${i+1}구간: 출발=${seg.d} → 도착=${seg.a}, 열차=${(seg.n||[]).join('/')}`);
  }
}

// 통계
console.log('\n=== 시트별 통계 ===');
for (const [prefix, dias] of Object.entries(results)) {
  const diaCount = Object.keys(dias).length;
  const segCounts = Object.values(dias).map(d => d.g.length);
  const seg1 = segCounts.filter(c => c === 1).length;
  const seg2 = segCounts.filter(c => c === 2).length;
  const seg3 = segCounts.filter(c => c === 3).length;
  console.log(`  ${prefix}: ${diaCount}개 교번 (1구간=${seg1}, 2구간=${seg2}, 3구간=${seg3})`);
}
