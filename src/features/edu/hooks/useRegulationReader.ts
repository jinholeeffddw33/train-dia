'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 규정 낭독 — 출퇴근길에 규정을 귀로 듣기 위한 재생기.
 *
 * 페이지 원문(-search.json)이 아니라 조문 인덱스(-articles.json)를 읽는다.
 * 원문은 PDF 에서 뽑은 그대로라 머리말·개정표시·표 파편이 섞여 있어 귀로는 못 듣는다.
 * 조문 인덱스는 그 노이즈를 걷어내고 표 구간에 【표】 마커를 붙여 둔 산출물이다.
 *
 * 이 훅이 감당하는 것 세 가지
 *  1) 표 — 셀이 순서 없이 흩어져 있어 읽으면 뜻이 안 통한다. 건너뛰고 한 마디로 알린다.
 *  2) 15초 한계 — 크롬은 긴 utterance 를 도중에 끊는다. 문장 단위로 쪼개서 이어 붙인다.
 *  3) 화면 꺼짐 — 주머니에 넣으면 화면이 잠기고 낭독도 멈춘다. Wake Lock 으로 붙잡는다.
 */

export interface ReaderArticle {
  n: number;
  title: string;
  text: string;
  hasTable?: boolean;
  tableShare?: number;
  chapter?: string;
}

/** 표 비중이 이 이상이면 조문째 건너뛴다.
 *  표 사이에 낀 본문 조각("신호현시를", "시환호만할수있다.")만 남아 읽으면 말이 안 된다. */
const TABLE_SKIP_SHARE = 50;
/** 한 번에 넘길 글자 수 상한. 크롬이 긴 발화를 15초쯤에서 끊어 버려 문장을 더 쪼갠다. */
const CHUNK_MAX = 120;

const TABLE_RE = /【표】[\s\S]*?【\/표】/g;

/** 낭독 한 조각. kind 로 안내 문구와 본문을 구분해 UI 가 다르게 보여 준다. */
export interface Chunk {
  text: string;
  kind: 'head' | 'body' | 'notice';
}

/**
 * 낭독용 다듬기. 화면 글자는 그대로 두고 소리로 나갈 문자열만 손본다.
 *
 * 규정 원문에는 눈으로 읽을 땐 문제없지만 소리로는 이상해지는 표기가 섞여 있다.
 * TTS 엔진이 기호를 제 나름대로 읽어 버려서 "기계음처럼" 들리는 원인이 대부분 여기다.
 */
