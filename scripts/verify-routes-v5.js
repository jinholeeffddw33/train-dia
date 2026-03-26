// v5: 소요시간 역검증 — 현재 m의 경로가 실제 소요시간과 일치하는지 확인
// "답방하"가 134분이면 60(답→방)+96(방→하)=156분이어야 하는데 134분이면 안 맞음
// → 중간역 하차 가능성
//
// 정답 케이스로 학습한 패턴:
// - "답방하" = 답→방화→하남 방면 (방화까지만 확실, 이후는 열차에 탑승하는 것)
//   실제로는 상행(답→방) + 하행(방→하남방면) 패턴
//   소요시간: 상행 60분 + 하행 ?분 + 대기/교대시간
// - "답하답" = 답→하남검단산→답 = 하행+상행 = 36+36=72분 + 대기
// - "답마답" = 답→마천→답 = 26+26=52분 + 대기
// - "답방마답" = 답→방→마천→답 = 60+86+26≈172분 + 대기
//
// 접근법: m의 각 "구간"(답→방, 방→마 등)의 소요시간 합과
// 실제 세그먼트 소요시간을 비교하여 불일치 감지

const fs = require('fs');
const path = require('path');

const schedulesPath = path.join(__dirname, '..', 'src', 'data', 'schedules.ts');
let code = fs.readFileSync(schedulesPath, 'utf8');
code = code.replace(/^import\s+type\s+.*$/gm, '');
code = code.replace(/export const S:\s*ScheduleDB\s*=\s*/, 'var S = ');
eval(code);

function classify(num) {
  const even = num % 2 === 0;
  if (num >= 5500 && num <= 5899) return { line: '마', up: even };
  if (num >= 5000 && num <= 5499) return { line: '하', up: even };
  if (num >= 1000 && num <= 1999) return { line: '기', up: even };
  if (num >= 2000 && num <= 2999) return { line: '미', up: even };
  if (num >= 5900 && num <= 5999) return { line: '회', up: even };
  if (num >= 9000 && num <= 9999) return { line: '회9', up: null };
  return { line: '?', up: null };
}

function t2m(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

// ─── 역간 순수 운행 시간 (분) — 대기시간 미포함 ───
const RUN = {
  '답방': 60, '방답': 60,
  '답마': 26, '마답': 26,
  '답하': 36, '하답': 36,
  '답영': 24, '영답': 24,
  '답강': 15, '강답': 15,
  '답상': 30, '상답': 30,
  '답둔': 20, '둔답': 20,
  '답미': 33, '미답': 33,
  '답기': 33, '기답': 33,
  '답군': 8,  '군답': 8,
  '방마': 86, '마방': 86,
  '방하': 96, '하방': 96,
  '방강': 75, '강방': 75,
  '방상': 90, '상방': 90,
  '방기': 93, '기방': 93,
  '방영': 36, '영방': 36,
  '마하': 52, '하마': 52, // 마천↔하남 (답 경유)
  '마기': 59, '기마': 59, // 마천↔기지 (답 경유 추정)
  '하기': 5,  '기하': 5,  // 하남↔기지 (근접)
  '마영': 50, '영마': 50,
  '하영': 60, '영하': 60,
  '강마': 11, '마강': 11,
  '강하': 21, '하강': 21,
  '강기': 18, '기강': 18,
  '상기': 3,  '기상': 3,
  '둔상': 10, '상둔': 10,
  '둔기': 13, '기둔': 13,
  '미기': 0,  '기미': 0,  // 미사≈기지
};

// m 경로의 순수 운행시간 계산
function calcRouteTime(mStr) {
  // "답방마답" → ["답","방","마","답"] → 답→방 + 방→마 + 마→답
  const stops = mStr.split('');
  let total = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const key = stops[i] + stops[i+1];
    const t = RUN[key];
    if (t === undefined) return { time: null, missing: key };
    total += t;
  }
  return { time: total, missing: null };
}

// ─── 분석 ───
const PROTECTED = {
  'p_ord': ['51', '52', '53', '54'],
  'p_ordord': ['82'],
};

const issues = [];
let total = 0;

