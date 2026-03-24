#!/usr/bin/env node
/**
 * verify-excel-v2.js
 * 엑셀 원본에서 각 다이아의 열차번호 추출 후 schedules.ts와 비교
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = 'D:/교육자료/다이아 작업/답십리사업소_행로표_260322_210054(엑셀)/답십리사업소_행로표_260322_210054(엑셀).xlsm';
const schedulesPath = path.join(__dirname, '..', 'src', 'data', 'schedules.ts');

// 엑셀 로드
console.log('엑셀 파일 로드 중...');
const wb = XLSX.readFile(excelPath);

// 평일 시트 상세 분석
const ws = wb.Sheets['평일'];
const range = XLSX.utils.decode_range(ws['!ref']);

function cellVal(ws, r, c) {
  const addr = XLSX.utils.encode_cell({r, c});
  const cell = ws[addr];
  return cell ? cell.v : null;
}

// 다이아 번호가 있는 행 찾기 (A열에 숫자)
// 그리고 열차번호 패턴 찾기 (4-5자리 숫자: 1xxx, 2xxx, 5xxx, 9xxx)
console.log('===== 평일 시트 전체 구조 분석 =====\n');

// 열차번호 패턴: 1000-9999
function isTrainNum(v) {
  if (typeof v !== 'number') return false;
  return v >= 1000 && v <= 9999;
}

// 먼저 다이아 경계를 찾자
// A열에서 다이아 번호(숫자)가 나오는 행 모음
const diaRows = [];
for (let r = 0; r <= range.e.r; r++) {
  const a = cellVal(ws, r, 0); // A열
  if (typeof a === 'number' && a >= 1 && a <= 100) {
    diaRows.push({ row: r, dia: a });
  } else if (typeof a === 'string' && a.startsWith('대') && /\d/.test(a)) {
    diaRows.push({ row: r, dia: a });
  }
}

console.log(`다이아 수: ${diaRows.length}`);
console.log('첫 5개:', diaRows.slice(0, 5));
console.log('마지막 5개:', diaRows.slice(-5));

// 다이아 1번의 행 범위에서 열차번호 찾기
if (diaRows.length >= 2) {
  const dia1 = diaRows.find(d => d.dia === 1);
  const dia1Idx = diaRows.indexOf(dia1);
  const nextDia = diaRows[dia1Idx + 1];

  if (dia1 && nextDia) {
    console.log(`\n다이아 1: 행 ${dia1.row}~${nextDia.row - 1}`);

    // 이 범위에서 모든 열차번호 수집
    const trainNums = [];
    for (let r = dia1.row; r < nextDia.row; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const v = cellVal(ws, r, c);
        if (isTrainNum(v)) {
          trainNums.push({ row: r, col: c, colName: XLSX.utils.encode_col(c), val: v });
        }
      }
    }

    console.log(`열차번호 발견: ${trainNums.length}개`);
    trainNums.forEach(t => {
      console.log(`  R${t.row} ${t.colName}: ${t.val}`);
    });

    // schedules.ts의 다이아 1 열차번호
    const content = fs.readFileSync(schedulesPath, 'utf-8');
    const match = content.match(/"1":\s*\{[^}]*g:\[(.*?)\]/);
    if (match) {
      const allNums = [];
      const segRegex = /n:\[([^\]]+)\]/g;
      let sm;
      while ((sm = segRegex.exec(match[1])) !== null) {
        const nums = sm[1].split(',').map(s => parseInt(s.trim()));
        allNums.push(...nums);
      }
      console.log(`\nschedules.ts 다이아 1: ${allNums.join(', ')}`);

      // 비교
      const excelNums = trainNums.map(t => t.val);
      const missing = allNums.filter(n => !excelNums.includes(n));
      const extra = excelNums.filter(n => !allNums.includes(n));
      console.log(`누락(schedules에 있지만 엑셀에 없음): ${missing.join(', ') || '없음'}`);
      console.log(`초과(엑셀에 있지만 schedules에 없음): ${extra.join(', ') || '없음'}`);
    }
  }
}

// 모든 다이아에 대해 비교 (일부만)
console.log('\n\n===== 전체 다이아 열차번호 비교 (평일) =====\n');

const schedContent = fs.readFileSync(schedulesPath, 'utf-8');
const sections = ['p_ord', 'p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol'];
const sheetMap = {
  'p_ord': '평일',
  'p_hol': '휴일',
  'p_ordord': '평평',
  'p_ordhol': '평휴',
  'p_holord': '휴평',
  'p_holhol': '휴휴'
};

function parseSection(content, section) {
  const secStart = content.indexOf(`${section}: {`);
  if (secStart === -1) return {};
  let secEnd = content.length;
  for (const s of sections) {
    if (s === section) continue;
    const idx = content.indexOf(`${s}: {`, secStart + 1);
    if (idx > secStart && idx < secEnd) secEnd = idx;
  }
  const closingIdx = content.indexOf('};', secStart);
  if (closingIdx > secStart && closingIdx < secEnd) secEnd = closingIdx;

  const sectionContent = content.substring(secStart, secEnd);
  const result = {};

  const lineRegex = /^\s*"([^"]+)":\s*\{.*?g:\[(.*)\]/gm;
  let m;
  while ((m = lineRegex.exec(sectionContent)) !== null) {
    const key = m[1];
    const gStr = m[2];
    const allNums = [];
    const segRegex = /n:\[([^\]]+)\]/g;
    let sm;
    while ((sm = segRegex.exec(gStr)) !== null) {
      const nums = sm[1].split(',').map(s => parseInt(s.trim()));
      allNums.push(...nums);
    }
    result[key] = allNums;
  }
  return result;
}

// 엑셀에서 다이아별 열차번호 추출
function extractExcelTrains(ws, sheetName) {
  const range = XLSX.utils.decode_range(ws['!ref']);
  const result = {};

  // 다이아 경계 찾기
  const diaRows = [];
  for (let r = 0; r <= range.e.r; r++) {
    const a = cellVal(ws, r, 0);
    if (typeof a === 'number' && a >= 1 && a <= 100) {
      diaRows.push({ row: r, dia: a });
    }
  }

  for (let di = 0; di < diaRows.length; di++) {
    const startRow = diaRows[di].row;
    const endRow = di + 1 < diaRows.length ? diaRows[di + 1].row : range.e.r + 1;
    const diaKey = String(diaRows[di].dia);

    const trainNums = [];
    for (let r = startRow; r < endRow; r++) {
      for (let c = 0; c <= range.e.c; c++) {
        const v = cellVal(ws, r, c);
        if (isTrainNum(v)) {
          trainNums.push(v);
        }
      }
    }
    result[diaKey] = trainNums;
  }

  return result;
}

let totalMismatch = 0;
let totalMatch = 0;

for (const [sec, sheetName] of Object.entries(sheetMap)) {
  const sheetWs = wb.Sheets[sheetName];
  if (!sheetWs) continue;

  const schedTrains = parseSection(schedContent, sec);
  const excelTrains = extractExcelTrains(sheetWs, sheetName);

  let sectionMismatch = 0;
  let sectionMatch = 0;

  for (const [key, schedNums] of Object.entries(schedTrains)) {
    const excelNums = excelTrains[key];
    if (!excelNums) {
      console.log(`❌ ${sec}."${key}" 엑셀에 다이아 없음`);
      sectionMismatch++;
      continue;
    }

    // 순서 무시 비교
    const schedSet = new Set(schedNums);
    const excelSet = new Set(excelNums);

    const missing = schedNums.filter(n => !excelSet.has(n));
    const extra = excelNums.filter(n => !schedSet.has(n));

    if (missing.length > 0 || extra.length > 0) {
      console.log(`❌ ${sec}."${key}" 불일치`);
      if (missing.length > 0) console.log(`   schedules에만: ${missing.join(', ')}`);
      if (extra.length > 0) console.log(`   엑셀에만: ${extra.join(', ')}`);
      sectionMismatch++;
    } else {
      sectionMatch++;
    }
  }

  // 엑셀에만 있는 다이아
  for (const key of Object.keys(excelTrains)) {
    if (!schedTrains[key] && !key.startsWith('대')) {
      const trains = excelTrains[key];
      if (trains.length > 0) {
        console.log(`⚠️ ${sec}."${key}" 엑셀에만 있음 (열차: ${trains.slice(0, 5).join(', ')}${trains.length > 5 ? '...' : ''})`);
      }
    }
  }

  console.log(`${sheetName}(${sec}): ✅ ${sectionMatch}개 일치, ❌ ${sectionMismatch}개 불일치\n`);
  totalMatch += sectionMatch;
  totalMismatch += sectionMismatch;
}

console.log(`\n===== 총합: ✅ ${totalMatch}개 일치, ❌ ${totalMismatch}개 불일치 =====`);
