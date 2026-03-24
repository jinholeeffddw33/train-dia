#!/usr/bin/env node
/**
 * verify-excel-v3.js
 * 엑셀 원본과 schedules.ts의 열차번호 교차 검증
 * 전체 열차번호 집합 비교 + 다이아별 비교 (경계 보정)
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = 'D:/교육자료/다이아 작업/답십리사업소_행로표_260322_210054(엑셀)/답십리사업소_행로표_260322_210054(엑셀).xlsm';
const schedulesPath = path.join(__dirname, '..', 'src', 'data', 'schedules.ts');

const wb = XLSX.readFile(excelPath);
const schedContent = fs.readFileSync(schedulesPath, 'utf-8');
const sections = ['p_ord', 'p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol'];
const sheetMap = {
  'p_ord': '평일', 'p_hol': '휴일', 'p_ordord': '평평',
  'p_ordhol': '평휴', 'p_holord': '휴평', 'p_holhol': '휴휴'
};

function cellVal(ws, r, c) {
  const addr = XLSX.utils.encode_cell({r, c});
  const cell = ws[addr];
  return cell ? cell.v : null;
}

function isTrainNum(v) {
  if (typeof v !== 'number') return false;
  return v >= 1000 && v <= 9999;
}

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

// 1) 전체 열차번호 집합 비교 (시트별)
console.log('===== 전체 열차번호 집합 비교 =====\n');

for (const [sec, sheetName] of Object.entries(sheetMap)) {
  const ws = wb.Sheets[sheetName];
  if (!ws) continue;
  const range = XLSX.utils.decode_range(ws['!ref']);

  // 엑셀 전체 열차번호
  const excelTrains = [];
  for (let r = 0; r <= range.e.r; r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const v = cellVal(ws, r, c);
      if (isTrainNum(v)) excelTrains.push(v);
    }
  }

  // schedules.ts 전체 열차번호
  const schedTrains = [];
  const schedData = parseSection(schedContent, sec);
  for (const nums of Object.values(schedData)) {
    schedTrains.push(...nums);
  }

  // 빈도 기반 비교 (같은 번호가 여러 번 나올 수 있음)
  const excelFreq = {};
  const schedFreq = {};
  for (const t of excelTrains) excelFreq[t] = (excelFreq[t] || 0) + 1;
  for (const t of schedTrains) schedFreq[t] = (schedFreq[t] || 0) + 1;

  const allNums = new Set([...Object.keys(excelFreq), ...Object.keys(schedFreq)]);
  let mismatches = 0;
  const details = [];

  for (const n of allNums) {
    const ec = excelFreq[n] || 0;
    const sc = schedFreq[n] || 0;
    if (ec !== sc) {
      mismatches++;
      if (ec === 0) details.push(`  ${n}: schedules에만 ${sc}회`);
      else if (sc === 0) details.push(`  ${n}: 엑셀에만 ${ec}회`);
      else details.push(`  ${n}: 엑셀 ${ec}회 vs schedules ${sc}회`);
    }
  }

  if (mismatches === 0) {
    console.log(`✅ ${sheetName}(${sec}): 전체 열차번호 완전 일치! (${schedTrains.length}개)`);
  } else {
    console.log(`❌ ${sheetName}(${sec}): ${mismatches}개 불일치`);
    // 처음 10개만 출력
    details.slice(0, 10).forEach(d => console.log(d));
    if (details.length > 10) console.log(`  ... 외 ${details.length - 10}개`);
  }
  console.log();
}

// 2) 엑셀 구조 상세 분석 (평일 시트 첫 다이아)
console.log('\n===== 엑셀 다이아 경계 분석 (평일 시트) =====\n');

const ws = wb.Sheets['평일'];
const range = XLSX.utils.decode_range(ws['!ref']);

// A열에서 다이아 번호 행, 그리고 그 주변의 열차번호 위치 확인
// "출근시각" 행도 찾기
for (let r = 0; r <= Math.min(60, range.e.r); r++) {
  const rowData = [];
  for (let c = 0; c <= Math.min(20, range.e.c); c++) {
    const v = cellVal(ws, r, c);
    if (v !== null && v !== undefined && v !== '') {
      const colName = XLSX.utils.encode_col(c);
      rowData.push(`${colName}=${typeof v === 'number' ? v : String(v).substring(0,15)}`);
    }
  }
  if (rowData.length > 0) {
    console.log(`R${String(r).padStart(3,'0')}: ${rowData.join(' | ')}`);
  }
}
