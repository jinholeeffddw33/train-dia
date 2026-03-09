#!/usr/bin/env node
// ===== DIA 근무계획 Excel → cycle.ts 임포트 스크립트 =====
//
// 사용법:
//   node scripts/import-excel.js validate "C:\...\월별근무순서별_202603_....xlsx"
//   node scripts/import-excel.js apply   "C:\...\월별근무순서별_202603_....xlsx"
//
// validate: 검증만 (파일 변경 없음)
// apply:    검증 통과 후 cycle.ts.new 생성
//
// 열차번호 규칙: 홀수=하선교대, 짝수=상선교대

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// ===== 설정 =====
const CYCLE_PATH = path.join(__dirname, '..', 'src', 'data', 'cycle.ts');
const CYCLE_LENGTH = 171;

// Excel 컬럼 인덱스
const COL = {
  ROLE_CODE: 7,  // 승무역할구분코드
  ROLE: 8,       // 승무역할
  SABUN: 9,      // 승무사원번호
  NAME: 10,      // 승무원
  SEQ_NO: 11,    // 승무순서일련번호
  REST_COUNT: 12, // 휴무개수
  DAY_START: 13, // 1일 (이후 2일=14, 3일=15, ...)
};

// ===== 유틸리티 =====

/** 특수 교번값 → 정규 교번으로 정규화 */
function normalize(v) {
  if (!v || v === '0') return null;
  v = String(v).trim();
  if (v.startsWith('운휴')) return v.replace('운휴', '');   // 운휴44 → 44
  if (v.startsWith('대휴')) return v.replace('대휴', '');   // 대휴63 → 63
  if (v.match(/^분할(\d+)-\d+$/)) return v.replace(/^분할(\d+)-\d+$/, '$1'); // 분할63-2 → 63
  if (v === '지정[주]') return null; // 지정 근무 — CYCLE 밖, 개별 임시 배치
  return v;
}

/** 결원 여부 판별 */
function isVacancy(name) {
  return /^결원/.test(name);
}

/** cycle.ts에서 현재 CYCLE, P 파싱 */
function parseCycleTs() {
  const content = fs.readFileSync(CYCLE_PATH, 'utf-8');

  // CYCLE 배열
  const cycleMatch = content.match(/CYCLE:\s*string\[\]\s*=\s*\[(.*?)\]/s);
  if (!cycleMatch) throw new Error('CYCLE 배열 파싱 실패');
  const CYCLE = cycleMatch[1].match(/"([^"]+)"/g).map(s => s.replace(/"/g, ''));

  // DB_STD
  const stdMatch = content.match(/DB_STD\s*=\s*new Date\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!stdMatch) throw new Error('DB_STD 파싱 실패');
  const DB_STD = new Date(+stdMatch[1], +stdMatch[2], +stdMatch[3]);

  // Person 배열
  const personMatch = content.match(/P:\s*Person\[\]\s*=\s*\[([\s\S]*?)\];/);
  if (!personMatch) throw new Error('P 배열 파싱 실패');
  const persons = [];
  const pRegex = /\{I:"(\d+)",d:"([^"]+)",n:"([^"]+)"(?:,s:"([^"]+)")?\}/g;
  let m;
  while ((m = pRegex.exec(personMatch[1])) !== null) {
    persons.push({ I: m[1], d: m[2], n: m[3], s: m[4] || null });
  }

  return { CYCLE, DB_STD, persons, rawContent: content };
}

