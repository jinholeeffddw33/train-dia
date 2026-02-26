// 행로표 엑셀에서 출근시각/퇴근시각 추출 (HH:MM, 초 제외)
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
  if (!ws) continue;
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  results[config.prefix] = {};

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    if (typeof row[0] !== 'string' || !row[0].includes('출근') || !row[0].includes('시각')) continue;

    // 출근시각 값 행 찾기
    let clockInRow = null;
    for (let sr = r + 1; sr < Math.min(r + 6, data.length); sr++) {
      if (data[sr] && typeof data[sr][0] === 'number' && data[sr][0] > 0 && data[sr][0] < 1) {
        clockInRow = sr;
        break;
      }
    }
    if (clockInRow === null) continue;

    // 교번 찾기
    let diaNum = null;
    for (let dr = clockInRow + 1; dr < Math.min(clockInRow + 5, data.length); dr++) {
      if (data[dr] && typeof data[dr][0] === 'number' &&
          data[dr][0] >= config.diaRange[0] && data[dr][0] <= config.diaRange[1]) {
        diaNum = data[dr][0];
        break;
      }
    }
    if (!diaNum) continue;

    // 출근시각 = 출근시각 행의 C0 (첫 번째 열)
    const clockIn = timeHM(data[clockInRow][0]);

    // 퇴근시각 찾기
    let clockOut = null;
    for (let rr = clockInRow + 3; rr < Math.min(clockInRow + 60, data.length); rr++) {
      const rrow = data[rr];
      if (rrow && typeof rrow[0] === 'string' && rrow[0].includes('퇴근') && rrow[0].includes('시각')) {
        // 퇴근시각 블록 → header(+1) → upper(+2) → lower(+3, C0=퇴근시각값)
        const lowerRow = rr + 3;
        if (lowerRow < data.length && data[lowerRow] && typeof data[lowerRow][0] === 'number') {
          clockOut = timeHM(data[lowerRow][0]);
        }
        break;
      }
    }

    results[config.prefix][String(diaNum)] = { s: clockIn, e: clockOut };
  }
}

// JSON 저장
const outPath = path.join(__dirname, 'clockin-data.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');

// 통계
let total = 0;
for (const [prefix, dias] of Object.entries(results)) {
  const count = Object.keys(dias).length;
  total += count;
  console.log(`${prefix}: ${count}개`);
}
console.log(`\n총 ${total}개 교번 출근/퇴근시각 추출 완료`);

// 샘플 출력
console.log('\n=== 샘플 ===');
const samples = [
  ['p_ord', '1'], ['p_ord', '16'], ['p_ord', '19'],
  ['p_ordord', '76'], ['p_ordord', '90'],
  ['p_hol', '1'], ['p_holord', '76']
];
for (const [sec, dia] of samples) {
  const d = results[sec] && results[sec][dia];
  if (d) console.log(`  ${sec}/${dia}: 출근=${d.s}, 퇴근=${d.e}`);
}
