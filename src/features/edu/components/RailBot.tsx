'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send, BookOpen, AlertTriangle, Loader2, Bot, PlayCircle, Volume2 } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import RegulationViewer from './RegulationViewer';
import HandbookSectionViewer from './HandbookSectionViewer';
import styles from '../styles/edu.module.css';

interface Props { onBack: () => void }

interface SourceRef {
  label: string;
  kind: 'reg' | 'book' | 'case' | 'video' | 'broadcast';
  regId: string | null;
  article: number | null;
  chapterId: string | null;
  sectionId: string | null;
  url: string | null;
  audioId: string | null;
  /** 이 근거가 걸린 말 */
  terms?: string[];
}

interface Msg {
  role: 'me' | 'bot';
  text: string;
  sources?: SourceRef[];
  /** 답을 고른 까닭 — 본문에서 색칠할 말 */
  terms?: string[];
  /** 차종 되묻기 */
  ask?: { id: string; label: string }[];
  urgent?: boolean;
  error?: boolean;
}

/**
 * 답변 본문에서 «걸린 말» 을 색칠한다.
 *
 * 원문은 띄어쓰기가 제멋대로라(PDF 추출) 검색은 공백을 지우고 맞춘다.
 * 그래서 색칠도 공백을 건너뛰며 맞춰야 한다 — 「판타그라프상승」 으로 찾은 것이
 * 본문에는 「판타그라프 상승」 으로 적혀 있다.
 */
function paint(text: string, terms: string[]): React.ReactNode[] {
  if (terms.length === 0) return [text];
  // 공백을 뺀 글자만 모아 두고, 그 자리를 원문 위치로 되돌릴 지도를 만든다
  const bare: string[] = [];
  const at: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (!/\s/.test(text[i])) { bare.push(text[i].toLowerCase()); at.push(i); }
  }
  const flat = bare.join('');
  const mark = new Array<boolean>(text.length).fill(false);
  for (const t of terms) {
    if (t.length < 2) continue;
    let from = 0;
    for (;;) {
      const k = flat.indexOf(t, from);
      if (k < 0) break;
      for (let j = k; j < k + t.length; j++) mark[at[j]] = true;
      from = k + 1;
    }
  }
  // 칠한 글자 사이에 낀 공백도 이어서 칠한다 — 「판타그라프 상승」 이 두 토막으로 갈리지 않게
  for (let i = 1; i < text.length - 1; i++) {
    if (mark[i] || !/^[ \t]+$/.test(text[i])) continue;
    let l = i - 1; while (l >= 0 && /[ \t]/.test(text[l])) l--;
    let r = i + 1; while (r < text.length && /[ \t]/.test(text[r])) r++;
    if (l >= 0 && r < text.length && mark[l] && mark[r]) mark[i] = true;
  }

  const out: React.ReactNode[] = [];
  let buf = '';
  let on = mark[0];
  const flush = () => {
    if (!buf) return;
    out.push(on ? <mark key={out.length} className={styles.railBotHit}>{buf}</mark> : buf);
    buf = '';
  };
  for (let i = 0; i < text.length; i++) {
    if (mark[i] !== on) { flush(); on = mark[i]; }
    buf += text[i];
  }
  flush();
  return out;
}

interface DocEntry { title: string; url: string; pdfUrl?: string }

const EXAMPLES = [
  '구원연결 할 때 판토 어떻게 해요?',
  '확인운전 명령은 언제 하나요?',
  '기지 입환 전에 확인할 것',
  '무전기 사용 요령',
];