function forSpeech(text: string): string {
  return text
    /* PDF 는 어절 한가운데서도 줄을 바꾼다("…운전함 / 에 있어", "…각 관 / 계자는").
       줄바꿈을 그냥 공백으로 바꾸면 단어 안에 쉼이 생겨 "운전함, 에" 처럼 들린다.
       실측하면 줄바꿈의 7%가 이런 경우이고, 전부 다음 줄이 조사·어미로 시작한다.
       어절은 조사로 시작하지 않으므로 이때만 공백 없이 붙인다.
       이·그·저 는 "이 규정은" 처럼 홀로 서는 말이라 뺐다. */
    .replace(/(\S)\n(?=(?:은|는|가|을|를|에|의|와|과|로|서|도|만|에서|에게|으로|부터|까지|하여|하고|한다|하는|되는|된다|하며|되어|이라|이나))/g, '$1')
    .replace(/[<〈]\s*삭제[^>〉]*[>〉]/g, '삭제.')             // 삭제된 항 — 삭제 사실은 남기고 날짜만 뺀다
    .replace(/[<〈][^>〉]{0,40}[>〉]/g, '')                    // 개정·신설 이력 — "꺾쇠 2017 점 12" 로 읽힌다
    .replace(/\[(?:제목개정|전문개정|본조신설)[^\]]*\]/g, '') // 조문 끝의 개정 이력 — 내용이 아니다
    .replace(/[“”"']/g, '')                                  // 따옴표를 "따옴표"라고 읽는 엔진이 있다
    .replace(/(\d+)\s*[.]\s*(\d+)\s*[.]\s*(\d+)\s*\./g, '$1년 $2월 $3일')
    .replace(/㎞\/h|km\/h/gi, '킬로미터')
    .replace(/㎞/g, '킬로미터').replace(/㎧/g, '초당 미터')
    .replace(/‰/g, '퍼밀').replace(/%/g, '퍼센트')
    .replace(/·/g, ', ')                                     // 가운뎃점 — 쉼표로 읽어야 끊긴다
    .replace(/[~∼]/g, '에서 ')
    .replace(/제(\d+)조\s*의\s*(\d+)/g, '제$1조의 $2')
    /* ①②③ 은 규정에서 '항' 번호다. 그대로 두면 엔진마다 "동그라미 일"·"일"·무음으로
       제각각 읽어 어디가 바뀌었는지 귀로 알 수 없다. 말로 풀어 준다. */
    .replace(/[①-⑳]/g, (m) => `제${m.charCodeAt(0) - 0x2460 + 1}항. `)
    /* "다음 각 호" 아래 붙는 "1." "2." 는 호 번호다. 그냥 두면 "일"·"이" 로 읽혀
       숫자인지 항목 번호인지 구분이 안 된다. 날짜는 위에서 이미 년월일로 바꿔 두었고
       두 자리까지만 잡아서 연도(2023.)에는 걸리지 않는다. */
    .replace(/(^|[\s.])(\d{1,2})\.\s/g, '$1제$2호. ')
    .replace(/：/g, ', ')                                     // 전각 콜론 — 그대로면 무음이거나 "콜론"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 낭독 단위로 쪼갠다.
 *
 * 두 가지를 동시에 지켜야 한다.
 *  · 크롬은 긴 발화를 15초쯤에서 잘라 먹는다 → 조각이 짧아야 한다.
 *  · 어절 한가운데서 자르면 "운전취" / "급규정" 처럼 끊겨 알아들을 수 없다
 *    → 문장부호 > 어절 순으로만 자른다. 글자 단위 분할은 하지 않는다.
 */
function splitSentences(text: string): string[] {
  const flat = forSpeech(text);
  if (!flat) return [];
  const parts: string[] = [];
  let buf = '';
  const flush = () => { if (buf) { parts.push(buf); buf = ''; } };
  // 문장 끝(. ? !) 뒤, 항 번호("제2항.") 앞에서 끊는다
  for (const seg of flat.split(/(?<=[.?!])\s+/)) {
    const s = seg.trim();
    if (!s) continue;
    if (buf.length + s.length + 1 > CHUNK_MAX) flush();
    buf = buf ? `${buf} ${s}` : s;
    // 한 문장이 통째로 상한을 넘으면 어절 경계에서 나눈다
    while (buf.length > CHUNK_MAX) {
      const cut = buf.lastIndexOf(' ', CHUNK_MAX);
      if (cut <= 0) break;             // 띄어쓰기가 없는 문서 — 자르지 않고 그대로 넘긴다
      parts.push(buf.slice(0, cut));
      buf = buf.slice(cut + 1);
    }
  }
  flush();
  /* 토막이 홀로 남는 것을 없앤다.
       "…목적으로 / 한다."     ← 길이로 자르다 생긴 꼬리 → 앞에 붙인다
       "제1항. / 열차를 운행…"  ← 항 번호만 떨어진 머리 → 뒤에 붙인다
     한 문장이 두 번 끊겨 들리는 것보다 조각이 조금 긴 편이 낫다. */
  const LIMIT = CHUNK_MAX + 40;
  const SHORT = 20;
  const merged: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const prev = merged[merged.length - 1];
    if (prev && p.length < SHORT && prev.length + p.length + 1 <= LIMIT) {
      merged[merged.length - 1] = `${prev} ${p}`;
    } else if (p.length < SHORT && parts[i + 1] && p.length + parts[i + 1].length + 1 <= LIMIT) {
      parts[i + 1] = `${p} ${parts[i + 1]}`;
    } else merged.push(p);
  }
  return merged;
}

/**
 * 목소리 고르기 — 기계음처럼 들리는 원인의 절반은 목소리 선택이다.
 *
 * 같은 기기에도 한국어 음성이 여러 개 깔려 있고 품질 차이가 크다.
 *  · 안드로이드: "Google 한국의"(신경망) ≫ 기본 내장
 *  · iOS/사파리: Yuna(고품질) ≫ Yuna(compact) — compact 는 옛날 방식이라 확연히 딱딱하다
 *  · 윈도우: Microsoft SunHi / Heami
 * 이름으로 순위를 매겨 가장 자연스러운 것을 기본으로 잡는다. 사용자가 바꿀 수도 있다.
 */
export function rankVoice(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  if (n.includes('compact') || n.includes('eloquence')) return -1;  // 확실히 딱딱한 것들
  let score = 0;
  if (n.includes('google')) score += 5;
  if (n.includes('neural') || n.includes('natural') || n.includes('premium') || n.includes('enhanced')) score += 5;
  if (n.includes('sunhi') || n.includes('heami') || n.includes('yuna') || n.includes('nari')) score += 3;
  if (!v.localService) score += 1;   // 서버 합성은 대개 더 자연스럽다
  return score;
}

export function koreanVoices(all: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return all.filter((v) => v.lang.toLowerCase().startsWith('ko'))
    .sort((a, b) => rankVoice(b) - rankVoice(a));
}

/** 조문 하나 → 낭독 조각들. 표는 빼고 있다는 사실만 알린다. */
export function articleToChunks(a: ReaderArticle): Chunk[] {
  const head: Chunk = { text: forSpeech(`제${a.n}조. ${a.title}.`), kind: 'head' };
  if (a.hasTable && (a.tableShare ?? 0) >= TABLE_SKIP_SHARE) {
    return [head, { text: '이 조문은 표로 되어 있습니다. 화면에서 확인하세요.', kind: 'notice' }];
  }
  // 제목은 head 에서 이미 읽었으니 본문에서 뺀다
  const body = a.text.replace(/^제\s*\d+\s*조\s*\([^)]*\)/, '');
  const out: Chunk[] = [head];
  let last = 0;
  const push = (raw: string) => { for (const s of splitSentences(raw)) out.push({ text: s, kind: 'body' }); };
  for (const m of body.matchAll(TABLE_RE)) {
    push(body.slice(last, m.index));
    out.push({ text: '여기에 표가 있습니다. 화면에서 확인하세요.', kind: 'notice' });
    last = m.index + m[0].length;
  }
  push(body.slice(last));
  return out;
}