/** Excel에서 기관사 데이터 추출 */
function readExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref']);

  // 월 정보 추출 (파일명에서)
  const fnMatch = path.basename(filePath).match(/(\d{6})/);
  if (!fnMatch) throw new Error('파일명에서 연월(YYYYMM) 추출 실패');
  const ym = fnMatch[1];
  const year = parseInt(ym.substring(0, 4));
  const month = parseInt(ym.substring(4, 6)); // 1-based
  const daysInMonth = new Date(year, month, 0).getDate();
  const refDate = new Date(year, month - 1, 1); // 1일을 기준일로

  console.log(`📅 대상: ${year}년 ${month}월 (${daysInMonth}일간)`);
  console.log(`📅 기준일: ${year}-${String(month).padStart(2, '0')}-01`);

  const drivers = [];
  const nonDrivers = [];

  for (let r = 1; r <= range.e.r; r++) {
    const role = String(ws[XLSX.utils.encode_cell({ r, c: COL.ROLE })]?.v || '');
    const name = String(ws[XLSX.utils.encode_cell({ r, c: COL.NAME })]?.v || '').trim();
    const sabun = String(ws[XLSX.utils.encode_cell({ r, c: COL.SABUN })]?.v || '').trim();
    const seqNo = String(ws[XLSX.utils.encode_cell({ r, c: COL.SEQ_NO })]?.v || '').trim();

    if (role !== '기관사') {
      nonDrivers.push({ name, role });
      continue;
    }

    // 일별 교번 추출
    const rawDays = [];
    const normDays = [];
    for (let d = 0; d < daysInMonth; d++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: COL.DAY_START + d })];
      const raw = cell ? String(cell.v).trim() : '';
      rawDays.push(raw);
      normDays.push(normalize(raw));
    }

    drivers.push({
      name,
      sabun,
      seqNo,
      rawDays,
      normDays,
    });
  }

  return { year, month, daysInMonth, refDate, drivers, nonDrivers };
}

// ===== 검증 함수들 =====

/** 검증 1: 인원 수 */
function validateCount(drivers) {
  const ok = drivers.length === CYCLE_LENGTH;
  const icon = ok ? '✅' : '⚠️';
  console.log(`${icon} 인원 수: ${drivers.length}명 (기대: ${CYCLE_LENGTH})`);
  return ok;
}

/** 검증 2: 1일 교번이 모두 현재 CYCLE에 존재하는지 */
function validateDayOne(drivers, CYCLE) {
  let pass = 0, fail = 0, skip = 0;
  const missing = [];

  for (const d of drivers) {
    const d1 = d.normDays[0];
    if (!d1) { skip++; continue; }
    if (CYCLE.includes(d1)) {
      pass++;
    } else {
      fail++;
      missing.push(`${d.name}: "${d1}" (raw: "${d.rawDays[0]}")`);
    }
  }

  const ok = fail === 0;
  console.log(`${ok ? '✅' : '❌'} 1일 교번 CYCLE 존재: 통과 ${pass}, 실패 ${fail}, 스킵 ${skip}`);
  if (missing.length > 0) {
    missing.forEach(m => console.log(`   ${m}`));
  }
  return ok;
}

/** 검증 3: 일별 진행이 CYCLE과 일치하는지 (교차검증) */
function validateProgression(drivers, CYCLE) {
  let pass = 0, fail = 0, skip = 0;
  const problems = [];
  const swaps = []; // 교번 맞교환 감지

  for (const d of drivers) {
    const d1 = d.normDays[0];
    if (!d1) { skip++; continue; }
    const idx = CYCLE.indexOf(d1);
    if (idx === -1) { skip++; continue; }

    let personOk = true;
    for (let day = 1; day < d.normDays.length; day++) {
      const norm = d.normDays[day];
      if (!norm) continue; // null 스킵 (지정/0 등)
      const expected = CYCLE[(idx + day) % CYCLE_LENGTH];
      if (norm !== expected) {
        problems.push({
          name: d.name,
          day: day + 1,
          expected,
          got: norm,
          raw: d.rawDays[day],
        });
        personOk = false;
        break;
      }
    }
    if (personOk) pass++;
    else fail++;
  }

  // 맞교환 감지: A의 expected가 B의 got이고 반대도 같으면
  for (let i = 0; i < problems.length; i++) {
    for (let j = i + 1; j < problems.length; j++) {
      const a = problems[i], b = problems[j];
      if (a.day === b.day && a.expected === b.got && b.expected === a.got) {
        swaps.push(`${a.name} ↔ ${b.name} (${a.day}일: ${a.expected}/${b.expected})`);
      }
    }
  }

  const ok = fail === 0;
  console.log(`${ok ? '✅' : '⚠️'} CYCLE 진행 검증: 일치 ${pass}, 불일치 ${fail}, 스킵 ${skip}`);
  if (problems.length > 0) {
    console.log('   불일치 상세:');
    problems.forEach(p => console.log(`   ${p.name} ${p.day}일: expected=${p.expected} got=${p.got} (raw=${p.raw})`));
  }
  if (swaps.length > 0) {
    console.log('   🔄 교번 맞교환 감지:');
    swaps.forEach(s => console.log(`   ${s}`));
  }
  return { ok, problems, swaps };
}

