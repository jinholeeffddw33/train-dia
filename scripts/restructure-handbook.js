#!/usr/bin/env node
/**
 * handbook.json 재구조화 스크립트
 *
 * 변경 사항:
 * 1. newcomer1-1, newcomer1-2 → ch1 (기본업무)에 추가
 * 2. newcomer2-1 (기동요령) → ch1 (기본업무)에 추가
 * 3. newcomer1-3~14 → 새 ch5e "출고 시 고장조치"
 * 4. newcomer2-2~45 → ch5b에 통합 (더 상세한 버전으로 교체 + 고유 섹션 추가)
 * 5. newcomer3 → 새 ch5d "우진 중고장 코드"
 * 6. newcomer1, newcomer2, newcomer3 챕터 삭제
 */

const fs = require('fs');
const path = require('path');

const HANDBOOK_PATH = path.join(__dirname, '..', 'public', 'data', 'edu', 'handbook.json');
const QUIZ_PATH = path.join(__dirname, '..', 'public', 'data', 'edu', 'handbook-quiz.json');

// ── 1. Load ──
const handbook = JSON.parse(fs.readFileSync(HANDBOOK_PATH, 'utf8'));
const quiz = JSON.parse(fs.readFileSync(QUIZ_PATH, 'utf8'));

const getChapter = (id) => handbook.chapters.find(c => c.id === id);
const newcomer1 = getChapter('newcomer1');
const newcomer2 = getChapter('newcomer2');
const newcomer3 = getChapter('newcomer3');
const ch1 = getChapter('ch1');
const ch5b = getChapter('ch5b');

if (!newcomer1 || !newcomer2 || !newcomer3 || !ch1 || !ch5b) {
  console.error('필수 챕터를 찾을 수 없습니다');
  process.exit(1);
}

// ── 2. ch1에 기본업무 섹션 추가 ──
const newCh1Sections = [
  { ...newcomer1.sections[0], id: 'ch1-7' },  // 출고준비 및 기본 조치사항
  { ...newcomer1.sections[1], id: 'ch1-8' },  // 차량고장 발생 시 기본적인 조치사항
  { ...newcomer2.sections[0], id: 'ch1-9' },  // 기동요령 및 운전준비
];
ch1.sections.push(...newCh1Sections);
console.log(`✓ ch1에 ${newCh1Sections.length}개 섹션 추가 (→ 총 ${ch1.sections.length}개)`);

// ── 3. ch5e 생성: 출고 시 고장조치 (newcomer1-3~14) ──
const ch5e = {
  id: 'ch5e',
  title: '출고 시 고장조치',
  icon: '🚀',
  sections: newcomer1.sections.slice(2).map((s, i) => ({
    ...s,
    id: `ch5e-${i + 1}`,
  })),
};
console.log(`✓ ch5e 생성: ${ch5e.sections.length}개 섹션`);

// ── 4. ch5b 통합: newcomer2의 더 상세한 버전으로 교체 ──
// 제목 정규화 함수
const normalize = (t) => t.trim().replace(/\s+/g, ' ').toLowerCase()
  .replace('vzr', 'zvr')
  .replace(/\(1개 또는 1량\)/, '1개 또는 1량')
  .replace('열차종합제어장치(tcms) ', '')
  .replace(' 발생 시', ' 시')
  .replace('발생 시', '시')
  .replace('이 열리지 않을 시', ' 열림 불능')
  .replace('이 닫히지 않을 시', ' 닫힘 불능');

// ch5b 제목 → 인덱스 매핑
const ch5bByTitle = new Map();
for (let i = 0; i < ch5b.sections.length; i++) {
  ch5bByTitle.set(normalize(ch5b.sections[i].title), i);
}

// newcomer2에서 ch5b와 매칭되는 것 찾기 (newcomer2-1은 이미 ch1로 이동)
const n2ForCh5b = newcomer2.sections.slice(1); // newcomer2-1 제외
const mergedSections = [...ch5b.sections]; // ch5b 기존 섹션 복사
const replacedIndices = new Set();
const addedSections = [];

