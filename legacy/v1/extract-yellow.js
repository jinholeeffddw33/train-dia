// 행로표 엑셀 — 노란색(FFFF00) 셀 = 출발시간 추출
const XLSX = require('xlsx');
const path = require('path');

const file = path.join('C:', 'Users', 'smrt2', 'Downloads', '답십리사업소_행로표_260223_113556.xlsm');
const wb = XLSX.readFile(file, { cellStyles: true, raw: true });

function timeStr(val) {
  if (typeof val !== 'number' || val <= 0 || val >= 2) return null;
  const s = Math.round(val * 86400);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 30) return null;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function isYellow(ws, r, c) {
  const addr = XLSX.utils.encode_cell({r, c});
  const cell = ws[addr];
  if (!cell || !cell.s) return false;
  const fill = cell.s.fgColor || (cell.s.fill && cell.s.fill.fgColor);
  if (fill && fill.rgb && fill.rgb.includes('FFFF00')) return true;
  if (cell.s.fgColor && cell.s.fgColor.rgb === 'FFFF00') return true;
  return false;
}

// 모든 시트 처리
const ALL_SHEETS = {
  '평일': { prefix: 'p_ord', diaRange: [1, 44] },
  '휴일': { prefix: 'p_hol', diaRange: [1, 44] },
  '평평': { prefix: 'p_ordord', diaRange: [62, 91] },
  '평휴': { prefix: 'p_ordhol', diaRange: [62, 91] },
  '휴평': { prefix: 'p_holord', diaRange: [62, 91] },
  '휴휴': { prefix: 'p_holhol', diaRange: [62, 91] }
};

const results = {};

for (const [sheetName, config] of Object.entries(ALL_SHEETS)) {
  const ws = wb.Sheets[sheetName];
  if (!ws) { console.log(`Sheet "${sheetName}" not found`); continue; }

  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  results[config.prefix] = {};

  // 1단계: "출근시각" 라벨 기준으로 교번 블록 찾기
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    if (typeof row[0] !== 'string' || !row[0].includes('출근') || !row[0].includes('시각')) continue;

    // 출근시각 라벨 발견 → 시각값 행 찾기
    let timeRow = null;
    for (let sr = r + 1; sr < Math.min(r + 5, data.length); sr++) {
      const srow = data[sr];
      if (srow && typeof srow[0] === 'number' && srow[0] > 0 && srow[0] < 1) {
        timeRow = sr;
        break;
      }
    }
    if (timeRow === null) continue;

    // 교번 번호 찾기
    let diaNum = null;
    for (let dr = timeRow + 1; dr < Math.min(timeRow + 4, data.length); dr++) {
      const drow = data[dr];
      if (!drow) continue;
      const v = drow[0];
      if (typeof v === 'number' && v >= config.diaRange[0] && v <= config.diaRange[1]) {
        diaNum = v;
        break;
      }
    }
    if (!diaNum) continue;

    const trow = data[timeRow];
    const clockIn = timeStr(trow[0]); // 출근시각

    // 방법 1: C10에서 노란색 셀 확인
    let firstDeparture = null;
    if (isYellow(ws, timeRow, 10) && typeof trow[10] === 'number') {
      firstDeparture = timeStr(trow[10]);
    }

    // 방법 2: C10이 노란색이 아니면, 출근시각 행 전체에서 노란색 셀 찾기
    if (!firstDeparture) {
      for (let c = 1; c < (trow.length || 20); c++) {
        if (isYellow(ws, timeRow, c) && typeof trow[c] === 'number') {
          const t = timeStr(trow[c]);
          if (t) { firstDeparture = t; break; }
        }
      }
    }

    // 방법 3: 출근시각 행에 노란색이 없으면, 교번 행 이후에서 첫 노란색 찾기
    if (!firstDeparture) {
      for (let sr = timeRow + 1; sr < Math.min(timeRow + 20, data.length); sr++) {
        const srow = data[sr];
        if (!srow) continue;
        // 퇴근시각 라벨이면 중단
        if (typeof srow[0] === 'string' && srow[0].includes('퇴근')) break;
        for (let c = 0; c < Math.min(srow.length || 0, 20); c++) {
          if (isYellow(ws, sr, c) && typeof srow[c] === 'number') {
            const t = timeStr(srow[c]);
            if (t) { firstDeparture = t; break; }
          }
        }
        if (firstDeparture) break;
      }
    }

    // 퇴근시각 찾기
    let clockOut = null;
    for (let rr = timeRow + 3; rr < Math.min(timeRow + 40, data.length); rr++) {
      const rrow = data[rr];
      if (rrow && typeof rrow[0] === 'string' && rrow[0].includes('퇴근')) {
        for (let tr = rr + 1; tr < Math.min(rr + 5, data.length); tr++) {
          const trow2 = data[tr];
          if (trow2 && typeof trow2[0] === 'number' && trow2[0] > 0 && trow2[0] < 1) {
            clockOut = timeStr(trow2[0]);
            break;
          }
        }
        break;
      }
    }

    results[config.prefix][String(diaNum)] = {
      clockIn,
      departure: firstDeparture,
      clockOut,
    };
  }
}

// 결과 출력
console.log('=== 전체 교번 출발시간 추출 결과 ===\n');

for (const [prefix, dias] of Object.entries(results)) {
  console.log(`\n--- ${prefix} (${Object.keys(dias).length}개) ---`);
  const sorted = Object.keys(dias).sort((a,b) => parseInt(a) - parseInt(b));
  for (const dia of sorted) {
    const d = dias[dia];
    const diff = d.clockIn && d.departure ? (() => {
      const [h1,m1] = d.clockIn.split(':').map(Number);
      const [h2,m2] = d.departure.split(':').map(Number);
      return (h2*60+m2) - (h1*60+m1);
    })() : '?';
    console.log(`교번 ${dia.padStart(2)}: 출근=${d.clockIn} → 출발=${d.departure} (${diff}분) → 퇴근=${d.clockOut}`);
  }
}

// data.js 업데이트용 JSON
console.log('\n\n=== data.js 업데이트용 (departure → s 필드) ===\n');
const update = {};
for (const [prefix, dias] of Object.entries(results)) {
  update[prefix] = {};
  for (const [dia, d] of Object.entries(dias)) {
    if (d.departure) {
      update[prefix][dia] = { s: d.departure, e: d.clockOut };
    }
  }
}
console.log(JSON.stringify(update, null, 2));