/** 검증 4: 고유성 — 1일 교번 중복 확인 */
function validateUniqueness(drivers) {
  const d1Map = new Map();
  const dupes = [];

  for (const d of drivers) {
    const d1 = d.normDays[0];
    if (!d1) continue;
    if (d1Map.has(d1)) {
      dupes.push(`"${d1}": ${d1Map.get(d1)} & ${d.name}`);
    } else {
      d1Map.set(d1, d.name);
    }
  }

  const ok = dupes.length === 0;
  console.log(`${ok ? '✅' : '❌'} 교번 고유성: ${ok ? '중복 없음' : dupes.length + '건 중복'}`);
  if (dupes.length > 0) {
    dupes.forEach(d => console.log(`   ${d}`));
  }
  return ok;
}

/** 검증 5: 스케줄 테이블 호환성 */
function validateScheduleCompat(drivers, CYCLE) {
  // schedules.ts에서 키 추출
  const schedContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'schedules.ts'), 'utf-8');
  const schedKeys = new Set();
  const keyRegex = /"([^"]+)":\s*\{s:/g;
  let m;
  while ((m = keyRegex.exec(schedContent)) !== null) {
    schedKeys.add(m[1]);
  }

  // CYCLE에서 근무교번만 추출 (휴/비번 제외)
  const workDias = new Set();
  for (const c of CYCLE) {
    if (!c.startsWith('휴') && !c.endsWith('~')) {
      workDias.add(c);
    }
  }

  const missing = [];
  for (const dia of workDias) {
    if (!schedKeys.has(dia)) {
      missing.push(dia);
    }
  }

  const ok = missing.length === 0;
  console.log(`${ok ? '✅' : '❌'} 스케줄 테이블 호환: ${ok ? '모든 교번 매칭' : missing.length + '개 누락'}`);
  if (missing.length > 0) {
    console.log(`   누락: ${missing.join(', ')}`);
  }
  return ok;
}

/** 검증 6: Person.I 보존 (기존 사번 → I 매핑 유지) */
function validatePersonI(drivers, existingPersons) {
  let preserved = 0, changed = 0, newPersons = 0;
  const changes = [];

  for (const d of drivers) {
    if (isVacancy(d.name)) continue;

    const existing = existingPersons.find(p => p.s === d.sabun);
    if (!existing) {
      newPersons++;
      continue;
    }
    // seqNo(승무순서일련번호)가 기존 I와 같은지
    if (existing.I === d.seqNo) {
      preserved++;
    } else {
      changed++;
      changes.push(`${d.name}: 기존 I=${existing.I} → Excel순서=${d.seqNo}`);
    }
  }

  console.log(`ℹ️  Person.I: 보존 ${preserved}, 변경 ${changed}, 신규 ${newPersons}`);
  if (changes.length > 0) {
    changes.slice(0, 5).forEach(c => console.log(`   ${c}`));
    if (changes.length > 5) console.log(`   ... 외 ${changes.length - 5}건`);
  }
  // I 변경은 경고만 (블로킹 아님)
  return true;
}

/** 검증 7: 결원 처리 확인 */
function validateVacancies(drivers) {
  const vacancies = drivers.filter(d => isVacancy(d.name));
  const vacancySabuns = vacancies.map(d => `${d.name}(${d.sabun})`);
  console.log(`ℹ️  결원: ${vacancies.length}명 — ${vacancySabuns.join(', ')}`);
  return true;
}

// ===== Person 배열 생성 =====

