// 교번 16 평일 — 전체 구간 데이터 추출 검증
const XLSX = require('xlsx');
const path = require('path');

const file = path.join('C:', 'Users', 'smrt2', 'Downloads', '답십리사업소_행로표_260223_113556.xlsm');
const wb = XLSX.readFile(file, { cellStyles: true, raw: true });
const ws = wb.Sheets['평일'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

function timeStr(val) {
  if (typeof val !== 'number' || val <= 0 || val >= 2) return null;
  const s = Math.round(val * 86400);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 30) return null;
  return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function getCellColor(ws, r, c) {
  const addr = XLSX.utils.encode_cell({r, c});
  const cell = ws[addr];
  if (!cell || !cell.s) return null;
  const fill = cell.s.fgColor || (cell.s.fill && cell.s.fill.fgColor);
  if (fill && fill.rgb) return fill.rgb;
  return null;
}

function getCellColorLabel(ws, r, c) {
  const rgb = getCellColor(ws, r, c);
  if (!rgb) return '';
  if (rgb.includes('FFFF00')) return '[노란]';
  if (rgb.includes('FFC0CB') || rgb.includes('FF69B4') || rgb.includes('FFB6C1')) return '[분홍]';
  if (rgb.includes('FF0000')) return '[빨강]';
  return `[${rgb}]`;
}

// 교번 16 위치 찾기 — "출근시각" 라벨 후 교번 16이 나오는 블록
console.log('=== 교번 16 평일 — 엑셀 원본 데이터 덤프 ===\n');

let blockStart = -1;
for (let r = 0; r < data.length; r++) {
  const row = data[r];
  if (!row) continue;
  if (typeof row[0] !== 'string' || !row[0].includes('출근') || !row[0].includes('시각')) continue;

  // 출근시각 라벨 발견 → 교번 번호 확인
  for (let dr = r + 1; dr < Math.min(r + 8, data.length); dr++) {
    const drow = data[dr];
    if (!drow) continue;
    if (drow[0] === 16) {
      blockStart = r;
      break;
    }
  }
  if (blockStart >= 0) break;
}

if (blockStart < 0) {
  console.log('교번 16 블록을 찾지 못했습니다.');
  process.exit(1);
}

console.log(`교번 16 블록 시작: Row ${blockStart}\n`);

// 블록 전체 덤프 (퇴근시각 라벨부터 퇴근 시각값까지)
// 위로 5행(퇴근시각), 아래로 30행 범위
const dumpStart = Math.max(0, blockStart - 8);
const dumpEnd = Math.min(data.length, blockStart + 35);

for (let r = dumpStart; r < dumpEnd; r++) {
  const row = data[r];
  if (!row) { console.log(`Row ${r}: [empty]`); continue; }

  const cells = [];
  for (let c = 0; c < Math.min(row.length || 0, 25); c++) {
    const val = row[c];
    if (val === null || val === undefined) continue;

    const color = getCellColorLabel(ws, r, c);
    let display;
    if (typeof val === 'number' && val > 0 && val < 2) {
      display = timeStr(val);
    } else {
      display = String(val);
    }
    cells.push(`C${c}=${display}${color}`);
  }

  if (cells.length > 0) {
    console.log(`Row ${r}: ${cells.join(' | ')}`);
  }
}

// 노란셀만 별도 정리
console.log('\n\n=== 노란색 셀 (출발시간) 목록 ===');
for (let r = dumpStart; r < dumpEnd; r++) {
  const row = data[r];
  if (!row) continue;
  for (let c = 0; c < Math.min(row.length || 0, 25); c++) {
    if (getCellColor(ws, r, c) && getCellColor(ws, r, c).includes('FFFF00')) {
      const val = row[c];
      const display = typeof val === 'number' && val > 0 && val < 2 ? timeStr(val) : val;
      console.log(`  Row ${r}, Col ${c}: ${display}`);
    }
  }
}

// 분홍셀 정리
console.log('\n=== 분홍색 셀 (구간번호) 목록 ===');
for (let r = dumpStart; r < dumpEnd; r++) {
  const row = data[r];
  if (!row) continue;
  for (let c = 0; c < Math.min(row.length || 0, 25); c++) {
    const rgb = getCellColor(ws, r, c);
    if (rgb && (rgb.includes('FFC0CB') || rgb.includes('FF69B4') || rgb.includes('FFB6C1'))) {
      console.log(`  Row ${r}, Col ${c}: ${row[c]}`);
    }
  }
}

// 열차번호 (4자리 숫자) 찾기
console.log('\n=== 열차번호 (4자리 숫자) ===');
for (let r = dumpStart; r < dumpEnd; r++) {
  const row = data[r];
  if (!row) continue;
  for (let c = 0; c < Math.min(row.length || 0, 25); c++) {
    const val = row[c];
    if (typeof val === 'number' && val >= 1000 && val <= 9999) {
      const color = getCellColorLabel(ws, r, c);
      console.log(`  Row ${r}, Col ${c}: ${val} ${color}`);
    }
  }
}
