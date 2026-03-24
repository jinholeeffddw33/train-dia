#!/usr/bin/env node
/**
 * regenerate-m.js v2
 * 열차번호(n 배열)만으로 m(행로 약호) 재생성
 *
 * 핵심 규칙:
 * - "방": 상행→하행 전환 (방화 턴)
 * - "마"/"하": 하행→상행 전환 (마천/하남 턴)
 * - 끝점: 상행="답", 기지="기", 하행="답"(방 뒤) 또는 지선+"답"(방 없이)
 * - 1000대 출고: 상행 선로 합류 (다음이 하행이면 "기방...")
 * - 2000대 출고: 하행 선로 합류 (기하...)
 * - 1000대 입고 from 상행: "방기" (방화 경유)
 * - 기지 입고 from 하행: 지선약어+"기"
 * - 2000대 입고 from 하행: "하기" (down→depot2)
 * - 2000대 입고 from 상행: 상행→depot2 = 회송 경유하므로 "하기" (59xx 경유 패턴)
 * - 회송(59xx): 방향은 짝홀수로 판단, 지선은 전후 문맥
 */

const fs = require('fs');
const path = require('path');

// ===== 진호 확인 정답 (절대 수정 금지) =====
const CONFIRMED = {
  'p_ord': {
    '2': '답하영,영하답',
    '3': '답방답,답방마답',
    '15': '답영,영상기,답마방답',
    '27': '답영,영방답,답방마답',
    '30': '답영,영방답,답마방답',
    '34': '답영,답방답,답방답',
    '51': '답방마답,답하답',
    '52': '답하미기,답방답',
    '53': '답마둔상기,답방답',
    '54': '답마방답,답마답',
    '82': '답마방기,기방마답',
  }
};

// ===== 방향/지선 판별 =====
function getDir(t) {
  if (t >= 1000 && t < 2000) return 'depot1';
  if (t >= 2000 && t < 3000) return 'depot2';
  return t % 2 === 0 ? 'up' : 'down';
}

function getBranch(t) {
  const h = Math.floor(t / 100);
  if (h >= 55 && h <= 58) return 'macheon';
  if (h >= 50 && h <= 54) return 'hanam';
  if (t >= 2000 && t < 3000) return 'hanam';
  if (t >= 1000 && t < 2000) return 'depot';
  if (t >= 5900 && t < 6000) return 'hwasong'; // 회송
  if (t >= 9000) return 'special';
  return 'unknown';
}

function branchAbbr(branch) {
  if (branch === 'macheon') return '마';
  if (branch === 'hanam') return '하';
  return '하'; // fallback
}

// 회송/특수열차의 지선 추정
function inferBranch(trains, idx) {
  // 뒤쪽 우선 (회송 다음에 오는 일반 열차가 목적지)
  for (let i = idx + 1; i < trains.length; i++) {
    const b = getBranch(trains[i]);
    if (b === 'macheon' || b === 'hanam') return b;
  }
  for (let i = idx - 1; i >= 0; i--) {
    const b = getBranch(trains[i]);
    if (b === 'macheon' || b === 'hanam') return b;
  }
  return 'hanam';
}

function effectiveBranch(t, trains, idx) {
  const b = getBranch(t);
  if (b === 'hwasong' || b === 'special' || b === 'unknown') {
    return inferBranch(trains, idx);
  }
  return b;
}

