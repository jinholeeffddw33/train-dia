#!/usr/bin/env node
// ===== schedules.ts 필수 필드 검증 스크립트 =====
//
// 사용법: node scripts/validate-schedules.js
//
// 행로표(schedules.ts) 교체 후 실행하여 m(운전행로) 필드 누락을 감지합니다.
// m 필드가 없으면 홈 화면 행로 약호 + 방향 배너가 깨집니다.

const fs = require('fs');
const path = require('path');

const SCHED_PATH = path.join(__dirname, '..', 'src', 'data', 'schedules.ts');

function main() {
  const src = fs.readFileSync(SCHED_PATH, 'utf-8');

  // 6개 테이블명
  const tables = ['p_ord', 'p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol'];
  let totalMissing = 0;
  const issues = [];

  for (const table of tables) {
    const re = new RegExp(`${table}:\\s*\\{([\\s\\S]*?)\\n  \\}`, 'm');
    const block = src.match(re);
    if (!block) {
      console.log(`⚠️  테이블 ${table} 없음`);
      continue;
    }

    const lines = block[1].split('\n');
    for (const line of lines) {
      // 구간 데이터가 있는 다이아 (g:[...])
      const diaMatch = line.match(/"([^"]+)":\s*\{/);
      if (!diaMatch) continue;
      const dia = diaMatch[1];

      const hasG = line.includes('g:[');
      const hasM = line.includes(',m:');

      if (hasG && !hasM) {
        totalMissing++;
        issues.push({ table, dia });
      }
    }
  }

  if (totalMissing === 0) {
    console.log('✅ schedules.ts 검증 통과 — 모든 근무 다이아에 m(운전행로) 필드 존재');
  } else {
    console.log(`❌ schedules.ts 검증 실패 — m 필드 누락 ${totalMissing}건`);
    console.log('');
    console.log('   m 필드가 없으면 홈 화면 행로 약호 + 방향 배너가 깨집니다.');
    console.log('   행로표 교체 시 반드시 m 필드를 포함해주세요.');
    console.log('');
    for (const { table, dia } of issues.slice(0, 10)) {
      console.log(`   ${table} > dia "${dia}": m 필드 없음`);
    }
    if (issues.length > 10) {
      console.log(`   ... 외 ${issues.length - 10}건`);
    }
    process.exit(1);
  }
}

main();