for (const [prefix, dias] of Object.entries(S)) {
  for (const [diaNum, data] of Object.entries(dias)) {
    if (!data.g || data.g.length === 0) continue;
    if (data.m.includes('충당') || data.m.includes('운휴') || data.m.includes('대휴')) continue;

    total++;
    const segRoutes = data.m.split(',');

    for (let si = 0; si < data.g.length && si < segRoutes.length; si++) {
      const seg = data.g[si];
      const mRoute = segRoutes[si];
      const actualDur = t2m(seg.a) - t2m(seg.d);
      const { time: expectedRun, missing } = calcRouteTime(mRoute);

      if (missing) {
        // 알 수 없는 역간 조합
        continue;
      }

      // 대기/교대 시간 허용 (열차 수에 비례)
      // 열차 1개 = 대기 0~10분
      // 열차 2개 = 대기 5~20분
      // 열차 3개+ = 대기 10~40분
      const trainCount = seg.n.length;
      const maxWait = Math.max(10, trainCount * 12);
      const minWait = 0;

      const minExpected = expectedRun + minWait;
      const maxExpected = expectedRun + maxWait;

      // 실제 소요시간이 예상 범위를 크게 벗어나면 문제
      const diff = actualDur - expectedRun;

      // 너무 짧으면: 경로가 더 짧을 수 있음 (중간역 하차)
      // 너무 길면: 경로가 더 길 수 있음 (추가 경유)

      const isProtected = (PROTECTED[prefix] || []).includes(diaNum);

      if (diff < -10 || diff > maxWait + 15) {
        issues.push({
          prefix, diaNum, segIdx: si,
          mRoute, actualDur, expectedRun, diff,
          trains: seg.n,
          trainDesc: seg.n.map(t => {
            const c = classify(t);
            return `${t}(${c.line}${c.up?'↑':'↓'})`;
          }).join(' '),
          isProtected,
          dep: seg.d, arr: seg.a,
        });
      }
    }
  }
}

console.log(`검사: ${total}건\n`);

// 보호 다이아 먼저
const protIssues = issues.filter(i => i.isProtected);
if (protIssues.length > 0) {
  console.log('=== 보호 다이아 (정답과 소요시간 비교) ===');
  for (const i of protIssues) {
    console.log(`  ${i.prefix}/${i.diaNum} seg${i.segIdx+1}: "${i.mRoute}" 예상${i.expectedRun}분 실제${i.actualDur}분 차${i.diff}분`);
    console.log(`    ${i.dep}→${i.arr} ${i.trainDesc}`);
  }
  console.log('');
}

// p_ord 이슈
const ordIssues = issues.filter(i => !i.isProtected && i.prefix === 'p_ord');
console.log(`=== p_ord 소요시간 불일치 (${ordIssues.length}건) ===\n`);

// 너무 짧은 것 (경로가 실제보다 긴 것 → 중간역 하차 가능)
const tooShort = ordIssues.filter(i => i.diff < -10);
const tooLong = ordIssues.filter(i => i.diff > 0);

if (tooShort.length > 0) {
  console.log(`--- 실제 소요시간이 예상보다 짧음 (${tooShort.length}건) → 중간역 하차 가능 ---`);
  for (const i of tooShort) {
    console.log(`  다이아${i.diaNum} seg${i.segIdx+1}: "${i.mRoute}" 예상${i.expectedRun}분 실제${i.actualDur}분 (${i.diff}분 짧음)`);
    console.log(`    ${i.dep}→${i.arr} ${i.trainDesc}`);
  }
  console.log('');
}

if (tooLong.length > 0) {
  console.log(`--- 실제 소요시간이 예상보다 김 (${tooLong.length}건) → 추가 경유 가능 ---`);
  for (const i of tooLong) {
    console.log(`  다이아${i.diaNum} seg${i.segIdx+1}: "${i.mRoute}" 예상${i.expectedRun}분 실제${i.actualDur}분 (+${i.diff}분)`);
    console.log(`    ${i.dep}→${i.arr} ${i.trainDesc}`);
  }
  console.log('');
}

// 다른 시트 요약
for (const prefix of ['p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol']) {
  const items = issues.filter(i => !i.isProtected && i.prefix === prefix);
  if (items.length > 0) {
    const short = items.filter(i => i.diff < -10);
    const long = items.filter(i => i.diff > 0);
    console.log(`--- ${prefix}: 짧음 ${short.length}건 / 김 ${long.length}건 ---`);
    for (const i of items) {
      const tag = i.diff < 0 ? '짧음' : '김';
      console.log(`  ${i.diaNum} seg${i.segIdx+1}: "${i.mRoute}" 예상${i.expectedRun}분 실제${i.actualDur}분 (${i.diff > 0 ? '+' : ''}${i.diff}분 ${tag})`);
    }
    console.log('');
  }
}