export type ReaderStatus = 'idle' | 'playing' | 'paused';

export function useRegulationReader(regulationId: string) {
  const [articles, setArticles] = useState<ReaderArticle[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<ReaderStatus>('idle');
  const [artIdx, setArtIdx] = useState(0);
  const [chunkIdx, setChunkIdx] = useState(0);
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const chunksRef = useRef<Chunk[]>([]);
  const artIdxRef = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  /* cancel() 이 부르는 onend 와 자연 종료 onend 를 구분하는 표식.
     구분하지 않으면 정지·건너뛸 때 다음 조각이 한 번 더 튀어 나간다. */
  const genRef = useRef(0);

  useEffect(() => { rateRef.current = rate; }, [rate]);

  /* ── 목소리 목록 ──
     getVoices() 는 처음엔 빈 배열을 주고 나중에 voiceschanged 로 채워진다(크롬).
     한 번만 읽으면 목소리가 없는 채로 굳어 기본 음성으로 읽게 된다. */
  const VOICE_KEY = 'regulation-reader-voice';
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const ko = koreanVoices(window.speechSynthesis.getVoices());
      if (ko.length === 0) return;
      setVoices(ko);
      setVoiceURI((prev) => {
        if (prev && ko.some((v) => v.voiceURI === prev)) return prev;
        const saved = localStorage.getItem(VOICE_KEY);
        return (saved && ko.some((v) => v.voiceURI === saved)) ? saved : ko[0].voiceURI;
      });
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  useEffect(() => {
    voiceRef.current = voices.find((v) => v.voiceURI === voiceURI) ?? voices[0] ?? null;
    if (voiceURI) { try { localStorage.setItem(VOICE_KEY, voiceURI); } catch { /* 시크릿 모드 */ } }
  }, [voiceURI, voices]);

  /* ── 조문 인덱스 ── */
  useEffect(() => {
    let alive = true;
    setArticles(null); setLoadError(false);
    fetch(`/data/edu/regulations/${regulationId}-articles.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then((j: ReaderArticle[]) => { if (alive) setArticles(j); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, [regulationId]);

  /* ── 화면 잠금 방지 ── */
  const releaseWake = useCallback(() => {
    wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  }, []);
  const acquireWake = useCallback(async () => {
    if (wakeRef.current || !('wakeLock' in navigator)) return;
    try { wakeRef.current = await navigator.wakeLock.request('screen'); } catch { /* 배터리 절약 모드 등 — 낭독은 계속한다 */ }
  }, []);

  const stop = useCallback(() => {
    genRef.current += 1;
    if (supported) window.speechSynthesis.cancel();
    releaseWake();
    setStatus('idle');
    setChunkIdx(0);
  }, [supported, releaseWake]);

  /** i 번째 조각부터 끝까지 이어서 읽는다. onend 로 다음 조각을 부르는 사슬. */
  const speakFrom = useCallback((i: number) => {
    if (!supported) return;
    const gen = genRef.current;
    const chunks = chunksRef.current;
    if (i >= chunks.length) {           // 조문 하나 끝 → 다음 조문
      setArtIdx((prev) => {
        const next = prev + 1;
        artIdxRef.current = next;
        return next;
      });
      return;
    }
    setChunkIdx(i);
    const u = new SpeechSynthesisUtterance(chunks[i].text);
    u.lang = 'ko-KR';
    u.rate = rateRef.current;
    /* 조문 번호·제목은 표제다. 조금 낮고 느리게 읽어야 본문과 구분돼 들린다.
       안내("표가 있습니다")는 규정이 아니라 앱이 하는 말이라 살짝 높여 구별한다. */
    if (chunks[i].kind === 'head') { u.pitch = 0.95; u.rate = rateRef.current * 0.92; }
    else if (chunks[i].kind === 'notice') { u.pitch = 1.1; }
    if (voiceRef.current) u.voice = voiceRef.current;
    u.onend = () => { if (gen === genRef.current) speakFrom(i + 1); };
    u.onerror = () => { if (gen === genRef.current) speakFrom(i + 1); };
    window.speechSynthesis.speak(u);
  }, [supported]);

  /* 조문이 바뀌면 그 조문을 처음부터 읽는다. 재생 중일 때만 — 멈춘 상태에서 조문만
     골라 둔 경우까지 소리가 나면 안 된다. */
  useEffect(() => {
    if (!articles || status !== 'playing') return;
    const a = articles[artIdx];
    if (!a) { stop(); return; }         // 마지막 조문까지 읽었다
    genRef.current += 1;
    window.speechSynthesis.cancel();
    chunksRef.current = articleToChunks(a);
    speakFrom(0);
    // artIdx 가 바뀔 때만 새로 시작한다. chunkIdx 는 사슬이 스스로 굴린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artIdx, status === 'playing', articles]);

  const play = useCallback((startArticle?: number) => {
    if (!supported || !articles) return;
    if (startArticle != null) {
      const i = articles.findIndex((a) => a.n === startArticle);
      if (i >= 0) { artIdxRef.current = i; setArtIdx(i); }
    }
    acquireWake();
    setStatus('playing');
  }, [supported, articles, acquireWake]);

  const pause = useCallback(() => {
    if (!supported) return;
    /* pause() 는 안드로이드 크롬에서 재개가 안 되는 사례가 있다. cancel 하고
       현재 조각 번호를 붙잡아 뒀다가 거기서 다시 읽는 편이 확실하다. */
    genRef.current += 1;
    window.speechSynthesis.cancel();
    releaseWake();
    setStatus('paused');
  }, [supported, releaseWake]);

  const resume = useCallback(() => {
    if (!supported) return;
    acquireWake();
    setStatus('playing');
    genRef.current += 1;
    speakFrom(chunkIdx);
  }, [supported, acquireWake, speakFrom, chunkIdx]);

  const jump = useCallback((delta: number) => {
    if (!articles) return;
    const next = Math.min(articles.length - 1, Math.max(0, artIdxRef.current + delta));
    artIdxRef.current = next;
    genRef.current += 1;
    if (supported) window.speechSynthesis.cancel();
    setChunkIdx(0);
    setArtIdx(next);
    /* 멈춘 상태에서 넘기면 그 조문 첫 조각을 준비만 해 둔다 */
    if (status !== 'playing') chunksRef.current = articleToChunks(articles[next]);
  }, [articles, supported, status]);

  /* 크롬은 발화가 15초쯤 지나면 조용히 멈춘다(오래된 버그). 조각을 짧게 유지해도
     느린 속도로 들으면 넘길 수 있어서, 재생 중에는 주기적으로 깨워 둔다.
     pause 직후 resume 은 소리에 영향이 없고 타이머만 되돌린다. */
  useEffect(() => {
    if (!supported || status !== 'playing') return;
    const id = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [supported, status]);

  /* 화면이 다시 보이면 Wake Lock 은 자동 해제돼 있다 — 재생 중이면 다시 잡는다 */
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && status === 'playing') acquireWake(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [status, acquireWake]);

  useEffect(() => () => {
    genRef.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    wakeRef.current?.release().catch(() => {});
  }, []);

  const current = articles?.[artIdx] ?? null;
  return {
    supported, articles, loadError, status, rate, setRate,
    voices, voiceURI, setVoiceURI,
    current, chunks: chunksRef.current, chunkIdx,
    play, pause, resume, stop, jump,
    total: articles?.length ?? 0, index: artIdx,
  };
}
