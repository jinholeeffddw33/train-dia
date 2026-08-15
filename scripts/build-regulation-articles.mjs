#!/usr/bin/env node
/**
 * 규정 원문(페이지 단위) → 조문 단위 인덱스 생성.
 *
 *   입력  public/data/edu/regulations/{id}-search.json   [{ page, text }]
 *   출력  public/data/edu/regulations/{id}-articles.json [{ n, title, text, page, chapter, section }]
 *
 * 왜 필요한가
 *   지금 규정 데이터는 PDF 에서 뽑은 '페이지 덩어리'다. 한 페이지에 여러 조문이 섞여 있고
 *   표가 글자 단위로 세로 분해돼 있어(열/차/번/호…), 그대로는 검색 근거로도 낭독으로도 못 쓴다.
 *   조문 단위로 쪼개고 노이즈를 걷어내면 레일봇(RAG)·규정 뷰어·음성이 모두 이 산출물을 쓴다.
 *
 * 정제 규칙 — 원문을 고쳐 쓰지 않는다. 지우기만 한다.
 *   · 페이지 머리말/꼬리말  `- 9 -`
 *   · 개정 표시            `<개정2019.12.16.>`  (조문 본문 의미에 영향 없음)
 *   · 표 세로 분해 파편     한 줄에 1~2글자만 있는 줄이 연속으로 이어지는 구간
 *   · 빈 괄호 줄           `(`  `)`
 *   붙어 있는 띄어쓰기(`이규정은서울교통공사`)는 건드리지 않는다 — 임의 복원은 오히려 왜곡이다.
 *
 * 사용: node scripts/build-regulation-articles.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'public/data/edu/regulations';
const INDEX_OUT = 'public/data/edu/railbot-index.json';
const DRY = process.argv.includes('--dry-run');

/** 파일 id → 사람이 읽는 규정 이름 (근거 표기용) */
const REG_TITLES = {
  'operation-rules': '운전취급규정',
  'crew-management-rules': '승무원지도운용내규',
  'operating-staff-rules': '운전관계직원업무내규',
  'safety-record-rules': '운전무사고성적심사규정',
  'depot-operation-rules': '차량기지운전취급내규',
  'crew-business-rules': '전동차승무원업무예규',
  'detail-operation-rules': '운전취급세부요령',
  'hr-rules': '인사규정',
  'employment-rules': '취업규칙',
};

/**
 * 조문 시작 — 반드시 제목이 붙은 `제N조(제목)` 만 인정한다.
 * 제목 없는 `제N조` 는 거의 전부 본문 인용이다:
 *   "…규정 제10조에 의거…"  "…제16조제1항의 비품…"  "…규정 제248조제2항의…"
 * 이걸 조문 시작으로 잡으면 엉뚱한 지점에서 조문이 쪼개진다.
 */
const ARTICLE_RE = /제\s*(\d+)\s*조\s*\(([^)]{1,60})\)/g;
/* 장·절 제목은 PDF 추출 과정에 줄바꿈이 끼어 있다("제2장 운\n전"). 줄바꿈을 허용하되
   다음 조/절 표시 직전까지만 집는다 — RegulationViewer 의 목차 파서와 같은 방식. */
const CHAPTER_RE = /제\s*(\d+)\s*장\s*([\s\S]{1,24}?)(?=\s*제\s*\d+\s*[조절])/g;
const SECTION_RE = /제\s*(\d+)\s*절\s*([\s\S]{1,24}?)(?=\s*제\s*\d+\s*조)/g;

/* 조문 본문이 아니라 문서 꼬리(부칙·별표·별지서식)가 시작되는 지점.
   줄 맨 앞에 올 때만 구조 표시로 본다 — 마지막 조문이 문서 끝까지 삼키는 것을 막는다. */
const TAIL_RE = /\n\s*(?:부\s*칙|[[〔<]\s*별[표지]|별표\s*\d|별지제\d)/;

/** 표가 세로로 분해된 구간을 걷어낸다 — 1~2글자 줄이 4줄 이상 연속되면 표 파편으로 본다 */
function stripVerticalTableFragments(text) {
  const lines = text.split('\n');
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length >= 4) { /* 표 파편 — 버린다 */ }
    else out.push(...run);
    run = [];
  };
  for (const ln of lines) {
    const t = ln.trim();
    if (t.length > 0 && t.length <= 2) run.push(ln);
    else { flush(); out.push(ln); }
  }
  flush();
  return out.join('\n');
}

