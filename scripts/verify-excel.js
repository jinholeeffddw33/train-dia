#!/usr/bin/env node
/**
 * verify-excel.js
 * 엑셀 원본과 schedules.ts의 열차번호 교차 검증
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = 'D:/교육자료/다이아 작업/답십리사업소_행로표_260322_210054(엑셀)/답십리사업소_행로표_260322_210054(엑셀).xlsm';
const schedulesPath = path.join(__dirname, '..', 'src', 'data', 'schedules.ts');

// schedules.ts 파싱
const content = fs.readFileSync(schedulesPath, 'utf-8');
const sections = ['p_ord', 'p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol'];

// 시트 이름 매핑
const sheetMap = {
  'p_ord': '평일',
  'p_hol': '휴일',
  'p_ordord': '평평',
  'p_ordhol': '평휴',
  'p_holord': '휴평',
  'p_holhol': '휴휴'
};

function parseSchedules(content) {
  const lines = content.split('\n');
  const result = {};
  let currentSection = null;

  for (const line of lines) {
    for (const sec of sections) {
      if (line.includes(`${sec}: {`) || line.includes(`${sec}:{`)) {
        currentSection = sec;
        result[currentSection] = {};
        break;
      }
    }
    if (!currentSection) continue;

    const gMatch = line.match(/^\s*"([^"]+)":\s*\{.*?g:\[(.*)\]\s*\}/);
    if (gMatch && currentSection) {
      const key = gMatch[1];
      const gStr = gMatch[2];
      const allTrains = [];
      const segRegex = /\{[^}]*n:\[([^\]]+)\][^}]*\}/g;
      let segMatch;
      while ((segMatch = segRegex.exec(gStr)) !== null) {
        const nums = segMatch[1].split(',').map(s => parseInt(s.trim()));
        allTrains.push(...nums);
      }
      result[currentSection][key] = allTrains;
    }
  }
  return result;
}

const schedules = parseSchedules(content);

// 엑셀 읽기
console.log('엑셀 파일 로드 중...');
const wb = XLSX.readFile(excelPath);
console.log('시트 목록:', wb.SheetNames);

// 엑셀에서 열차번호 추출
// 엑셀 구조를 먼저 확인
for (const [sec, sheetName] of Object.entries(sheetMap)) {
  if (!wb.SheetNames.includes(sheetName)) {
    console.log(`⚠️ 시트 "${sheetName}" 없음`);
    continue;
  }

  const ws = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref']);

  console.log(`\n===== ${sheetName} (${sec}) =====`);
  console.log(`범위: ${ws['!ref']}`);

  // 처음 5행 출력 (구조 파악)
  for (let r = 0; r < Math.min(5, range.e.r + 1); r++) {
    const cells = [];
    for (let c = 0; c <= Math.min(10, range.e.c); c++) {
      const addr = XLSX.utils.encode_cell({r, c});
      const cell = ws[addr];
      cells.push(cell ? String(cell.v).substring(0, 15) : '');
    }
    console.log(`  R${r}: ${cells.join(' | ')}`);
  }
}

console.log('\n\n===== 상세 구조 분석 (평일 시트) =====');
const ws = wb.Sheets['평일'];
if (ws) {
  const range = XLSX.utils.decode_range(ws['!ref']);

  // 교번/다이아 번호가 있는 열과 열차번호가 있는 열 찾기
  // 첫 20행, 모든 열 스캔
  for (let r = 0; r < Math.min(20, range.e.r + 1); r++) {
    const cells = [];
    for (let c = 0; c <= Math.min(30, range.e.c); c++) {
      const addr = XLSX.utils.encode_cell({r, c});
      const cell = ws[addr];
      if (cell && cell.v !== undefined && cell.v !== '') {
        cells.push(`${XLSX.utils.encode_col(c)}:${String(cell.v).substring(0, 20)}`);
      }
    }
    if (cells.length > 0) {
      console.log(`  R${r}: ${cells.join(' | ')}`);
    }
  }
}
