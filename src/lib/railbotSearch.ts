/**
 * 레일봇 검색 규칙 — 질문에서 «찾을 뜻» 을 뽑고, 자료에 점수를 매긴다.
 *
 * 왜 따로 떼었나: Next.js 의 API route 파일(route.ts)은 GET·POST 같은 정해진 이름만
 * 내보낼 수 있다. 시험을 위해 search 를 route.ts 에서 내보냈더니 실제 빌드(next build)가
 * 「route 가 허용되지 않은 이름을 내보낸다」 로 실패했고, 그 뒤 배포 세 번이 모두 막혔다.
 * (tsc 는 이것을 잡지 못한다) 검색 규칙은 순수 함수라 여기 두고 route 는 가져다 쓴다.
 */

export type Kind = 'reg' | 'book' | 'case' | 'video' | 'broadcast';


export interface Chunk {
  kind: Kind;
  id: string;
  title: string;
  source: string;
  text: string;
  regId?: string;
  article?: number;
  chapter?: string;
  chapterId?: string;
  sectionId?: string;
  /** 영상 — 눌러서 열 주소 */
  url?: string;
  /** 안내방송 — 들려줄 음성 파일 id */
  audioId?: string;
}

/** 공백 제거 — 원문 띄어쓰기가 PDF 추출로 뭉개져 있어 단어 매칭이 성립하지 않는다 */
export const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/**
 * 동의어 사전 — LLM 없이 검색 품질을 올리는 유일한 지렛대.
 * 기관사가 쓰는 구어/약어를 규정 원문 용어와 이어준다. 자유롭게 확장 가능.
 * 한 그룹 안의 단어 중 하나라도 질문에 있으면, 나머지를 검색어에 함께 넣는다.
 */
const SYNONYMS: string[][] = [
  ['판토', '팬터', '팬터그래프', 'pantograph'],
  ['psd', '스크린도어', '승강장안전문', '승강장 안전문'],
  ['구원', '구원운전', '구원연결', '구원차'],
  ['제동', '브레이크', '제동장치', '주차제동'],
  ['mcb', '주차단기'],
  ['hscb', '고속도차단기'],
  ['냉방', '에어컨', '공조', '송풍'],
  ['무전', '무전기', '열차무선', '무선'],
  ['비상', '비상시', '긴급', '비상제동'],
  // 출고와 입고는 «반대» 다 — 한 묶음으로 두었더니 출고를 물으면 입고 조문이 따라왔다
  ['입환', '기지', '차량기지'],
  ['역행', '역행불능', '무동력', '출력'],
  ['전차선', '가선', '급전', '단전'],
  ['확인운전', '확인 운전', '주의운전'],
  ['탈선', '차량고장', '고장조치'],
  ['방송', '안내방송', '차내방송'],
  // 말끝이 바뀌는 것들 — 「안 열려요」 로 물어도 규정의 「열리지 않을」 과 이어져야 한다
  ['열려', '열림', '열리', '개방'],
  ['닫혀', '닫힘', '닫히', '폐문'],
  ['안됨', '안돼', '불능', '불량', '고장'],
  ['멈춤', '정지', '정차'],
  ['올림', '올려', '상승'],
  ['내림', '내려', '하강'],
];

/**
 * 조사·어미 — 질문 끝에 붙어 검색을 망치는 꼬리.
 *
 * 왜 떼야 하는가: 예전에는 질문 전체를 공백 없이 이어 붙인 뒤 2~7글자 조각을 모두
 * 뽑았다. 그러면 «주박할 때 무엇을 확인하나요» 에서 「을확인하」 같은 조각이 생기고,
 * 그 조각은 규정 어디에나 있어 엉뚱한 조문이 1등이 됐다(제40조 도중점검).
 */
const TAIL_RE = /(합니다|하나요|되나요|인가요|입니까|하는지|해야|해요|하고|하는|한다|하나|되는|된다|까요|나요|이나|에서|으로|처럼|보다|부터|까지|이라|라고|은|는|이|가|을|를|에|로|와|과|의|도|만|한|할|해|된|나|요)$/;

/**
 * 낱말 끝의 이음말 — 「점검시」·「주박할때」·「운행중」 의 끝 글자.
 * 구를 이어 붙일 때만 뗀다. 두 글자 미만이 남으면 떼지 않는다(운전 → 운 을 막는다).
 */