for (const n2sec of n2ForCh5b) {
  const normTitle = normalize(n2sec.title);

  // 정확 매칭 시도
  let matchIdx = ch5bByTitle.get(normTitle);

  // 유사 매칭 시도
  if (matchIdx === undefined) {
    for (const [ch5bTitle, idx] of ch5bByTitle.entries()) {
      if (ch5bTitle.includes(normTitle) || normTitle.includes(ch5bTitle) ||
          (normTitle.length > 10 && ch5bTitle.length > 10 &&
           normTitle.substring(0, 8) === ch5bTitle.substring(0, 8))) {
        matchIdx = idx;
        break;
      }
    }
  }

  if (matchIdx !== undefined && !replacedIndices.has(matchIdx)) {
    // 매칭됨: newcomer2 콘텐츠가 더 상세하면 교체
    const ch5bSec = mergedSections[matchIdx];
    if (n2sec.content.length >= ch5bSec.content.length) {
      mergedSections[matchIdx] = {
        ...ch5bSec,
        title: n2sec.title, // newcomer2 제목이 더 서술적
        summary: n2sec.summary || ch5bSec.summary,
        keywords: [...new Set([...(ch5bSec.keywords || []), ...(n2sec.keywords || [])])],
        content: n2sec.content, // 더 상세한 콘텐츠
      };
      replacedIndices.add(matchIdx);
    }
  } else {
    // 매칭 안됨: 고유 섹션 → ch5b에 추가
    addedSections.push(n2sec);
  }
}

// 고유 섹션에 새 ID 부여하고 추가
let nextCh5bId = ch5b.sections.length + 1;
for (const sec of addedSections) {
  mergedSections.push({
    ...sec,
    id: `ch5b-${nextCh5bId}`,
  });
  nextCh5bId++;
}

ch5b.sections = mergedSections;
console.log(`✓ ch5b 통합: ${replacedIndices.size}개 교체, ${addedSections.length}개 추가 (→ 총 ${ch5b.sections.length}개)`);

// ── 5. ch5d 생성: 우진 중고장 코드 (newcomer3) ──
const ch5d = {
  id: 'ch5d',
  title: '우진 중고장 코드',
  icon: '🛡️',
  sections: newcomer3.sections.map((s, i) => ({
    ...s,
    id: `ch5d-${i + 1}`,
  })),
};
console.log(`✓ ch5d 생성: ${ch5d.sections.length}개 섹션`);

// ── 6. newcomer 챕터 제거 + 새 챕터 삽입 ──
handbook.chapters = handbook.chapters.filter(c =>
  !c.id.startsWith('newcomer')
);

// ch5d, ch5e를 ch5c 뒤에 삽입
const ch5cIdx = handbook.chapters.findIndex(c => c.id === 'ch5c');
if (ch5cIdx !== -1) {
  handbook.chapters.splice(ch5cIdx + 1, 0, ch5d, ch5e);
} else {
  handbook.chapters.push(ch5d, ch5e);
}

console.log(`✓ newcomer 챕터 제거, ch5d/ch5e 삽입 (총 ${handbook.chapters.length}개 챕터)`);

// ── 7. 퀴즈 데이터 챕터 참조 업데이트 ──
const quizChapterMap = {
  'newcomer1': 'ch5e',  // basic_fix 영역 → 출고 시 고장조치
  'newcomer3': 'ch5d',  // critical 영역 → 우진 중고장 코드
};

let quizUpdated = 0;
for (const q of quiz.questions) {
  if (quizChapterMap[q.chapter]) {
    q.chapter = quizChapterMap[q.chapter];
    quizUpdated++;
  }
}

// areas에서 newcomer 관련 chapters 참조 업데이트
for (const area of (quiz.areas || [])) {
  area.chapters = area.chapters.map(ch => quizChapterMap[ch] || ch);
}

console.log(`✓ 퀴즈 ${quizUpdated}개 문제 챕터 참조 업데이트`);

// ── 8. 저장 ──
fs.writeFileSync(HANDBOOK_PATH, JSON.stringify(handbook, null, 2), 'utf8');
fs.writeFileSync(QUIZ_PATH, JSON.stringify(quiz, null, 2), 'utf8');

console.log('\n=== 최종 구조 ===');
for (const ch of handbook.chapters) {
  console.log(`  ${ch.id}: ${ch.title} (${ch.sections.length}개 섹션)`);
}
console.log('\n✅ 재구조화 완료!');