function buildPersonArray(drivers, existingPersons) {
  const result = [];

  // 기존 사번→Person 매핑 (I 보존용)
  const sabunToExisting = new Map();
  for (const p of existingPersons) {
    if (p.s) sabunToExisting.set(p.s, p);
  }

  // 결원 이름→Person 매핑 (I 보존용)
  const vacNameToExisting = new Map();
  for (const p of existingPersons) {
    if (isVacancy(p.n)) vacNameToExisting.set(p.n, p);
  }

  for (const d of drivers) {
    const d1 = d.normDays[0];
    if (!d1) {
      console.log(`⚠️  ${d.name}: 1일 교번 없음, 스킵`);
      continue;
    }

    // I 결정: 기존 사번 매칭 → 기존 I 유지 / 없으면 Excel seqNo
    let personI = d.seqNo;
    if (!isVacancy(d.name) && d.sabun && !d.sabun.startsWith('9G')) {
      const existing = sabunToExisting.get(d.sabun);
      if (existing) personI = existing.I; // 기존 I 보존 (즐겨찾기 깨짐 방지)
    } else if (isVacancy(d.name)) {
      const existing = vacNameToExisting.get(d.name);
      if (existing) personI = existing.I; // 결원 번호도 보존
    }

    const person = {
      I: personI,
      d: d1,
      n: d.name,
    };

    // 사번 (결원은 사번 없음)
    if (!isVacancy(d.name) && d.sabun && !d.sabun.startsWith('9G')) {
      person.s = d.sabun;
    }

    result.push(person);
  }

  // I 순서로 정렬
  result.sort((a, b) => parseInt(a.I) - parseInt(b.I));
  return result;
}

// ===== cycle.ts 생성 =====

function generateCycleTs(CYCLE, refDate, persons) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth(); // 0-based
  const day = refDate.getDate();

  let out = `// ===== 교번 주기 + 인원 데이터 (${year} 시즌) =====\n\n`;
  out += `import type { Person } from '@/lib/types';\n\n`;
  out += `/** ${CYCLE_LENGTH}일 주기 배열 */\n`;
  out += `export const CYCLE: string[] = [${CYCLE.map(c => `"${c}"`).join(',')}];\n\n`;
  out += `/** 기준일 ${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} */\n`;
  out += `export const DB_STD = new Date(${year}, ${month}, ${day});\n\n`;
  out += `/** 주기 일수 */\n`;
  out += `export const CL = ${CYCLE_LENGTH};\n\n`;
  out += `/** 인원 목록 (${persons.length}명) */\n`;
  out += `export const P: Person[] = [\n`;

  // 3명씩 한 줄
  for (let i = 0; i < persons.length; i += 3) {
    const chunk = persons.slice(i, i + 3);
    const items = chunk.map(p => {
      let entry = `{I:"${p.I}",d:"${p.d}",n:"${p.n}"`;
      if (p.s) entry += `,s:"${p.s}"`;
      entry += '}';
      return entry;
    });
    out += `  ${items.join(',')},\n`;
  }

  out += `];\n`;
  return out;
}