const CONNECT_RE = /(시|때|중|간|내|외)$/;

function trimConnective(word: string): string {
  const m = CONNECT_RE.exec(word);
  return m && word.length - m[0].length >= 2 ? word.slice(0, m.index) : word;
}

function stripTail(token: string): string {
  let t = token;
  for (let i = 0; i < 3; i++) {
    if (t.length <= 2) break;
    const m = TAIL_RE.exec(t);
    if (!m || t.length - m[0].length < 2) break;
    t = t.slice(0, m.index);
  }
  return t;
}

/**
 * 질문을 «뜻 덩어리(concept)» 로 나눈다. 각 덩어리는 그 뜻을 찾을 여러 말을 가진다.
 *
 * 띄어쓰기에 흔들리지 않아야 한다 — 「주박할 때」 와 「주박할때」 와 「주박 할 때」 가
 * 같은 답을 내야 한다. 그래서 덩어리마다
 *   · 조사·어미를 뗀 낱말과 그 앞토막(주박할때 → 주박할 → 주박)
 *   · 낱말 안쪽 조각 (합성어가 붙어 있는 원문과 걸리게)
 * 를 모두 넣고, 이웃한 낱말을 «이어 붙인 구» 는 따로 한 덩어리로 둔다.
 */
interface Concept {
  /** 사람이 쓴 원래 낱말 — 화면 설명용 */
  word: string;
  /** 이 뜻을 찾을 말들 (하나라도 걸리면 이 덩어리는 «덮였다») */
  terms: string[];
  /** 이어 붙인 구인가 — 구가 걸리면 훨씬 값지다 */
  phrase: boolean;
  /** 몇 번째 낱말에서 시작하는가 — 한국어는 앞에 오는 말이 주제다 */
  at: number;
}

function conceptsOf(question: string): Concept[] {
  const toks = question.split(/[^0-9A-Za-z가-힣]+/).filter(Boolean);
  const words = toks.map((t) => stripTail(t.toLowerCase())).filter((t) => t.length >= 2);

  const out: Concept[] = [];
  for (const w of words) {
    const terms = new Set<string>([w]);
    // 앞토막 — 띄어쓰기를 안 한 말에서 뒤에 붙은 군더더기를 떼어 준다
    for (let len = w.length - 1; len >= 2; len--) terms.add(w.slice(0, len));
    // 안쪽 조각 — 원문이 「출입문차측표시등」 처럼 붙어 있어도 걸리게.
    // 다섯 글자부터만 쪼갠다. 네 글자를 쪼개면 「주의사항」 에서 「의사항」 같은
    // 반토막이 나와 엉뚱한 조문에 걸린다.
    if (w.length >= 5) {
      for (let len = w.length - 1; len >= 3; len--) {
        for (let i = 1; i + len <= w.length; i++) terms.add(w.slice(i, i + len));
      }
    }
    // 동의어·말끝 변화 — «낱말이 그 말을 품고 있을 때» 만 퍼뜨린다.
    // 반대로 하면 「확인」 이 「확인운전」 을 끌어와 주박 질문에 확인운전 조문이 나온다.
    const sw = squash(w);
    for (const group of SYNONYMS) {
      if (group.some((t) => sw.includes(squash(t)))) {
        group.forEach((t) => terms.add(squash(t)));
      }
    }
    out.push({ word: w, terms: [...terms].filter((t) => t.length >= 2), phrase: false, at: out.length });
  }

  // 이어 붙인 구 — 두 낱말부터 네 낱말까지. 띄어쓰기를 어떻게 하든 같은 구가 나온다.
  //
  // 낱말 끝의 «시·때·중» 같은 이음말은 떼고도 한 벌 더 만든다.
  // 「출고 점검시 주의 사항」 은 그냥 이으면 «출고점검시» 가 되어, 원문의 «출고점검» 과
  // 걸리지 않는다. 그래서 「출고점검 주의사항」 과 답이 달라졌다.
  // 잘못 뗀 구(자동운전 → 자동운)는 어디에도 없어 점수가 0이라 해롭지 않다.
  const cores = words.map(trimConnective);
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < Math.min(i + 4, words.length); j++) {
      const label = words.slice(i, j + 1).join(' ');
      const spans = new Set([
        words.slice(i, j + 1).join(''),
        cores.slice(i, j + 1).join(''),
        // 마지막 낱말만 그대로 둔 벌 — 「출고점검 주의사항」 처럼 뒤가 온전한 경우
        [...cores.slice(i, j), words[j]].join(''),
      ]);
      out.push({ word: label, terms: [...spans], phrase: true, at: i });
    }
  }
  return out;
}

