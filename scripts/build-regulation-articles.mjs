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
 *   · 줄 끝에서 잘린 어절   "각 관 / 계자는" → "각 관계자는" (말뭉치 사전으로 판정)
 *
 * 띄어쓰기 자체는 여기서 손대지 않는다. 규정 5종은 PDF 텍스트 층에 공백 문자가 없어
 * scripts/respace_regulations.py 가 글자 좌표로 복원한 뒤 -search.json 에 반영해 둔다.
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

/** 표 구간의 시작·끝 표시. 지우지 않고 감싸기만 한다 — 쓰는 쪽마다 처리가 달라서다.
 *  낭독: 통째로 건너뛰고 "표가 있습니다" 한 마디로 대체 (셀이 순서 없이 흩어져 귀로는 못 따라간다)
 *  레일봇: 마커만 벗기고 내용은 그대로 (제한속도 같은 수치는 답변에 필요하다) */
export const TABLE_OPEN = '【표】';
export const TABLE_CLOSE = '【/표】';

/**
 * PDF 에서 표는 셀이 줄 단위로 흩어져 나온다.
 *   "열\n차\n번\n호\n착\n발..."  또는  "기울기(‰)\n제한속도(㎞/h)\n비\n고\n90\n80\n75"
 * 짧은 줄이 연달아 나오면 표로 본다. 목록 표시(1. 가. ①)로 시작하는 줄은 본문이므로 제외.
 */
const LIST_HEAD = /^\s*(?:\d+[.)]|[가-힣][.)]|[①-⑳]|[-·•])/;
/* 상한 14자 — 이 규정들의 본문 줄은 30~36자로 감기고, 표 셀은 '비'(1자)부터
   '1,000분의10 이하'(12자)까지 흩어진다. 실측 분포에서 15자 위로는 본문이 대부분이다. */
const CELL_MAX = 14;
/**
 * 길이만으로는 못 가른다. 일부 PDF(차량기지내규 등)는 본문까지 단어 단위로 쪼개 놓는다:
 *   "또는 / 지도통신식 / 또는 / 지령식을 / 시행하여야"  ← 전부 짧지만 표가 아니다.
 * 표 셀은 명사·수치·단위다. 어미(하여야·한다)나 목적격 조사(을·를)로 끝나면 잘린 본문이다.
 * '비 고' 같은 진짜 셀은 걸리지 않도록 어미 목록을 좁게 잡았다.
 */
const PROSE_END = /(?:하여야|하여|한다|하며|해야|되어|된다|되며|을|를|에게|에서|으로|부터|까지|의한|각)$/;
/* 마지막 그물 — 구간을 다 모은 뒤 서술어가 남아 있으면 표가 아니라 본문이다.
   낭독에서 표는 통째로 건너뛰므로, 본문을 표로 오인하면 들어야 할 규정이 소리 없이 사라진다.
   반대(표를 놓쳐 읽어 버림)는 어색할 뿐이라 정밀도 쪽으로 치우쳐 잡는다. */
const REGION_PROSE = /하여야|하여서는|한다|있다|없다|경우에는|따른다/;

function isCellLine(ln) {
  const t = ln.trim();
  if (!t || t.length > CELL_MAX) return false;
  if (LIST_HEAD.test(t)) return false;
  if (/[.。]$/.test(t)) return false;       // 문장 끝이면 본문
  if (PROSE_END.test(t)) return false;
  return true;
}

function markTableRegions(text) {
  const lines = text.split('\n');
  const out = [];
  let run = [];
  const flush = () => {
    const joined = run.map((l) => l.trim()).join(' ');
    if (run.length >= 5 && !REGION_PROSE.test(joined)) out.push(TABLE_OPEN + joined + TABLE_CLOSE);
    else out.push(...run);
    run = [];
  };
  for (const ln of lines) {
    if (isCellLine(ln)) run.push(ln);
    else { flush(); out.push(ln); }
  }
  flush();
  return out.join('\n');
}

/**
 * 줄 끝에서 잘린 어절을 다시 붙인다.
 *
 * PDF 는 어절 한가운데서도 줄을 바꾼다 — "…각 관 / 계자는", "…운 / 전하는".
 * 줄을 이을 때 공백을 넣으면 단어 안에 쉼이 생겨 낭독은 "관, 계자는" 으로 들리고
 * 검색·레일봇은 "관계자" 를 못 찾는다. 그렇다고 늘 붙이면 "열차 / 및" 이 "열차및" 이 된다.
 *
 * 어느 쪽인지는 말뭉치가 안다. 규정 9종 전체에서 어절 사전을 만들어 두고,
 * 붙인 형태가 사전에 있으면 붙이고 아니면 띄운다. 실측 판정:
 *     붙여야 1,541 · 띄워야 9,826 · 판단보류 4,304(띄움으로 처리)
 * 판단보류를 띄움으로 두는 건 안전한 쪽이다 — 원문이 그렇게 보이기 때문이다.
 */
function buildVocab(allPages) {
  const vocab = new Map();
  for (const pages of allPages)
    for (const p of pages)
      for (const line of p.text.split('\n'))
        for (const w of line.trim().split(/\s+/))
          if (w.length > 1) vocab.set(w, (vocab.get(w) ?? 0) + 1);
  return vocab;
}