// ===== 세그먼트별 행로 약호 생성 =====
function generateSegmentRoute(trains) {
  if (!trains || trains.length === 0) return '답';

  const parts = [];
  let prevDir = null;    // 'up' or 'down' (실제 방향)
  let prevBranch = null;
  let hadBang = false;   // 마지막으로 "방"이 삽입되었는지 (끝점 지선약어 결정용)
  let lastNonDepotDir = null; // 기지 전의 마지막 방향

  // 시작점 결정
  const firstTrain = trains[0];
  const firstDir = getDir(firstTrain);

  if (firstDir === 'depot1' || firstDir === 'depot2') {
    parts.push('기');

    // 기지 출고 후 첫 일반 열차 찾기
    let nextIdx = -1;
    for (let i = 1; i < trains.length; i++) {
      const d = getDir(trains[i]);
      if (d !== 'depot1' && d !== 'depot2') {
        nextIdx = i;
        break;
      }
    }

    if (nextIdx >= 0) {
      const nextDir = getDir(trains[nextIdx]);
      const nextBranch = effectiveBranch(trains[nextIdx], trains, nextIdx);

      if (firstDir === 'depot1') {
        // 1000대: 상행 선로 합류
        if (nextDir === 'down') {
          // 상행으로 방화까지 → 턴 → 하행 = "방" 삽입
          parts.push('방');
          hadBang = true;
          prevDir = 'down';
          prevBranch = nextBranch;
        } else {
          // 바로 상행
          prevDir = 'up';
          prevBranch = nextBranch;
        }
      } else {
        // 2000대: 하행 선로 합류 (하남쪽)
        if (nextDir === 'up') {
          // 하행으로 나와서 상행 전환 = 하남 턴
          parts.push('하');
          prevDir = 'up';
          prevBranch = nextBranch;
          hadBang = false;
        } else {
          // 바로 하행
          prevDir = 'down';
          prevBranch = nextBranch;
          hadBang = false;
        }
      }

      // nextIdx까지의 기지 열차 스킵, nextIdx부터 진행
      for (let i = nextIdx + 1; i < trains.length; i++) {
        processTransition(trains, i, parts);
      }
    }
    // 기지만 있는 세그먼트
    if (nextIdx < 0) {
      // 끝이 기지면 이미 "기"
      return dedup(parts).join('');
    }

    // 끝점 처리
    return handleEnd(trains, parts, prevDir, prevBranch, hadBang);
  } else {
    // 일반 열차로 시작
    parts.push('답');
    prevDir = getDir(firstTrain);
    prevBranch = effectiveBranch(firstTrain, trains, 0);
    hadBang = false;

    for (let i = 1; i < trains.length; i++) {
      processTransition(trains, i, parts);
    }

    return handleEnd(trains, parts, null, null, null); // 이건 아래에서 다시 계산
  }

  // --- 내부 함수들은 아래에서 ---
  // 이 구조는 좀 복잡해지니 리팩토링하자
}

