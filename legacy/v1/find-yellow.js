// 행로표 엑셀에서 노란색(출발시간) 셀 찾기
const XLSX = require('xlsx');
const path = require('path');

const file = path.join('C:', 'Users', 'smrt2', 'Downloads', '답십리사업소_행로표_260223_113556.xlsm');
const wb = XLSX.readFile(file, { cellStyles: true, cellNF: true });

// 평일 시트에서 교번 19 주변 셀 스타일 확인
const ws = wb.Sheets['평일'];

// 교번 19 찾기 — raw data에서 위치 확인
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

// 먼저 교번 19 위치 찾기
let dia19row = -1;
for (let r = 0; r < data.length; r++) {
  const row = data[r];
  if (!row) continue;
  if (row[0] === 19 && row[1] && String(row[1]).includes('km')) {
    dia19row = r;
    break;
  }
}
console.log(`교번 19 row: ${dia19row}`);

// 교번 19 주변 20행 덤프 (셀 스타일 포함)
if (dia19row > 0) {
  for (let r = dia19row - 5; r <= dia19row + 20; r++) {
    const row = data[r];
    if (!row) { console.log(`Row ${r}: [empty]`); continue; }
    const vals = [];
    for (let c = 0; c < Math.min(row.length, 20); c++) {
      if (row[c] !== null && row[c] !== undefined) {
        // 셀 주소
        const addr = XLSX.utils.encode_cell({r, c});
        const cell = ws[addr];
        let style = '';
        if (cell && cell.s) {
          const fill = cell.s.fgColor || cell.s.bgColor || (cell.s.fill && cell.s.fill.fgColor);
          if (fill) style = ` [fill:${JSON.stringify(fill)}]`;
          // patternType 체크
          if (cell.s.fill) style = ` [fill:${JSON.stringify(cell.s.fill)}]`;
        }
        const v = typeof row[c] === 'number' && row[c] > 0 && row[c] < 2
          ? (() => { const s = Math.round(row[c]*86400); return `${Math.floor(s/3600)}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; })()
          : row[c];
        vals.push(`C${c}=${v}${style}`);
      }
    }
    if (vals.length > 0) console.log(`Row ${r}: ${vals.join(' | ')}`);
    else console.log(`Row ${r}: [null]`);
  }
}

// 셀 스타일 구조 확인 — 노란색 셀 찾기
console.log('\n\n=== 워크시트 전체에서 노란색 셀 샘플 ===');
let yellowSamples = 0;
const range = XLSX.utils.decode_range(ws['!ref']);
for (let r = range.s.r; r <= Math.min(range.e.r, 200); r++) {
  for (let c = range.s.c; c <= Math.min(range.e.c, 20); c++) {
    const addr = XLSX.utils.encode_cell({r, c});
    const cell = ws[addr];
    if (!cell) continue;
    if (cell.s) {
      const s = JSON.stringify(cell.s);
      if (s.includes('yellow') || s.includes('FFFF') || s.includes('fgColor')) {
        if (yellowSamples < 10) {
          const v = cell.v;
          console.log(`${addr} (Row ${r}, Col ${c}): value=${v}, style=${s}`);
          yellowSamples++;
        }
      }
    }
  }
}

if (yellowSamples === 0) {
  console.log('노란색 셀 없음 — 스타일 구조 확인...');
  // 첫 몇 개 셀의 스타일 구조 출력
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const addr = XLSX.utils.encode_cell({r, c});
      const cell = ws[addr];
      if (cell && cell.s) {
        console.log(`${addr}: style keys=${Object.keys(cell.s).join(',')}, style=${JSON.stringify(cell.s).slice(0,200)}`);
      }
    }
  }
}
