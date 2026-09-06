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
    .replace(/[“”‘’"']/g, '')                                // 따옴표를 "따옴표"라고 읽는 엔진이 있다
    .replace(/(\d+)\s*[.]\s*(\d+)\s*[.]\s*(\d+)\s*\./g, '$1년 $2월 $3일')
    .replace(/㎞\/h|km\/h/gi, '킬로미터')
    .replace(/㎞/g, '킬로미터').replace(/㎧/g, '초당 미터')
    /* 단위 기호를 안 바꾸면 엔진이 통째로 삼키거나 글자 그대로 읽는다.
       실측: ㎜ 28곳(완장·표지 치수), ㎏ 2곳, ㎠ 2곳, ℃ 1곳. */
    .replace(/㎜/g, '밀리미터').replace(/㎝/g, '센티미터').replace(/㎡/g, '제곱미터')
    .replace(/㎠/g, '제곱센티미터').replace(/㎏/g, '킬로그램').replace(/℃/g, '도')
    .replace(/‰/g, '퍼밀').replace(/%/g, '퍼센트')
    /* 화살표는 «이렇게 바뀐다»·«메뉴를 타고 들어간다» 는 뜻으로 쓰인다.
       (예: "주차제동 걸림"⇒"주차제동 풀림", 메트로피스→운전관리→열차운행관리)
       뜻을 지어내지 않고 쉼표로 끊어 준다 — 그대로 두면 엔진이 무음이거나 "화살표". */
    .replace(/[→⇒↔⇔←⇐↑↓▲▼◀▶]/g, ', ')
    /* 도면의 치수선·괘선(―――, ─, │…). 소리로는 아무 뜻이 없다.
       대부분 【표】 안이라 이미 건너뛰지만 제164조(전령자 완장)처럼 표 밖에 남은 것이 있다. */
    .replace(/[―─━│┃┌┐└┘├┤┬┴┼]+/g, ' ')
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
    /* 기호를 걷어내고 나면 쉼표만 겹쳐 남는 자리가 생긴다(", , 380밀리미터 ,").
       엔진이 그때마다 쉼을 넣어 말이 뚝뚝 끊긴다 — 하나로 합치고 군더더기를 뗀다. */
    .replace(/\s+,/g, ',')                                    // "한다 ," → "한다,"
    .replace(/,(?:\s*,)+/g, ',')                              // 겹친 쉼표
    .replace(/([.?!])\s*,/g, '$1')                            // "한다. ," → "한다."
    .replace(/^[\s,]+|[\s,]+$/g, '')
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
  /* 한글이 한 글자도 없는 조각은 읽지 않는다.
     기호를 걷어내고 나면 도면 부스러기("380", ", ,")만 남는 경우가 생기는데,
     엔진이 이것만 따로 읽으면 앞뒤 문장과 이어지지 않아 잡음으로 들린다.
     뜻이 있는 숫자는 위 병합 단계에서 이미 앞뒤 문장에 붙는다. */
  return merged.filter((s) => /[가-힣]/.test(s));
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

/**
 * 조문 제목 — 없는 것을 «null» 이라고 읽지 않게.
 *
 * 원본 PDF 에 «제15조(null)» 처럼 인쇄된 조문이 19곳 있다(전동차승무원업무예규 18곳,
 * 운전취급세부요령 1곳). 전부 삭제된 조문이고, 원본을 만든 쪽의 표기 사고다.
 * 본문은 원본 그대로 보여 주되(화면), 소리로는 «널» 이라고 읽지 않는다.
 */
export function articleTitle(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  return /^(null|undefined|-)?$/i.test(t) ? '' : t;
}

/** 조문 하나 → 낭독 조각들. 표는 빼고 있다는 사실만 알린다. */
export function articleToChunks(a: ReaderArticle): Chunk[] {
  const title = articleTitle(a.title);
  const head: Chunk = { text: forSpeech(title ? `제${a.n}조. ${title}.` : `제${a.n}조.`), kind: 'head' };
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

  /*
   * 표 비중(tableShare)만으로는 못 거르는 조문이 있다.
   * 표 사이에 낀 «본문» 이 실은 표 칸 부스러기라, 읽으면
   *   "출입문선택스위치 수/수 지적 … 9 (TCMS 출고전 검사) TCMS 지적 및 해당스위치 취급가."
   * 처럼 뜻이 안 통한다. 실측하면 이런 조문은 조각이 «문장으로 끝나지 않는다».
   * 그래서 표가 있는 조문에 한해, 조각 대부분이 문장이 아니면 읽지 않고 알리기만 한다.
   * (기준 미달 실측: 운전관계직원업무내규 제34조, 운전취급규정 제293조 두 곳)
   */
  const bodies = out.filter((c) => c.kind === 'body');
  if (a.hasTable && bodies.length >= 2) {
    const sentences = bodies.filter((c) => /[.?!]\s*$/.test(c.text)).length;
    if (sentences / bodies.length < 0.3) {
      return [head, { text: '이 조문은 표로 되어 있습니다. 화면에서 확인하세요.', kind: 'notice' }];
    }
  }
  return out;
}

export type ReaderStatus = 'idle' | 'playing' | 'paused';

/** {id}-audio.json — 조문 번호 → 조각별 MP3 이름(문장 내용의 SHA-1 12자) */
interface AudioManifest {
  voice: string;
  chunks: Record<string, string[]>;
}

/* 공개 버킷이라 로그인 없이 CDN 에서 바로 받는다 — 지하에서 토큰 갱신을 기다리지 않게. */
const AUDIO_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/public/regulation-audio/sunhi`;

/* 모바일은 사용자 탭이 아닌 재생을 막는다. 재생 버튼을 누른 그 순간(제스처 안에서)
   이 무음 클립을 한 번 재생해 <audio> 엘리먼트를 "언락"해 두면, 이후 조각별
   MP3 를 이펙트/onended 에서 자동으로 이어 재생할 수 있다(iOS 사파리 필수). */
const SILENT = 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YeABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=';

export function useRegulationReader(regulationId: string) {
  const [articles, setArticles] = useState<ReaderArticle[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<ReaderStatus>('idle');
  const [artIdx, setArtIdx] = useState(0);
  const [chunkIdx, setChunkIdx] = useState(0);
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(null);
  /* null = 아직 확인 중 · undefined = 이 규정엔 MP3 가 없다(기기 음성으로 읽는다) */
  const [audioMap, setAudioMap] = useState<AudioManifest | null | undefined>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<(string | null)[]>([]);
  const unlockedRef = useRef(false);
  /* 조각이 조용히 멎으면(onended/onend 유실·모바일 재생차단) 다음 조각으로 넘겨
     낭독이 통째로 멈추는 것을 막는 감시견 타이머. */
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearWatchdog = () => { if (watchdogRef.current) { clearTimeout(watchdogRef.current); watchdogRef.current = null; } };

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const chunksRef = useRef<Chunk[]>([]);
  const artIdxRef = useRef(0);
  const rateRef = useRef(1);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  /* cancel() 이 부르는 onend 와 자연 종료 onend 를 구분하는 표식.
     구분하지 않으면 정지·건너뛸 때 다음 조각이 한 번 더 튀어 나간다. */
  const genRef = useRef(0);
  /** 연속 실패 횟수 — 한 조각이라도 제대로 읽히면 0 으로 돌아간다 */
  const failRef = useRef(0);
  /** 이어듣기로 다시 켠 것인가 — 조문을 처음부터 다시 읽지 않기 위한 표시 */
  const resumingRef = useRef(false);
  /** 지금 읽고 있는 조각 번호(렌더와 무관하게 읽어야 할 때가 있다) */
  const chunkIdxRef = useRef(0);

  /* 속도는 재생 중에도 즉시 먹혀야 한다. MP3 는 playbackRate 로 음높이를 유지한 채
     빨라지고, 기기 음성은 다음 조각부터 반영된다(utterance 는 도중에 못 바꾼다). */
  useEffect(() => {
    rateRef.current = rate;
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

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

  /* ── 사람 목소리(미리 합성한 MP3) 목록 ──
     있으면 이걸 쓰고 없으면 기기 음성으로 읽는다. 안내방송과 같은 Neural 음성이라
     확연히 자연스럽다. 아직 만들지 않은 규정도 있어서 없는 게 정상인 경우가 있다. */
  useEffect(() => {
    let alive = true;
    setAudioMap(null);
    fetch(`/data/edu/regulations/${regulationId}-audio.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no audio'))))
      .then((j: AudioManifest) => { if (alive) setAudioMap(j); })
      .catch(() => { if (alive) setAudioMap(undefined); });   // undefined = 없음이 확정
    return () => { alive = false; };
  }, [regulationId]);

  /* ── 화면 잠금 방지 ── */
  const releaseWake = useCallback(() => {
    wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  }, []);
  const acquireWake = useCallback(async () => {
    if (wakeRef.current || !('wakeLock' in navigator)) return;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      /* 화면이 가려지면 브라우저가 스스로 놓아준다. 그런데 우리 손에 든 표는 그대로라
         «이미 잡고 있다» 고 착각해 다시 잡지 않았고, 화면이 계속 꺼져 낭독이 뒤로 밀렸다.
         놓아준 순간 손을 비워 둔다. */
      sentinel.addEventListener('release', () => {
        if (wakeRef.current === sentinel) wakeRef.current = null;
      });
      wakeRef.current = sentinel;
    } catch { /* 배터리 절약 모드 등 — 낭독은 계속한다 */ }
  }, []);

  /**
   * 조문 하나의 조각별 MP3 주소. 없으면 그 자리는 null → 기기 음성이 읽는다.
   *
   * 조각 개수가 매니페스트와 다르면 통째로 포기한다. 규정을 다시 만들었는데 음성을
   * 아직 안 만든 경우인데, 어긋난 채로 이어 붙이면 엉뚱한 조문을 읽어 준다 —
   * 조금 딱딱하게 읽히는 것보다 훨씬 나쁘다.
   */
  const urlsFor = useCallback((a: ReaderArticle, chunkCount: number): (string | null)[] => {
    const hashes = audioMap?.chunks?.[String(a.n)];
    if (!hashes || hashes.length !== chunkCount) return new Array(chunkCount).fill(null);
    return hashes.map((h) => `${AUDIO_BASE}/${h}.mp3`);
  }, [audioMap]);

  const silence = useCallback(() => {
    clearWatchdog();
    if (supported) window.speechSynthesis.cancel();
    const el = audioRef.current;
    // pause 만 한다. removeAttribute+load 를 부르면 바로 뒤 조각의 play() 가
    // "interrupted by a new load request" 로 거부돼 조문 경계에서 낭독이 끊긴다.
    if (el) el.pause();
  }, [supported]);

  /* 재생 버튼(사용자 제스처) 안에서 <audio> 를 무음으로 한 번 깨워 언락한다.
     이래야 이후 조각별 MP3 를 이펙트에서 이어 재생할 수 있다(모바일 자동재생 정책). */
  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    const el = audioRef.current ?? (audioRef.current = new Audio());
    el.src = SILENT;
    el.play().then(() => { if (el.src === SILENT) el.pause(); }).catch(() => {});
    unlockedRef.current = true;
  }, []);

  const stop = useCallback(() => {
    genRef.current += 1;
    silence();
    releaseWake();
    setStatus('idle');
    setChunkIdx(0);
  }, [silence, releaseWake]);

  /**
   * 기기 음성으로 읽는다 — MP3 가 없거나 못 받았을 때의 대비책.
   *
   * ★ 소리를 못 낸 것(onerror)과 다 읽은 것(onend)은 다르다.
   *   예전엔 둘을 같은 것으로 봐서, 음성 엔진이 막힌 상태(화면이 꺼져 뒤로 밀렸을 때가
   *   대표적이다)에서 조각마다 즉시 «다 읽었다» 가 되어 규정 전체가 눈 깜짝할 사이에
   *   끝까지 흘러가고 낭독이 꺼져 있었다. 이제 실패는 실패로 알린다.
   */
  const speakWithTts = useCallback((chunk: Chunk, onDone: () => void, onFail?: () => void) => {
    if (!supported) { (onFail ?? onDone)(); return; }
    const u = new SpeechSynthesisUtterance(chunk.text);
    u.lang = 'ko-KR';
    u.rate = rateRef.current;
    /* 조문 번호·제목은 표제다. 조금 낮고 느리게 읽어야 본문과 구분돼 들린다.
       안내("표가 있습니다")는 규정이 아니라 앱이 하는 말이라 살짝 높여 구별한다. */
    if (chunk.kind === 'head') { u.pitch = 0.95; u.rate = rateRef.current * 0.92; }
    else if (chunk.kind === 'notice') { u.pitch = 1.1; }
    if (voiceRef.current) u.voice = voiceRef.current;
    u.onend = onDone;
    u.onerror = () => (onFail ?? onDone)();
    window.speechSynthesis.speak(u);
  }, [supported]);

  /**
   * i 번째 조각부터 끝까지 이어서 읽는다. 끝나면 다음 조각을 부르는 사슬.
   *
   * 미리 합성해 둔 MP3 가 있으면 그것부터 쓴다(안내방송과 같은 Neural 음성).
   * 지하 구간처럼 못 받는 곳에서는 소리가 끊기는 대신 기기 음성으로 이어 읽는다 —
   * 읽던 자리를 잃지 않는 게 음질보다 중요하다.
   */
  const speakFrom = useCallback((i: number) => {
    const gen = genRef.current;
    const chunks = chunksRef.current;
    clearWatchdog();
    if (i >= chunks.length) {           // 조문 하나 끝 → 다음 조문
      setArtIdx((prev) => {
        const next = prev + 1;
        artIdxRef.current = next;
        return next;
      });
      return;
    }
    setChunkIdx(i);
    chunkIdxRef.current = i;
    const next = () => {
      clearWatchdog();
      failRef.current = 0;               // 한 조각이라도 제대로 읽혔으면 실패 기록은 지운다
      if (gen === genRef.current) speakFrom(i + 1);
    };

    /**
     * 소리가 안 났다. 다음으로 넘기지 «않고» 같은 조각을 다시 시도한다.
     *
     * 넘겨 버리면 — 실제로 그랬다 — 실패가 이어질 때 조각·조문이 순식간에 끝까지
     * 흘러가 낭독이 저 혼자 꺼진다. 되풀이해 보되 간격을 두어, 화면이 꺼졌다가
     * 돌아오면 그 자리에서 이어지게 한다.
     * 세 번까지 해 보고 그래도 안 되면 한 조각만 건너뛴다(그마저도 사이를 둔다).
     */
    const retry = () => {
      if (gen !== genRef.current) return;
      clearWatchdog();
      failRef.current += 1;
      const tooMany = failRef.current % 4 === 0;   // 3번 실패 후 네 번째엔 한 칸 넘어간다
      const wait = Math.min(400 * failRef.current, 3000);
      watchdogRef.current = setTimeout(() => {
        if (gen !== genRef.current) return;
        speakFrom(tooMany ? i + 1 : i);
      }, wait);
    };

    /* 진행이 멎으면(onended/onend 유실) 스스로 다음 조각으로 넘어간다.
       조각 길이로 넉넉한 상한을 잡아, 정상 재생은 건드리지 않고 멈춤만 되살린다.
       넘어가기 전에 «앞 소리부터 끈다» — 안 끄면 늦게 도착한 앞 조각과 새 조각이
       겹쳐 울리고, 사슬이 둘이 되어 조문 하나를 통째로 건너뛴다. */
    const armWatchdog = () => {
      clearWatchdog();
      const ms = (chunks[i].text.length * 140) / rateRef.current + 6000;
      watchdogRef.current = setTimeout(() => {
        if (gen !== genRef.current) return;
        genRef.current += 1;                       // 멎은 사슬을 버린다
        if (supported) window.speechSynthesis.cancel();
        audioRef.current?.pause();
        speakFrom(i + 1);
      }, ms);
    };
    const url = audioUrlRef.current[i];
    if (!url) { armWatchdog(); speakWithTts(chunks[i], next, retry); return; }

    const el = audioRef.current ?? (audioRef.current = new Audio());
    el.src = url;
    el.playbackRate = rateRef.current;   // 브라우저가 음높이를 유지한 채 속도만 바꾼다
    el.onended = next;
    el.onerror = () => { if (gen === genRef.current) speakWithTts(chunks[i], next, retry); };
    armWatchdog();
    el.play().catch(() => { if (gen === genRef.current) speakWithTts(chunks[i], next, retry); });

    /* 다음 조각을 미리 받아 둔다. 조각마다 요청이 나가서 그냥 두면 문장 사이가
       한 박자씩 끊긴다. 캐시에만 올려 두면 되므로 응답은 버린다. */
    const ahead = audioUrlRef.current[i + 1];
    if (ahead) fetch(ahead, { cache: 'force-cache' }).catch(() => {});
  }, [speakWithTts, supported]);

  /* 조문이 바뀌면 그 조문을 처음부터 읽는다. 재생 중일 때만 — 멈춘 상태에서 조문만
     골라 둔 경우까지 소리가 나면 안 된다. */
  useEffect(() => {
    if (!articles || status !== 'playing') return;
    if (resumingRef.current) { resumingRef.current = false; return; }  // 이어듣기 — 그 자리에서 잇는다
    const a = articles[artIdx];
    if (!a) { stop(); return; }         // 마지막 조문까지 읽었다
    genRef.current += 1;
    failRef.current = 0;
    silence();
    chunksRef.current = articleToChunks(a);
    audioUrlRef.current = urlsFor(a, chunksRef.current.length);
    speakFrom(0);
    // artIdx 가 바뀔 때만 새로 시작한다. chunkIdx 는 사슬이 스스로 굴린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artIdx, status === 'playing', articles]);

  const play = useCallback((startArticle?: number) => {
    if (!articles) return;
    unlock();                            // 제스처 안에서 <audio> 언락 (모바일 필수)
    if (startArticle != null) {
      const i = articles.findIndex((a) => a.n === startArticle);
      if (i >= 0) { artIdxRef.current = i; setArtIdx(i); }
    }
    acquireWake();
    setStatus('playing');
  }, [articles, acquireWake, unlock]);

  /**
   * 재생하지 않고 그 조문으로 옮겨만 둔다.
   *
   * 읽기판은 열자마자 «재생을 누르면 이 조문부터 읽어드려요» 라고 안내한다.
   * 그런데 실제 이동은 play() 안에서만 일어나서, 누르기 전에는 늘 제1조가 떠 있었다 —
   * 40조를 보다가 열면 «제1조 1/122» 가 보이니 안내가 거짓말이 된다.
   */
  const seek = useCallback((articleNo: number) => {
    if (!articles) return;
    const i = articles.findIndex((a) => a.n === articleNo);
    if (i >= 0) { artIdxRef.current = i; setArtIdx(i); setChunkIdx(0); }
  }, [articles]);

  const pause = useCallback(() => {
    /* speechSynthesis.pause() 는 안드로이드 크롬에서 재개가 안 되는 사례가 있다.
       멈추고 현재 조각 번호를 붙잡아 뒀다가 거기서 다시 읽는 편이 확실하다. */
    genRef.current += 1;
    silence();
    releaseWake();
    setStatus('paused');
  }, [silence, releaseWake]);

  const resume = useCallback(() => {
    unlock();                            // 제스처 안에서 <audio> 언락
    acquireWake();
    /* 아래 «조문이 바뀌면 처음부터» 이펙트는 status 가 playing 으로 바뀌는 것만 봐도
       돌아서, 이어듣기를 눌러도 조문 첫머리로 되감겼다. 이번은 이어듣기라고 알린다. */
    resumingRef.current = true;
    setStatus('playing');
    genRef.current += 1;
    failRef.current = 0;
    speakFrom(chunkIdx);
  }, [acquireWake, speakFrom, chunkIdx, unlock]);

  const jump = useCallback((delta: number) => {
    if (!articles) return;
    const next = Math.min(articles.length - 1, Math.max(0, artIdxRef.current + delta));
    artIdxRef.current = next;
    genRef.current += 1;
    silence();
    setChunkIdx(0);
    setArtIdx(next);
    /* 멈춘 상태에서 넘기면 그 조문 첫 조각을 준비만 해 둔다 */
    if (status !== 'playing') {
      chunksRef.current = articleToChunks(articles[next]);
      audioUrlRef.current = urlsFor(articles[next], chunksRef.current.length);
    }
  }, [articles, silence, status, urlsFor]);

  /* 크롬은 발화가 15초쯤 지나면 조용히 멈춘다(오래된 버그). 조각을 짧게 유지해도
     느린 속도로 들으면 넘길 수 있어서, 재생 중에는 주기적으로 깨워 둔다.
     pause 직후 resume 은 소리에 영향이 없고 타이머만 되돌린다. */
  useEffect(() => {
    if (!supported || status !== 'playing') return;
    const id = setInterval(() => {
      /* 화면이 가려진 동안에는 건드리지 않는다. 안드로이드 크롬은 이때 pause 뒤
         resume 이 돌아오지 않는 일이 있어, 깨우려던 것이 되레 낭독을 끊는다. */
      if (document.visibilityState !== 'visible') return;
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10_000);
    return () => clearInterval(id);
  }, [supported, status]);

  /* 화면이 다시 보이면 Wake Lock 은 자동 해제돼 있다 — 재생 중이면 다시 잡는다.
     그리고 가려진 동안 소리가 멎었을 수 있으니, 읽고 있어야 하는데 아무 소리도 안 나면
     읽던 조각부터 다시 잇는다. 정지를 누르기 전까지는 스스로 꺼지지 않는다. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible' || status !== 'playing') return;
      acquireWake();
      const el = audioRef.current;
      const mp3Playing = !!el && !el.paused && !el.ended;
      const ttsPlaying = supported && window.speechSynthesis.speaking;
      if (!mp3Playing && !ttsPlaying) {
        genRef.current += 1;
        failRef.current = 0;
        speakFrom(chunkIdxRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [status, acquireWake, supported, speakFrom]);

  useEffect(() => () => {
    genRef.current += 1;
    clearWatchdog();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    audioRef.current?.pause();
    wakeRef.current?.release().catch(() => {});
  }, []);

  const current = articles?.[artIdx] ?? null;
  /* 이 규정에 미리 합성한 음성이 있는가. 있으면 기기 음성 선택은 예비용이라
     화면에서 감춘다 — 고를 필요가 없는데 보이면 뭘 골라야 하나 헷갈린다. */
  const usingRecorded = !!audioMap && !!current && !!audioMap.chunks[String(current.n)];
  /* 잠금화면·알림줄에 «지금 읽는 조문» 을 올린다.
     보기 좋으라고만 하는 게 아니다 — 이걸 걸어 두면 화면을 끄거나 다른 앱으로 넘어가도
     브라우저가 «소리 내는 중인 페이지» 로 대접해 뒤로 밀어내지 않는다. */
  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    if (status === 'idle' || !current) { ms.playbackState = 'none'; ms.metadata = null; return; }
    ms.metadata = new MediaMetadata({
      title: `제${current.n}조 ${articleTitle(current.title)}`.trim(),
      artist: '규정 읽어주기',
      album: current.chapter || '',
    });
    ms.playbackState = status === 'playing' ? 'playing' : 'paused';
    return () => { ms.playbackState = 'none'; };
  }, [status, current]);

  useEffect(() => {
    const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
    if (!ms) return;
    const set = (act: MediaSessionAction, fn: (() => void) | null) => {
      try { ms.setActionHandler(act, fn); } catch { /* 이 기기가 지원 안 하는 동작 */ }
    };
    set('play', () => resume());
    set('pause', () => pause());
    set('stop', () => stop());
    set('nexttrack', () => jump(1));
    set('previoustrack', () => jump(-1));
    return () => {
      set('play', null); set('pause', null); set('stop', null);
      set('nexttrack', null); set('previoustrack', null);
    };
  }, [resume, pause, stop, jump]);

  return {
    /* 미리 합성한 MP3 만 있어도 들을 수 있다 — 기기 음성이 없는 브라우저도 재생된다 */
    supported: supported || !!audioMap,
    articles, loadError, status, rate, setRate,
    voices, voiceURI, setVoiceURI, usingRecorded,
    current, chunks: chunksRef.current, chunkIdx,
    play, pause, resume, stop, jump, seek,
    total: articles?.length ?? 0, index: artIdx,
  };
}