// ===== 메인 =====

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('사용법: node scripts/import-excel.js <validate|apply> <Excel 파일 경로>');
    console.log('');
    console.log('  validate  — 검증만 (파일 변경 없음)');
    console.log('  apply     — 검증 통과 후 cycle.ts.new 생성');
    process.exit(1);
  }

  const mode = args[0];
  const filePath = path.resolve(args[1]);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ 파일 없음: ${filePath}`);
    process.exit(1);
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(' DIA 근무계획 임포트 스크립트');
  console.log(`  모드: ${mode.toUpperCase()}`);
  console.log(`  파일: ${path.basename(filePath)}`);
  console.log('═══════════════════════════════════════════');
  console.log('');

  // 1. 현재 데이터 로드
  console.log('📂 현재 cycle.ts 로드...');
  const current = parseCycleTs();
  console.log(`   CYCLE: ${current.CYCLE.length}개, Person: ${current.persons.length}명`);
  console.log(`   DB_STD: ${current.DB_STD.toISOString().split('T')[0]}`);
  console.log('');

  // 2. Excel 읽기
  console.log('📊 Excel 파일 읽기...');
  const excel = readExcel(filePath);
  console.log(`   기관사: ${excel.drivers.length}명`);
  if (excel.nonDrivers.length > 0) {
    console.log(`   비기관사 (제외): ${excel.nonDrivers.map(d => `${d.name}(${d.role})`).join(', ')}`);
  }
  console.log('');

  // 3. 검증 실행
  console.log('──── 검증 시작 ────');
  console.log('');

  const results = [];
  results.push(validateCount(excel.drivers));
  results.push(validateDayOne(excel.drivers, current.CYCLE));
  const progResult = validateProgression(excel.drivers, current.CYCLE);
  results.push(progResult.ok);
  results.push(validateUniqueness(excel.drivers));
  results.push(validateScheduleCompat(excel.drivers, current.CYCLE));
  validatePersonI(excel.drivers, current.persons);
  validateVacancies(excel.drivers);

  console.log('');

  // 4. 변경 감지
  console.log('──── 변경 감지 ────');
  console.log('');

  const newPersons = buildPersonArray(excel.drivers, current.persons);
  let dChanges = 0, nameChanges = 0, newEntries = 0;
  const changeDetails = [];

  for (const np of newPersons) {
    const existing = current.persons.find(p => p.I === np.I);
    if (!existing) {
      newEntries++;
      changeDetails.push(`+ [${np.I}] ${np.n} (신규)`);
      continue;
    }
    if (existing.d !== np.d) {
      dChanges++;
      changeDetails.push(`Δ [${np.I}] ${existing.n}: ${existing.d} → ${np.d}`);
    }
    if (existing.n !== np.n) {
      nameChanges++;
      changeDetails.push(`~ [${np.I}] 이름: ${existing.n} → ${np.n}`);
    }
  }

  // 삭제된 인원
  for (const ep of current.persons) {
    if (!newPersons.find(p => p.I === ep.I)) {
      changeDetails.push(`- [${ep.I}] ${ep.n} (삭제)`);
    }
  }

  const dbStdChanged = excel.refDate.getTime() !== current.DB_STD.getTime();
  if (dbStdChanged) {
    console.log(`📅 DB_STD: ${current.DB_STD.toISOString().split('T')[0]} → ${excel.refDate.toISOString().split('T')[0]}`);
  }
  console.log(`📊 교번 변경: ${dChanges}건, 이름 변경: ${nameChanges}건, 신규: ${newEntries}건`);
  if (changeDetails.length > 0 && changeDetails.length <= 30) {
    changeDetails.forEach(c => console.log(`   ${c}`));
  } else if (changeDetails.length > 30) {
    changeDetails.slice(0, 20).forEach(c => console.log(`   ${c}`));
    console.log(`   ... 외 ${changeDetails.length - 20}건`);
  }
  console.log('');

  // 5. 결과 판정
  const criticalFail = !results[0] || !results[1] || !results[3]; // 인원수, 1일교번, 고유성
  const hasWarnings = !progResult.ok || !results[4]; // 진행검증, 스케줄호환

  console.log('══════════════════════════════════════');
  if (criticalFail) {
    console.log('❌ 결과: FAIL — 치명적 검증 실패');
    console.log('   cycle.ts 업데이트 불가. 데이터 확인 필요.');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  결과: PASS (경고 있음)');
    console.log('   교번 맞교환 또는 스케줄 누락이 있지만 진행 가능');
  } else {
    console.log('✅ 결과: PASS — 모든 검증 통과');
  }
  console.log('══════════════════════════════════════');
  console.log('');

  // 6. Apply 모드
  if (mode === 'apply') {
    const outputPath = CYCLE_PATH + '.new';
    const content = generateCycleTs(current.CYCLE, excel.refDate, newPersons);
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`📝 생성: ${outputPath}`);
    console.log('');
    console.log('다음 단계:');
    console.log(`  1. 확인:  diff src/data/cycle.ts src/data/cycle.ts.new`);
    console.log(`  2. 백업:  cp src/data/cycle.ts src/data/cycle.ts.bak`);
    console.log(`  3. 교체:  mv src/data/cycle.ts.new src/data/cycle.ts`);
    console.log(`  4. 테스트: npm test`);
    console.log(`  5. 빌드:  npm run build`);
    console.log('');
  } else {
    console.log('💡 적용하려면: node scripts/import-excel.js apply "' + args[1] + '"');
  }
}

main();