function clean(text) {
  let t = text;
  t = t.replace(/^\s*-\s*\d+\s*-\s*$/gm, '');            // 페이지 번호 줄
  t = t.replace(/<개정[^>]*>/g, '');                      // 개정 표시
  t = t.replace(/<신설[^>]*>/g, '');
  t = t.replace(/^\s*[()]\s*$/gm, '');                    // 괄호만 있는 줄
  t = stripVerticalTableFragments(t);
  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

/** 페이지 전체를 이어붙이되 각 글자가 몇 페이지인지 기억해 둔다 (조문 → 페이지 역추적용) */
function joinPages(pages) {
  let text = '';
  const pageAt = [];   // 글자 인덱스 → 페이지 번호
  for (const p of pages) {
    const c = clean(p.text);
    if (!c) continue;
    const start = text.length;
    text += c + '\n';
    for (let i = start; i < text.length; i++) pageAt.push(p.page);
  }
  return { text, pageAt };
}

/** 위치 이전에 마지막으로 등장한 장/절 제목 */
function lastBefore(text, re, idx) {
  let found = null;
  re.lastIndex = 0;
  for (const m of text.matchAll(re)) {
    if ((m.index ?? 0) > idx) break;
    found = { num: parseInt(m[1], 10), title: (m[2] || '').replace(/\s+/g, '').trim() };
  }
  return found;
}

function buildOne(file) {
  const id = path.basename(file, '-search.json');
  const pages = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  const { text, pageAt } = joinPages(pages);

  // 조문 시작 위치 수집
  const marks = [];
  ARTICLE_RE.lastIndex = 0;
  for (const m of text.matchAll(ARTICLE_RE)) {
    marks.push({ n: parseInt(m[1], 10), title: (m[2] || '').replace(/\s+/g, ' ').trim(), idx: m.index ?? 0 });
  }
  // 제목이 붙은 채로 인용되는 경우도 드물게 있다(부칙·별표). 번호별 첫 등장만 조문 시작으로.
  const seen = new Set();
  const starts = marks.filter((m) => {
    if (seen.has(m.n)) return false;
    seen.add(m.n);
    return true;
  });

  const articles = starts.map((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].idx : text.length;
    let body = text.slice(s.idx, end).trim();
    // 부칙·별표가 붙어 오면 거기서 자른다 (특히 마지막 조문)
    const tail = TAIL_RE.exec(body);
    if (tail && tail.index > 40) body = body.slice(0, tail.index).trim();
    const ch = lastBefore(text, CHAPTER_RE, s.idx);
    const sec = lastBefore(text, SECTION_RE, s.idx);
    return {
      n: s.n,
      title: s.title,
      page: pageAt[s.idx] ?? 1,
      chapter: ch ? `제${ch.num}장 ${ch.title}` : '',
      section: sec ? `제${sec.num}절 ${sec.title}` : '',
      text: body,
    };
  }).filter((a) => a.text.length >= 20);   // 목차 줄 같은 껍데기 제외

  return { id, articles, rawChars: pages.reduce((s, p) => s + p.text.length, 0) };
}

/* ── 레일봇 검색 인덱스 ──
   조문(892) + 교재 절(120)을 한 파일로 합친다. 서버가 요청마다 9개 파일을 따로 읽지
   않도록 하나로 모으고, 검색은 '공백 제거 부분문자열'로 한다 — 원문 띄어쓰기가
   PDF 추출 과정에 뭉개져 있어 단어 단위 매칭이 애초에 성립하지 않는다.
   질의에서도 공백을 지우면 오히려 정확히 걸린다. */
function buildBookChunks() {
  const hb = JSON.parse(fs.readFileSync('public/data/edu/handbook.json', 'utf8'));
  const chapters = hb.chapters ?? hb;
  const out = [];
  for (const ch of chapters) {
    for (const sec of ch.sections ?? []) {
      const parts = [];
      const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (node && typeof node === 'object') {
          if (node.type === 'searchText' && typeof node.content === 'string') parts.push(node.content);
          Object.values(node).forEach(walk);
        }
      };
      walk(sec.content ?? []);
      const text = parts.join('\n').trim();
      if (text.length < 30) continue;
      out.push({
        kind: 'book',
        id: `${ch.id}/${sec.id}`,
        chapterId: ch.id,
        sectionId: sec.id,
        title: sec.title,
        source: `${ch.title} › ${sec.title}`,
        text,
      });
    }
  }
  return out;
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('-search.json')).sort();
const indexChunks = [];
let totalA = 0, totalRaw = 0, totalOut = 0;
console.log(`${DRY ? '=== DRY-RUN ===' : '=== BUILD ==='}\n`);
console.log('규정'.padEnd(26) + '조문'.padStart(6) + '원문'.padStart(10) + '정제후'.padStart(10) + '  범위');
console.log('─'.repeat(74));

for (const f of files) {
  const { id, articles, rawChars } = buildOne(f);
  const outChars = articles.reduce((s, a) => s + a.text.length, 0);
  totalA += articles.length; totalRaw += rawChars; totalOut += outChars;
  const nums = articles.map((a) => a.n);
  const range = nums.length ? `제${Math.min(...nums)}조~제${Math.max(...nums)}조` : '-';
  console.log(
    id.padEnd(26) + String(articles.length).padStart(6) +
    (rawChars.toLocaleString() + '자').padStart(10) +
    (outChars.toLocaleString() + '자').padStart(10) + '  ' + range,
  );
  if (!DRY) {
    fs.writeFileSync(path.join(DIR, `${id}-articles.json`), JSON.stringify(articles, null, 1) + '\n', 'utf8');
  }
  for (const a of articles) {
    indexChunks.push({
      kind: 'reg',
      id: `${id}#${a.n}`,
      regId: id,
      article: a.n,
      title: a.title,
      source: `${REG_TITLES[id] ?? id} 제${a.n}조(${a.title})`,
      chapter: a.chapter,
      text: a.text,
    });
  }
}
console.log('─'.repeat(74));
console.log('합계'.padEnd(26) + String(totalA).padStart(6) +
  (totalRaw.toLocaleString() + '자').padStart(10) +
  (totalOut.toLocaleString() + '자').padStart(10) +
  `  (노이즈 ${(100 - totalOut / totalRaw * 100).toFixed(1)}% 제거)`);
// ── 레일봇 인덱스 (조문 + 교재 절) ──
const book = buildBookChunks();
indexChunks.push(...book);
const idxChars = indexChunks.reduce((s, c) => s + c.text.length, 0);
console.log(`\n레일봇 인덱스: 조문 ${totalA}개 + 교재 절 ${book.length}개 = ${indexChunks.length}청크 / ${idxChars.toLocaleString()}자`);
if (!DRY) {
  fs.writeFileSync(INDEX_OUT, JSON.stringify(indexChunks), 'utf8');
  console.log(`  → ${INDEX_OUT} (${(fs.statSync(INDEX_OUT).size / 1024).toFixed(0)} KB)`);
}

if (DRY) console.log('\n(dry-run) 파일 미생성');
