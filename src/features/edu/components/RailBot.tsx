'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, BookOpen, AlertTriangle, Loader2, Bot } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import RegulationViewer from './RegulationViewer';
import styles from '../styles/edu.module.css';

interface Props { onBack: () => void }

interface SourceRef {
  label: string;
  kind: 'reg' | 'book';
  regId: string | null;
  article: number | null;
  sectionId: string | null;
}

interface Msg {
  role: 'me' | 'bot';
  text: string;
  sources?: SourceRef[];
  /** 차종 되묻기 */
  ask?: { id: string; label: string }[];
  urgent?: boolean;
  error?: boolean;
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
  const endRef = useRef<HTMLDivElement>(null);

  useHistoryBack('railbot', onBack, !openDoc);
  useEscapeClose(!openDoc, onBack);

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
        setMsgs((m) => [...m, { role: 'bot', text: d.answer, sources: d.sources, urgent: d.urgent }]);
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
    if (s.kind !== 'reg' || !s.regId) return;
    const d = docs[s.regId];
    if (!d) return;
    setOpenDoc({ ...d, article: s.article ?? undefined });
  };

  return (
    <div className={styles.screen}>
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
              규정 9종(조문 892개)과 교재를 근거로만 답해요.<br />
              근거를 못 찾으면 지어내지 않고 못 찾았다고 알려드려요.
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
              <p className={styles.railBotText}>{m.text}</p>

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
                      disabled={s.kind !== 'reg' || !s.regId || !docs[s.regId]}
                    >
                      <BookOpen size={12} aria-hidden />
                      {s.label}
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
    </div>
  );
}