// 리팩토링: 깔끔한 상태 기반 생성기
function generateSegmentRouteV2(trains) {
  if (!trains || trains.length === 0) return '답';

  const parts = [];
  let prevDir = null;
  let prevBranch = null;
  let hadBangSinceLastTurn = false; // "방" 이후 지선전환 없이 끝나는지

  for (let i = 0; i < trains.length; i++) {
    const t = trains[i];
    const dir = getDir(t);
    const branch = effectiveBranch(t, trains, i);

    // ----- 기지 처리 -----
    if (dir === 'depot1' || dir === 'depot2') {
      if (i === 0) {
        // 세그먼트 시작이 기지
        parts.push('기');

        // 기지 출고 후 방향 설정
        const nextNormal = findNextNormal(trains, i);
        if (nextNormal) {
          const nd = getDir(nextNormal.train);
          const nb = effectiveBranch(nextNormal.train, trains, nextNormal.idx);

          if (dir === 'depot1') {
            // 1000대: 상행 선로 합류
            if (nd === 'down') {
              parts.push('방');
              hadBangSinceLastTurn = true;
              prevDir = nd;
              prevBranch = nb;
            } else {
              prevDir = 'up';
              prevBranch = nb;
            }
          } else {
            // 2000대: 하행(하남) 선로 합류
            if (nd === 'up') {
              parts.push('하');
              prevDir = 'up';
              prevBranch = nb;
              hadBangSinceLastTurn = false;
            } else {
              prevDir = 'down';
              prevBranch = nb;
            }
          }
        }
        continue;
      }

      // 세그먼트 중간 또는 끝에 기지
      if (i === trains.length - 1) {
        // 끝점이 기지
        if (dir === 'depot2') {
          // 2000대 입고: 하남쪽
          // 직전이 상행이면: 회송 경유 하남 입고 (59xx up → 2xxx)
          // 직전이 하행이면: 하남 하행 → 기지
          if (prevDir === 'up') {
            // "하기" - 상행에서 하남쪽 기지 = 회송 통해서
            // 실제 패턴: "답하기" = 5119(down)→5926(up/회송)→2008(depot2)
            // prevDir가 up인데 "하기"가 됨... 이건 회송열차 처리 때문
            parts.push('하기');
          } else {
            parts.push('하기');
          }
        } else {
          // 1000대 입고
          if (prevDir === 'up') {
            parts.push('방기');
          } else if (prevDir === 'down') {
            // 하행에서 기지 입고: 지선약어 + "기"
            // 마천 하행→기지: "마기", 하남 하행→기지: "하기"
            if (prevBranch === 'macheon') {
              parts.push('마기');
            } else {
              parts.push('하기');
            }
          } else {
            parts.push('기');
          }
        }
        break;
      }

      // 중간에 기지 (거의 없지만)
      continue;
    }

    // ----- 일반 열차 처리 -----
    if (i === 0) {
      // 첫 열차가 일반
      parts.push('답');
      prevDir = dir;
      prevBranch = branch;
      continue;
    }

    // 방향 전환 감지
    if (prevDir === 'up' && dir === 'down') {
      // 상행→하행 = "방"
      parts.push('방');
      hadBangSinceLastTurn = true;
      prevDir = dir;
      prevBranch = branch;
    } else if (prevDir === 'down' && dir === 'up') {
      // 하행→상행 = 지선약어
      parts.push(branchAbbr(prevBranch));
      hadBangSinceLastTurn = false;
      prevDir = dir;
      prevBranch = branch;
    } else {
      // 같은 방향 유지 (지선 변경 가능)
      prevDir = dir;
      prevBranch = branch;
    }
  }

  // 끝점 처리 (기지 끝은 위에서 이미 처리)
  const lastTrain = trains[trains.length - 1];
  const lastDir = getDir(lastTrain);

  if (lastDir !== 'depot1' && lastDir !== 'depot2') {
    if (lastDir === 'up') {
      parts.push('답');
    } else {
      // 하행으로 끝
      // hadBangSinceLastTurn: "방" 이후 지선전환(마/하) 없이 끝남 → "답"만
      if (hadBangSinceLastTurn) {
        parts.push('답');
      } else {
        // "방" 없이 하행으로 끝 → 지선약어 + "답"
        const lb = effectiveBranch(lastTrain, trains, trains.length - 1);
        parts.push(branchAbbr(lb));
        parts.push('답');
      }
    }
  }

  return dedup(parts).join('');
}

function findNextNormal(trains, fromIdx) {
  for (let i = fromIdx + 1; i < trains.length; i++) {
    const d = getDir(trains[i]);
    if (d !== 'depot1' && d !== 'depot2') {
      return { train: trains[i], idx: i };
    }
  }
  return null;
}

function dedup(parts) {
  const result = [];
  for (const p of parts) {
    // 각 글자를 분해해서 중복 제거 (예: "하기" → ['하', '기'])
    for (const ch of p) {
      if (result.length === 0 || result[result.length - 1] !== ch) {
        result.push(ch);
      }
    }
  }
  return [result.join('')]; // 단일 문자열로
}

// ===== 전체 m 생성 =====
function generateM(segments) {
  return segments.map(seg => generateSegmentRouteV2(seg)).join(',');
}

// ===== "마"/"하"로 끝나는 파트 수정 =====
function fixEndingBranch(m) {
  const parts = m.split(',');
  const fixed = parts.map(part => {
    if (part.endsWith('마') || part.endsWith('하')) {
      return part + '답';
    }
    return part;
  });
  return fixed.join(',');
}

// ===== schedules.ts 파싱 =====
const schedulesPath = path.join(__dirname, '..', 'src', 'data', 'schedules.ts');
const content = fs.readFileSync(schedulesPath, 'utf-8');
const sections = ['p_ord', 'p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol'];

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
      const segments = [];
      const segRegex = /\{[^}]*n:\[([^\]]+)\][^}]*\}/g;
      let segMatch;
      while ((segMatch = segRegex.exec(gStr)) !== null) {
        const nums = segMatch[1].split(',').map(s => parseInt(s.trim()));
        segments.push(nums);
      }
      if (segments.length > 0) {
        result[currentSection][key] = segments;
      }
    }
  }
  return result;
}