export const VEHICLES = {
  abb: { label: 'ABB', chapterId: 'ch5a', hints: ['abb', '에이비비'] },
  woojin: { label: '우진', chapterId: 'ch5b', hints: ['우진'] },
  rotem: { label: '로템', chapterId: 'ch5c', hints: ['로템', '현대로템'] },
} as const;
export type VehicleId = keyof typeof VEHICLES;

/** 자료의 15%가 넘게 가지고 있는 말은 «아무 데나 있는 말» 이라 뜻이 없다 */
const COMMON_RATIO = 0.15;

/**
 * BM25 — 검색에서 오래 쓰인 점수식.
 *  k1: 같은 말이 여러 번 나와도 점수가 무한정 오르지 않게 누른다(포화).
 *  b : 긴 글이 우연히 많이 걸려 이기지 않게 길이로 나눈다.
 * 둘 다 없던 것이 «엉뚱한 긴 조문이 1등» 의 원인이었다.
 */
const BM25_K1 = 1.2;
const BM25_B = 0.75;

/** 이어 붙인 구가 통째로 걸렸을 때의 가산 — 「판타그라프 상승불량」 을 그대로 가진 쪽 */
const PHRASE_BOOST = 3;

/**
 * 질문의 뜻을 하나도 못 덮어도 이만큼은 쳐준다.
 * 낮출수록 «여러 낱말을 두루 덮은 자료» 가 «한 낱말만 걸린 자료» 를 크게 앞선다.
 */
const COVER_FLOOR = 0.25;

/** 앞에 오는 낱말을 얼마나 더 쳐줄 것인가 — 첫 낱말이 마지막보다 1.5배 */
const POS_BOOST = 0.5;

/**
 * 이만큼도 안 걸리면 답하지 않는다.
 *
 * 「오늘 점심 뭐 먹지」(7점) · 「날씨 좋다」(8점) 는 막히고,
 * 「주박할 때 확인」(21점) 처럼 두 글자 전문어 하나로 묻는 질문은 통과한다.
 */
export const MIN_SCORE = 15;

export interface Hit {
  c: Chunk;
  score: number;
  /** 이 자료가 질문의 어떤 말 때문에 뽑혔는가 — 화면에서 색칠할 말 */
  terms: string[];
}

/**
 * 근거 검색.
 *
 * 점수 = Σ (말 길이² × 희소도) — 긴 말일수록, 드문 말일수록 값지다.
 * 제목에 있는 말은 두 배 반으로 친다. 제목이 곧 그 조문이 무엇에 대한 것인지이기 때문이다.
 */
