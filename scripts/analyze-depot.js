#!/usr/bin/env node
/**
 * 기지(1000대/2000대) 관련 패턴 분석
 * 진호 확인값과 기존 m값에서 기지 입출고 패턴을 추출
 */
const fs = require('fs');
const path = require('path');

const schedulesPath = path.join(__dirname, '..', 'src', 'data', 'schedules.ts');
const content = fs.readFileSync(schedulesPath, 'utf-8');

function getDir(t) {
  if (t >= 1000 && t < 2000) return 'depot1';
  if (t >= 2000 && t < 3000) return 'depot2';
  return t % 2 === 0 ? 'up' : 'down';
}

function getBranch(t) {
  const h = Math.floor(t / 100);
  if (h >= 55 && h <= 58) return 'macheon';
  if (h >= 50 && h <= 54) return 'hanam';
  if (t >= 2000 && t < 3000) return 'depot2';
  if (t >= 1000 && t < 2000) return 'depot1';
  if (t >= 5900 && t < 6000) return 'hwasong';
  if (t >= 9000) return 'special';
  return 'unknown';
}

// 파싱
const sections = ['p_ord', 'p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol'];

function parseAll(content) {
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

    const match = line.match(/^\s*"([^"]+)":\s*\{.*?m:"([^"]*)".*?g:\[(.*)\]/);
    if (match) {
      const key = match[1];
      const m = match[2];
      const gStr = match[3];

      const segments = [];
      const segRegex = /\{[^}]*n:\[([^\]]+)\][^}]*\}/g;
      let segMatch;
      while ((segMatch = segRegex.exec(gStr)) !== null) {
        const nums = segMatch[1].split(',').map(s => parseInt(s.trim()));
        segments.push(nums);
      }

      result[currentSection][key] = { m, segments };
    }
  }
  return result;
}

const data = parseAll(content);

// 기지 관련 패턴 추출
console.log('===== 기지 입출고 패턴 분석 =====\n');

// 1. 기지 출고 패턴 (세그먼트 첫 열차가 기지)
console.log('--- 기지 출고 (세그먼트 시작이 1xxx/2xxx) ---\n');

for (const [sec, entries] of Object.entries(data)) {
  for (const [key, { m, segments }] of Object.entries(entries)) {
    const mParts = m.split(',');

    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];
      const firstTrain = seg[0];
      const firstDir = getDir(firstTrain);

      if (firstDir === 'depot1' || firstDir === 'depot2') {
        // 기지 출고
        const nextTrain = seg.find(t => getDir(t) !== 'depot1' && getDir(t) !== 'depot2');
        const nextDir = nextTrain ? getDir(nextTrain) : '?';
        const nextBranch = nextTrain ? getBranch(nextTrain) : '?';
        const mPart = mParts[si] || '?';

        console.log(`${sec}."${key}" seg${si}: ${firstDir}(${firstTrain})→${nextDir}(${nextTrain}/${nextBranch}) m="${mPart}" [${seg}]`);
      }
    }
  }
}

// 2. 기지 입고 패턴 (세그먼트 마지막 열차가 기지)
console.log('\n--- 기지 입고 (세그먼트 끝이 1xxx/2xxx) ---\n');

for (const [sec, entries] of Object.entries(data)) {
  for (const [key, { m, segments }] of Object.entries(entries)) {
    const mParts = m.split(',');

    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];
      const lastTrain = seg[seg.length - 1];
      const lastDir = getDir(lastTrain);

      if (lastDir === 'depot1' || lastDir === 'depot2') {
        // 기지 입고
        const prevTrains = seg.filter(t => getDir(t) !== 'depot1' && getDir(t) !== 'depot2');
        const prevTrain = prevTrains.length > 0 ? prevTrains[prevTrains.length - 1] : null;
        const prevDir = prevTrain ? getDir(prevTrain) : '?';
        const prevBranch = prevTrain ? getBranch(prevTrain) : '?';
        const mPart = mParts[si] || '?';

        console.log(`${sec}."${key}" seg${si}: ${prevDir}(${prevTrain}/${prevBranch})→${lastDir}(${lastTrain}) m="${mPart}" [${seg}]`);
      }
    }
  }
}

// 3. 회송(59xx)/특수(9xxx) 패턴
console.log('\n--- 회송/특수 열차 포함 세그먼트 ---\n');

for (const [sec, entries] of Object.entries(data)) {
  for (const [key, { m, segments }] of Object.entries(entries)) {
    const mParts = m.split(',');

    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];
      const hasSpecial = seg.some(t => (t >= 5900 && t < 6000) || t >= 9000);

      if (hasSpecial) {
        const mPart = mParts[si] || '?';
        const details = seg.map(t => `${t}(${getDir(t)}/${getBranch(t)})`).join('→');
        console.log(`${sec}."${key}" seg${si}: m="${mPart}" ${details}`);
      }
    }
  }
}

// 4. 단일열차 세그먼트 (영등포 등 특수 패턴)
console.log('\n--- 단일 열차 세그먼트 ---\n');

for (const [sec, entries] of Object.entries(data)) {
  for (const [key, { m, segments }] of Object.entries(entries)) {
    const mParts = m.split(',');

    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];
      if (seg.length === 1) {
        const t = seg[0];
        const mPart = mParts[si] || '?';
        console.log(`${sec}."${key}" seg${si}: [${t}] (${getDir(t)}/${getBranch(t)}) m="${mPart}"`);
      }
    }
  }
}