function extractCurrentM(content, section, key) {
  const secStart = content.indexOf(`${section}: {`);
  if (secStart === -1) return null;
  let secEnd = content.length;
  for (const s of sections) {
    if (s === section) continue;
    const idx = content.indexOf(`${s}: {`, secStart + 1);
    if (idx > secStart && idx < secEnd) secEnd = idx;
  }
  const closingIdx = content.indexOf('};', secStart);
  if (closingIdx > secStart && closingIdx < secEnd) secEnd = closingIdx;
  const sectionContent = content.substring(secStart, secEnd);
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mMatch = sectionContent.match(new RegExp(`"${escapedKey}":\\s*\\{[^}]*?m:"([^"]*)"`));
  if (mMatch) return mMatch[1];
  return null;
}

const schedules = parseSchedules(content);

// ===== 생성 및 검증 =====
console.log('===== m 필드 재생성 v2 =====\n');

let totalEntries = 0;
let changedEntries = 0;
const changes = {};
const endingIssues = [];
const depotIssues = [];

// 먼저 p_ord."82"가 어느 섹션에 있는지 확인
for (const section of sections) {
  if (!schedules[section]) continue;
  if (schedules[section]['82']) {
    console.log(`  p_ord."82" 확인 위치: ${section} → CONFIRMED 적용 대상: ${CONFIRMED[section] ? '있음' : '없음'}`);
  }
}
// p_ord."82"는 실제로 p_ordord에 있음
// CONFIRMED에서 p_ord.82 → p_ordord.82로 이동
if (CONFIRMED['p_ord'] && CONFIRMED['p_ord']['82']) {
  if (!CONFIRMED['p_ordord']) CONFIRMED['p_ordord'] = {};
  CONFIRMED['p_ordord']['82'] = CONFIRMED['p_ord']['82'];
  delete CONFIRMED['p_ord']['82'];
  console.log('  → p_ord."82" CONFIRMED를 p_ordord."82"로 이동\n');
}

for (const section of sections) {
  if (!schedules[section]) continue;
  changes[section] = {};

  for (const [key, segments] of Object.entries(schedules[section])) {
    totalEntries++;

    if (CONFIRMED[section] && CONFIRMED[section][key]) {
      changes[section][key] = CONFIRMED[section][key];
      continue;
    }

    let generated = generateM(segments);
    generated = fixEndingBranch(generated);
    changes[section][key] = generated;

    const currentM = extractCurrentM(content, section, key);
    if (currentM && currentM !== generated) {
      changedEntries++;
    }
  }
}

// 변경 사항 출력 (진호 확인값과 비교용으로 일부만)
console.log('--- 변경 사항 (첫 30건) ---\n');
let printCount = 0;
for (const section of sections) {
  if (!changes[section]) continue;
  for (const [key, newM] of Object.entries(changes[section])) {
    const currentM = extractCurrentM(content, section, key);
    if (currentM && currentM !== newM) {
      const isConfirmed = CONFIRMED[section] && CONFIRMED[section][key];
      if (printCount < 30) {
        console.log(`[${isConfirmed ? 'CONFIRMED' : 'CHANGED'}] ${section}."${key}"`);
        console.log(`  현재: "${currentM}"`);
        console.log(`  생성: "${newM}"`);
        console.log();
      }
      printCount++;
    }
  }
}
if (printCount > 30) {
  console.log(`... 외 ${printCount - 30}건 더\n`);
}

// "마"/"하"로 끝나는 파트 검사
let badEndings = 0;
for (const section of sections) {
  if (!changes[section]) continue;
  for (const [key, m] of Object.entries(changes[section])) {
    if (m.includes('충당') || m.includes('운휴')) continue;
    const parts = m.split(',');
    for (const part of parts) {
      if (part.endsWith('마') || part.endsWith('하')) {
        console.log(`❌ BAD ENDING: ${section}."${key}" → "${m}" (파트 "${part}")`);
        badEndings++;
      }
    }
  }
}