export function search(chunks: Chunk[], question: string, vehicle: VehicleId | null, limit = 8): Hit[] {
  const concepts = conceptsOf(question);
  const artNum = /제\s*(\d+)\s*조/.exec(question)?.[1];
  const N = chunks.length;

  const hay = chunks.map((c) => squash(c.text + c.title));
  const head = chunks.map((c) => squash(c.title + c.source));
  const avgLen = hay.reduce((s, h) => s + h.length, 0) / N || 1;

  // 말마다 «어디에 몇 번 나오는지» 를 한 번에 센다 (tf 와 df 를 함께)
  const allTerms = [...new Set(concepts.flatMap((c) => c.terms))];
  const tf = new Map<string, Int32Array>();
  const df = new Map<string, number>();
  for (const t of allTerms) {
    const counts = new Int32Array(N);
    let n = 0;
    for (let i = 0; i < N; i++) {
      let k = hay[i].indexOf(t);
      if (k < 0) continue;
      let c = 0;
      while (k >= 0) { c++; k = hay[i].indexOf(t, k + t.length); }
      counts[i] = c;
      n++;
    }
    if (n > 0) { tf.set(t, counts); df.set(t, n); }
  }
  // 자료의 15% 넘게 가진 말은 «아무 데나 있는 말» — 뜻이 없다
  const useful = (t: string) => {
    const n = df.get(t);
    return n !== undefined && n <= N * COMMON_RATIO;
  };

  // 낱말(구가 아닌 것) 개수 — 자리 가중과 «얼마나 덮었나» 에 쓴다
  const plainCount = concepts.filter((c) => !c.phrase).length;

  const scored: Hit[] = [];
  for (let i = 0; i < N; i++) {
    // 이 자료가 «질문의 어느 뜻을» 덮었는가 — 낱말 하나 걸린 것과 다 걸린 것은 다르다
    let covered = 0;
    let score = 0;
    const shown: string[] = [];
    for (const con of concepts) {
      // 한 덩어리 안에서는 «가장 값진 말 하나» 만 센다 — 같은 뜻을 여러 번 세지 않는다
      let best = 0;
      let bestTerm = '';
      for (const t of con.terms) {
        if (!useful(t)) continue;
        const f = tf.get(t)?.[i] ?? 0;
        if (f === 0) continue;
        const idf = Math.log(1 + (N - (df.get(t) as number) + 0.5) / ((df.get(t) as number) + 0.5));
        // BM25 — 여러 번 나와도 점수가 무한정 오르지 않고(k1), 긴 글은 눌린다(b)
        const norm = f * (BM25_K1 + 1) / (f + BM25_K1 * (1 - BM25_B + BM25_B * hay[i].length / avgLen));
        // 긴 말일수록, 제목에 있을수록 값지다
        const v = idf * norm * Math.min(t.length, 8) * (head[i].includes(t) ? 2.5 : 1);
        if (v > best) { best = v; bestTerm = t; }
      }
      if (best === 0) continue;
      if (!con.phrase) covered++;
      // 앞에 오는 말일수록 크게 — 「출고점검 주의사항」 에서 주제는 출고점검이다.
      // (이것이 없으면 아무 조문에나 있는 「주의사항」 이 주제어를 이긴다)
      const pos = 1 + POS_BOOST * (1 - con.at / Math.max(1, plainCount - 1));
      // 이어 붙인 구가 통째로 걸리면 «정확히 그것을 물은 것» — 크게 쳐준다
      score += (con.phrase ? best * PHRASE_BOOST : best) * pos;
      shown.push(bestTerm);
    }
    if (score === 0) continue;

    // 질문을 얼마나 덮었나 — 하나만 걸린 자료는 눌러 둔다
    if (plainCount > 0) score *= COVER_FLOOR + (1 - COVER_FLOOR) * (covered / plainCount);

    const c = chunks[i];
    if (artNum && c.article === Number(artNum)) score += 5000;
    // 차종이 정해졌으면 다른 차종 챕터는 강하게 감점 (엉뚱한 차종 조치 방지)
    if (vehicle) {
      const mineCh: string = VEHICLES[vehicle].chapterId;
      const others: string[] = (Object.keys(VEHICLES) as VehicleId[])
        .filter((v) => v !== vehicle)
        .map((v) => VEHICLES[v].chapterId);
      if (c.chapterId === mineCh) score *= 1.6;
      else if (c.chapterId && others.includes(c.chapterId)) score *= 0.15;
    }
    // 더 긴 말에 포함되는 조각은 화면에 안 보인다 — 같은 곳을 두 번 칠하지 않는다
    const maximal = shown.filter((t, k) => !shown.some((o, m) => m !== k && o !== t && o.includes(t)));
    scored.push({ c, score, terms: [...new Set(maximal)].sort((a, b) => b.length - a.length) });
  }

  // 같은 점수면 규정·교재가 먼저다 — 영상·방송은 «곁들이는 것» 이지 근거 자체가 아니다
  const rank: Record<Kind, number> = { reg: 0, book: 0, case: 1, broadcast: 2, video: 2 };
  return scored
    .sort((a, b) => b.score - a.score
      || rank[a.c.kind] - rank[b.c.kind]
      || b.terms.length - a.terms.length
      || a.c.text.length - b.c.text.length)   // 그래도 같으면 «좁게 말한 쪽» 이 낫다
    .slice(0, limit);
}

