'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send, Mic, MicOff } from 'lucide-react';
import { useDriverStore } from '@/stores/driver';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { matchIntent, QUICK_QUESTIONS } from './intents';
import { handleIntent } from './handlers';
import styles from './Chatbot.module.css';

interface Props {
  onClose: () => void;
}

interface Msg {
  id: string;
  role: 'user' | 'bot';
  text: string;
}

const WELCOME: Msg = {
  id: 'welcome',
  role: 'bot',
  text: '안녕하세요! 답십리 일상 도우미예요 ☕\n날씨·교번·출퇴근 시각 같은 일상 질문을 물어봐주세요.\n아래 추천 질문을 눌러도 좋아요.',
};

export default function ChatbotPanel({ onClose }: Props) {
  const driver = useDriverStore((s) => s.current);
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useHistoryBack('chatbot-panel', onClose, true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    // 새 메시지마다 하단 스크롤
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs]);

  const ask = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    setMsgs((m) => [...m, userMsg]);
    setInput('');
    setThinking(true);
    try {
      const intent = matchIntent(trimmed);
      const answer = await handleIntent(intent, { driver, today: new Date() });
      setMsgs((m) => [...m, { id: `b-${Date.now()}`, role: 'bot', text: answer }]);
    } catch {
      setMsgs((m) => [...m, { id: `b-${Date.now()}`, role: 'bot', text: '답변 중 오류가 났어요. 다시 물어봐주세요' }]);
    } finally {
      setThinking(false);
      // 입력란에 다시 포커스
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [thinking, driver]);

  // 음성 인식 — 최종 결과 받으면 자동 전송
  const speech = useSpeechRecognition({
    onResult: (text) => {
      if (text) ask(text);
    },
    onInterim: (text) => {
      // 인식 중간 결과는 입력란에 미리 채워 사용자가 볼 수 있게
      if (text) setInput(text);
    },
  });

  const toggleMic = useCallback(() => {
    if (speech.listening) speech.stop();
    else { setInput(''); speech.start(); }
  }, [speech]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="일상 도우미 챗봇" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerEmoji}>☕</span>
            <div className={styles.headerTextWrap}>
              <h2 className={styles.headerTitle}>일상 도우미</h2>
              <p className={styles.headerSub}>답십리 날씨·교번·일상 질문</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </header>

        <div ref={listRef} className={styles.msgList}>
          {msgs.map((m) => (
            <div key={m.id} className={`${styles.msgRow} ${m.role === 'user' ? styles.msgRowUser : styles.msgRowBot}`}>
              <div className={`${styles.bubble} ${m.role === 'user' ? styles.bubbleUser : styles.bubbleBot}`}>
                {m.text.split('\n').map((line, i) => (
                  <p key={i} className={styles.bubbleLine}>{line}</p>
                ))}
              </div>
            </div>
          ))}
          {thinking && (
            <div className={`${styles.msgRow} ${styles.msgRowBot}`}>
              <div className={`${styles.bubble} ${styles.bubbleBot}`}>
                <span className={styles.thinking}><span /><span /><span /></span>
              </div>
            </div>
          )}
        </div>

        {/* 빠른 질문 */}
        <div className={styles.quickRow}>
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              className={styles.quickBtn}
              onClick={() => ask(q)}
              disabled={thinking}
            >
              {q}
            </button>
          ))}
        </div>

        {speech.error && (
          <div className={styles.micError}>⚠️ {speech.error}</div>
        )}
        <form className={styles.inputBar} onSubmit={onSubmit}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={speech.listening ? '듣고 있어요...' : '일상 질문을 입력하거나 🎤 눌러 말하세요'}
            autoComplete="off"
            disabled={thinking || speech.listening}
          />
          {speech.supported && (
            <button
              type="button"
              className={`${styles.micBtn} ${speech.listening ? styles.micBtnActive : ''}`}
              onClick={toggleMic}
              disabled={thinking}
              aria-label={speech.listening ? '음성 인식 중지' : '음성으로 말하기'}
            >
              {speech.listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button type="submit" className={styles.sendBtn} disabled={thinking || !input.trim()} aria-label="보내기">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