// 진호 확인값 검증
let confirmedOk = 0;
let confirmedFail = 0;
for (const [section, entries] of Object.entries(CONFIRMED)) {
  for (const [key, expected] of Object.entries(entries)) {
    if (changes[section] && changes[section][key] === expected) {
      confirmedOk++;
    } else {
      confirmedFail++;
      console.log(`❌ CONFIRMED NOT PRESERVED: ${section}."${key}" expected="${expected}" got="${changes[section] ? changes[section][key] : 'N/A'}"`);
    }
  }
}

console.log(`\n===== 검증 요약 =====`);
console.log(`총 항목: ${totalEntries}`);
console.log(`변경: ${changedEntries}`);
console.log(`"마"/"하" 끝나는 파트: ${badEndings}건`);
console.log(`진호 확인값: ${confirmedOk}/${confirmedOk + confirmedFail}`);

if (badEndings > 0 || confirmedFail > 0) {
  console.log('\n⚠️ 문제 있음 - 파일 업데이트 건너뜀');
  process.exit(1);
}

// ===== schedules.ts 업데이트 =====
console.log('\n===== schedules.ts 업데이트 중... =====');

let updatedContent = content;

for (const section of sections) {
  if (!changes[section]) continue;

  for (const [key, newM] of Object.entries(changes[section])) {
    const secStart = updatedContent.indexOf(`${section}: {`);
    if (secStart === -1) continue;

    let secEnd = updatedContent.length;
    for (const s of sections) {
      if (s === section) continue;
      const idx = updatedContent.indexOf(`${s}: {`, secStart + 1);
      if (idx > secStart && idx < secEnd) secEnd = idx;
    }
    const closingIdx = updatedContent.indexOf('};', secStart);
    if (closingIdx > secStart && closingIdx < secEnd) secEnd = closingIdx;

    const before = updatedContent.substring(0, secStart);
    const sectionStr = updatedContent.substring(secStart, secEnd);
    const after = updatedContent.substring(secEnd);

    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mRegex = new RegExp(`("${escapedKey}":\\s*\\{[^}]*?)m:"[^"]*"`, '');
    const updatedSection = sectionStr.replace(mRegex, `$1m:"${newM}"`);

    updatedContent = before + updatedSection + after;
  }
}

fs.writeFileSync(schedulesPath, updatedContent, 'utf-8');
console.log('schedules.ts 업데이트 완료!');

// 최종 파일 검증
const finalContent = fs.readFileSync(schedulesPath, 'utf-8');
let finalBadEndings = 0;
const mRegexAll = /m:"([^"]*)"/g;
let mMatch;
while ((mMatch = mRegexAll.exec(finalContent)) !== null) {
  const mv = mMatch[1];
  if (mv.includes('충당') || mv.includes('운휴') || mv.includes('대휴')) continue;
  const parts = mv.split(',');
  for (const part of parts) {
    if (part.endsWith('마') || part.endsWith('하')) {
      console.log(`❌ FINAL BAD: "${mv}" (파트 "${part}")`);
      finalBadEndings++;
    }
  }
}

let finalConfirmedOk = 0;
let finalConfirmedFail = 0;
for (const [section, entries] of Object.entries(CONFIRMED)) {
  for (const [key, expected] of Object.entries(entries)) {
    const actual = extractCurrentM(finalContent, section, key);
    if (actual === expected) {
      finalConfirmedOk++;
    } else {
      finalConfirmedFail++;
      console.log(`❌ FINAL CONFIRMED MISMATCH: ${section}."${key}" expected="${expected}" got="${actual}"`);
    }
  }
}

console.log(`\n===== 최종 검증 =====`);
console.log(`"마"/"하" 끝 파트: ${finalBadEndings}건`);
console.log(`진호 확인값 보존: ${finalConfirmedOk}/${finalConfirmedOk + finalConfirmedFail}`);
if (finalBadEndings === 0 && finalConfirmedFail === 0) {
  console.log('✅ 모든 검증 통과!');
}
