// 엑셀 출근/퇴근시각 vs data.js 값 비교 검증
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const file = path.join('C:', 'Users', 'smrt2', 'Downloads', '답십리사업소_행로표_260223_113556.xlsm');
const wb = XLSX.readFile(file, { raw: true });

function timeHM(val) {
  if (typeof val !== 'number' || val <= 0 || val >= 2) return null;
  const totalSec = Math.round(val * 86400);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 30) return null;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// data.js 로드
const dataContent = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');

const ALL_SHEETS = {
  '평일': { prefix: 'p_ord', diaRange: [1, 44] },
  '휴일': { prefix: 'p_hol', diaRange: [1, 44] },
  '평평': { prefix: 'p_ordord', diaRange: [62, 91] },
  '평휴': { prefix: 'p_ordhol', diaRange: [62, 91] },
  '휴평': { prefix: 'p_holord', diaRange: [62, 91] },
  '휴휴': { prefix: 'p_holhol', diaRange: [62, 91] }
};

// 검증 대상 교번: 각 시트에서 골고루 선택
const VERIFY_TARGETS = [
  { sheet: '평일', prefix: 'p_ord', dia: '1' },
  { sheet: '평일', prefix: 'p_ord', dia: '16' },
  { sheet: '평일', prefix: 'p_ord', dia: '19' },
  { sheet: '평일', prefix: 'p_ord', dia: '30' },
  { sheet: '휴일', prefix: 'p_hol', dia: '1' },
  { sheet: '휴일', prefix: 'p_hol', dia: '16' },
  { sheet: '평평', prefix: 'p_ordord', dia: '76' },
  { sheet: '평평', prefix: 'p_ordord', dia: '90' },
  { sheet: '휴평', prefix: 'p_holord', dia: '76' },
  { sheet: '휴휴', prefix: 'p_holhol', dia: '76' },
];

// data.js에서 특정 교번 s, e 값 추출
function getFromDataJs(prefix, dia) {
  const secStart = dataContent.indexOf(`${prefix}: {`);
  if (secStart === -1) return null;

  // 해당 교번 라인 찾기
  const pattern = `"${dia}":`;
  let searchStart = secStart;
  while (true) {
    const idx = dataContent.indexOf(pattern, searchStart);
    if (idx === -1) return null;
    // 앞 문자가 숫자가 아닌지 확인
    if (idx > 0 && dataContent[idx-1] >= '0' && dataContent[idx-1] <= '9') {
      searchStart = idx + 1;
      continue;
    }
    // s 필드 추출
    const lineEnd = dataContent.indexOf('\n', idx);
    const line = dataContent.slice(idx, lineEnd);
    const sMatch = line.match(/s:"([^"]*)"/);
    const eMatch = line.match(/e:"([^"]*)"/);
    return {
      s: sMatch ? sMatch[1] : null,
      e: eMatch ? eMatch[1] : null
    };
  }
}

// 엑셀에서 직접 추출
function getFromExcel(sheetName, config, diaNum) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    if (typeof row[0] !== 'string' || !row[0].includes('출근') || !row[0].includes('시각')) continue;

    let clockInRow = null;
    for (let sr = r + 1; sr < Math.min(r + 6, data.length); sr++) {
      if (data[sr] && typeof data[sr][0] === 'number' && data[sr][0] > 0 && data[sr][0] < 1) {
        clockInRow = sr;
        break;
      }
    }
    if (clockInRow === null) continue;

    let foundDia = null;
    for (let dr = clockInRow + 1; dr < Math.min(clockInRow + 5, data.length); dr++) {
      if (data[dr] && typeof data[dr][0] === 'number' &&
          data[dr][0] >= config.diaRange[0] && data[dr][0] <= config.diaRange[1]) {
        foundDia = data[dr][0];
        break;
      }
    }
    if (foundDia !== parseInt(diaNum)) continue;

    const clockIn = timeHM(data[clockInRow][0]);

    let clockOut = null;
    for (let rr = clockInRow + 3; rr < Math.min(clockInRow + 60, data.length); rr++) {
      const rrow = data[rr];
      if (rrow && typeof rrow[0] === 'string' && rrow[0].includes('퇴근') && rrow[0].includes('시각')) {
        const lowerRow = rr + 3;
        if (lowerRow < data.length && data[lowerRow] && typeof data[lowerRow][0] === 'number') {
          clockOut = timeHM(data[lowerRow][0]);
        }
        break;
      }
    }

    return { s: clockIn, e: clockOut };
  }
  return null;
}

// 비교 실행
console.log('=== 엑셀 vs data.js 출근/퇴근시각 검증 ===\n');
let pass = 0, fail = 0;

for (const target of VERIFY_TARGETS) {
  const config = ALL_SHEETS[target.sheet];
  const excel = getFromExcel(target.sheet, config, target.dia);
  const app = getFromDataJs(target.prefix, target.dia);

  const sMatch = excel && app && excel.s === app.s;
  const eMatch = excel && app && excel.e === app.e;
  const ok = sMatch && eMatch;

  const status = ok ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | ${target.prefix}/${target.dia} (${target.sheet})`);
  console.log(`  엑셀: 출근=${excel ? excel.s : 'N/A'}, 퇴근=${excel ? excel.e : 'N/A'}`);
  console.log(`  앱:   출근=${app ? app.s : 'N/A'}, 퇴근=${app ? app.e : 'N/A'}`);
  if (!ok) {
    if (!sMatch) console.log(`  ⚠ 출근 불일치!`);
    if (!eMatch) console.log(`  ⚠ 퇴근 불일치!`);
  }
  console.log('');
  if (ok) pass++; else fail++;
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL (총 ${VERIFY_TARGETS.length}건)`);
if (fail > 0) {
  console.log('❌ 검증 실패 — 커밋 불가');
  process.exit(1);
} else {
  console.log('✅ 전체 검증 통과 — 커밋 가능');
}