export default function RailBot({ onBack }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<Record<string, DocEntry>>({});
  const [openDoc, setOpenDoc] = useState<(DocEntry & { article?: number }) | null>(null);
  const [openBook, setOpenBook] = useState<{ chapterId: string | null; sectionId: string; title: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const anyViewer = !!openDoc || !!openBook;
  useHistoryBack('railbot', onBack, !anyViewer);
  useEscapeClose(!anyViewer, onBack);

  // 근거 배지 → 규정 원문으로 점프하려면 문서 경로가 필요하다
  useEffect(() => {
    fetch('/data/edu/training.json')
      .then((r) => r.json())
      .then((t) => {
        const map: Record<string, DocEntry> = {};
        const walk = (o: unknown) => {
          if (Array.isArray(o)) return o.forEach(walk);
          if (o && typeof o === 'object') {
            const e = o as { id?: string; title?: string; doc?: DocEntry };
            if (e.id && e.doc?.url) map[e.id] = { title: e.title ?? e.id, url: e.doc.url, pdfUrl: e.doc.pdfUrl };
            Object.values(o).forEach(walk);
          }
        };
        walk(t);
        setDocs(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);

  const ask = useCallback(async (question: string, vehicle?: string) => {
    if (busy) return;
    setBusy(true);
    if (!vehicle) setMsgs((m) => [...m, { role: 'me', text: question }]);
    try {
      const res = await fetch('/api/edu/railbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, vehicle }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsgs((m) => [...m, { role: 'bot', text: d.message ?? '답변을 가져오지 못했어요.', error: true }]);
      } else if (d.mode === 'need-vehicle') {
        setMsgs((m) => [...m, { role: 'bot', text: d.message, ask: d.options }]);
      } else if (d.mode === 'no-evidence') {
        setMsgs((m) => [...m, { role: 'bot', text: d.message }]);
      } else {
        setMsgs((m) => [...m, { role: 'bot', text: d.answer, sources: d.sources, terms: d.terms, urgent: d.urgent }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: 'bot', text: '연결이 끊겼어요. 잠시 후 다시 시도해주세요.', error: true }]);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const submit = () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    ask(q);
  };

  /** 되묻기 답변 — 직전 내 질문을 차종과 함께 다시 보낸다 */
  const answerVehicle = (id: string, label: string) => {
    const lastMine = [...msgs].reverse().find((m) => m.role === 'me');
    if (!lastMine) return;
    setMsgs((m) => [...m, { role: 'me', text: `${label} 전동차` }]);
    ask(lastMine.text, id);
  };

  const openSource = (s: SourceRef) => {
    if (s.kind === 'reg' && s.regId) {
      const d = docs[s.regId];
      if (!d) return;
      setOpenDoc({ ...d, article: s.article ?? undefined });
    } else if ((s.kind === 'book' || s.kind === 'broadcast') && s.sectionId) {
      // 교재·안내방송 — handbook.json 의 장/절 원문 섹션으로 점프(거기서 음성도 듣는다)
      setOpenBook({ chapterId: s.chapterId, sectionId: s.sectionId, title: s.label });
    } else if (s.kind === 'video' && s.url) {
      window.open(s.url, '_blank', 'noopener,noreferrer');
    }
    // case(사고사례)는 답변 본문에 전체가 이미 표시되어 별도 이동 없음
  };

  /** 근거 배지를 누를 수 있는가 (열 곳이 있는가) */
  const canOpen = (s: SourceRef) =>
    (s.kind === 'reg' && !!s.regId && !!docs[s.regId]) ||
    ((s.kind === 'book' || s.kind === 'broadcast') && !!s.sectionId) ||
    (s.kind === 'video' && !!s.url);

  /** 근거 종류를 한눈에 — 규정·교재는 책, 영상은 재생, 방송은 스피커 */
  const sourceIcon = (kind: SourceRef['kind']) => {
    if (kind === 'video') return <PlayCircle size={12} aria-hidden />;
    if (kind === 'broadcast') return <Volume2 size={12} aria-hidden />;
    return <BookOpen size={12} aria-hidden />;
  };

  return (
    <div className={styles.railBotScreen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={22} />
        </button>
        <h1 className={styles.topTitle}>레일봇</h1>
      </div>

      <div className={styles.railBotBody}>
        {msgs.length === 0 && (
          <div className={styles.railBotIntro}>
            <span className={styles.railBotIntroIcon}><Bot size={30} /></span>
            <p className={styles.railBotIntroTitle}>규정·교재에서 찾아 답합니다</p>
            <p className={styles.railBotIntroDesc}>
              규정 9종(조문 892개)과 교재·고장조치·사고사례,<br />
              영상 가이드와 안내방송 문안까지 근거로 삼아요.<br />
              답에서 <mark className={styles.railBotHit}>색칠한 말</mark>이 그 답을 고른 까닭이에요.
            </p>
            <div className={styles.railBotExamples}>
              {EXAMPLES.map((e) => (
                <button key={e} type="button" className={styles.railBotExample} onClick={() => ask(e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={m.role === 'me' ? styles.railBotRowMe : styles.railBotRowBot}>
            <div className={`${m.role === 'me' ? styles.railBotMe : styles.railBotBot} ${m.error ? styles.railBotErr : ''}`}>
              {m.urgent && (
                <span className={styles.railBotUrgent}>
                  <AlertTriangle size={15} aria-hidden />
                  진행 중인 상황이면 <b>관제보고가 먼저</b>입니다
                </span>
              )}
              <p className={styles.railBotText}>
                {m.terms && m.terms.length > 0 ? paint(m.text, m.terms) : m.text}
              </p>

              {m.ask && (
                <span className={styles.railBotChips}>
                  {m.ask.map((o) => (
                    <button key={o.id} type="button" className={styles.railBotChip}
                      onClick={() => answerVehicle(o.id, o.label)} disabled={busy}>
                      {o.label}
                    </button>
                  ))}
                </span>
              )}

              {m.sources && m.sources.length > 0 && (
                <span className={styles.railBotSources}>
                  <span className={styles.railBotSourcesLabel}>근거</span>
                  {m.sources.map((s, j) => (
                    <button
                      key={j}
                      type="button"
                      className={styles.railBotSource}
                      onClick={() => openSource(s)}
                      disabled={!canOpen(s)}
                    >
                      {sourceIcon(s.kind)}
                      {s.label}
                      {s.terms && s.terms.length > 0 && (
                        <em className={styles.railBotWhy}>{s.terms[0]}</em>
                      )}
                    </button>
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className={styles.railBotRowBot}>
            <div className={styles.railBotBot}>
              <span className={styles.railBotLoading}>
                <Loader2 size={16} className={styles.railBotSpin} aria-hidden />
                규정에서 찾는 중…
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className={styles.railBotInputBar}>
        <input
          className={styles.railBotInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="규정·조치를 물어보세요"
          maxLength={300}
          disabled={busy}
          aria-label="질문 입력"
        />
        <button type="button" className={styles.railBotSend} onClick={submit}
          disabled={busy || !input.trim()} aria-label="보내기">
          <Send size={18} />
        </button>
      </div>

      {openDoc && (
        <RegulationViewer
          title={openDoc.title}
          url={openDoc.url}
          pdfUrl={openDoc.pdfUrl}
          initialArticle={openDoc.article}
          onClose={() => setOpenDoc(null)}
        />
      )}

      {openBook && (
        <HandbookSectionViewer
          chapterId={openBook.chapterId}
          sectionId={openBook.sectionId}
          fallbackTitle={openBook.title}
          onClose={() => setOpenBook(null)}
        />
      )}
    </div>
  );
}