function rejoinWrappedWords(text, vocab) {
  const lines = text.split('\n');
  const out = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const prev = out[out.length - 1];
    const cur = lines[i];
    // 표 구간은 셀이 줄로 흩어진 것이라 어절이 아니다 — 건드리지 않는다
    if (!prev?.trim() || !cur.trim() || prev.includes(TABLE_OPEN) || cur.includes(TABLE_OPEN)) {
      out.push(cur);
      continue;
    }
    const tail = prev.trimEnd().split(/\s+/).pop();
    const head = cur.trim().split(/\s+/)[0];
    const merged = (vocab.get(tail + head) ?? 0);
    if (merged > 0 && merged >= Math.min(vocab.get(tail) ?? 0, vocab.get(head) ?? 0)) {
      out[out.length - 1] = prev.trimEnd() + cur.trim();   // 붙인다 (줄바꿈도 없앤다)
    } else {
      out.push(cur);
    }
  }
  return out.join('\n');
}

function clean(text, vocab) {
  let t = text;
  t = t.replace(/^\s*-\s*\d+\s*-\s*$/gm, '');            // 페이지 번호 줄
  t = t.replace(/<개정[^>]*>/g, '');                      // 개정 표시
  t = t.replace(/<신설[^>]*>/g, '');
  t = t.replace(/^\s*[()]\s*$/gm, '');                    // 괄호만 있는 줄
  t = markTableRegions(t);
  if (vocab) t = rejoinWrappedWords(t, vocab);
  t = t.replace(/[ \t]+/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

/** 페이지 전체를 이어붙이되 각 글자가 몇 페이지인지 기억해 둔다 (조문 → 페이지 역추적용) */
function joinPages(pages, vocab) {
  let text = '';
  const pageAt = [];   // 글자 인덱스 → 페이지 번호
  for (const p of pages) {
    const c = clean(p.text, vocab);
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

function buildOne(file, vocab) {
  const id = path.basename(file, '-search.json');
  const pages = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  const { text, pageAt } = joinPages(pages, vocab);

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
    /* 조문 경계가 표 구간 한가운데를 지날 수 있다(표 안에 "제1조(목적)"이 들어간 경우).
       그러면 짝 없는 마커가 남아 낭독·레일봇 양쪽에 그대로 새어 나간다. 짝을 맞춘다.
        · 앞쪽에 닫기만 있으면 → 앞 조문의 표 꼬리다. 거기까지 잘라 버린다.
        · 뒤쪽에 열기만 있으면 → 표가 다음 조문으로 이어진다. 끝에서 닫아 준다. */
    const firstClose = body.indexOf(TABLE_CLOSE);
    const firstOpen = body.indexOf(TABLE_OPEN);
    if (firstClose !== -1 && (firstOpen === -1 || firstClose < firstOpen)) {
      // 마커만 지운다. 앞에 있는 건 조문 머리("제1조(목적)")라 잘라내면 안 된다.
      body = (body.slice(0, firstClose) + body.slice(firstClose + TABLE_CLOSE.length)).trim();
    }
    if (body.lastIndexOf(TABLE_OPEN) > body.lastIndexOf(TABLE_CLOSE)) body += TABLE_CLOSE;

    const ch = lastBefore(text, CHAPTER_RE, s.idx);
    const sec = lastBefore(text, SECTION_RE, s.idx);
    /* 표가 차지하는 비율. 낭독 쪽 판단 근거다 — 표 사이에 낀 본문 조각("신호현시를",
       "시환호만할수있다.")은 따로 읽으면 말이 안 된다. 비중이 높으면 조문째로
       "표로 되어 있습니다" 안내만 하고 넘어가는 편이 낫다. */
    let marked = 0;
    for (const m of body.matchAll(/【표】[\s\S]*?【\/표】/g)) marked += m[0].length;
    return {
      n: s.n,
      title: s.title,
      hasTable: marked > 0,
      tableShare: body.length ? Math.round((marked / body.length) * 100) : 0,
      page: pageAt[s.idx] ?? 1,
      chapter: ch ? `제${ch.num}장 ${ch.title}` : '',
      section: sec ? `제${sec.num}절 ${sec.title}` : '',
      text: body,
    };
  })
    .filter((a) => a.text.length >= 20)     // 목차 줄 같은 껍데기 제외
    /* 삭제된 조문("제48조(삭제 ’17.12.21.)")은 번호만 남은 자리다. 낭독하면
       "제48조. 삭제 17.12.21." 만 나오고 레일봇 근거로도 못 쓴다.
       길이로 거르면 띄어쓰기 유무에 따라 됐다 안 됐다 한다 — 이유로 거른다. */
    .filter((a) => !/^\s*삭\s*제/.test(a.title));

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
/* 어절 사전은 9종 전체에서 한 번만 만든다. 한 문서에서 줄 끝에 잘린 말이
   다른 문서(또는 같은 문서 다른 자리)에서는 온전히 나오는 것을 근거로 삼는다. */
const VOCAB = buildVocab(files.map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))));
const indexChunks = [];
let totalA = 0, totalRaw = 0, totalOut = 0;
console.log(`${DRY ? '=== DRY-RUN ===' : '=== BUILD ==='}\n`);
console.log('규정'.padEnd(26) + '조문'.padStart(6) + '원문'.padStart(10) + '정제후'.padStart(10) + '  범위');
console.log('─'.repeat(74));

for (const f of files) {
  const { id, articles, rawChars } = buildOne(f, VOCAB);
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
