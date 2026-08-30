'use client';

import { useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, X } from 'lucide-react';
import { useRegulationReader, articleTitle } from '../hooks/useRegulationReader';
import styles from './RegulationReader.module.css';

interface Props {
  regulationId: string;
  /** 지금 보고 있는 조문 — 여기서부터 읽는다 */
  startArticle?: number;
  onClose: () => void;
  /** 읽는 조문이 바뀔 때 본문을 따라 스크롤시키기 위한 통지 */
  onArticleChange?: (n: number) => void;
}

const SPEEDS = [0.8, 1, 1.2, 1.5];

export default function RegulationReader({ regulationId, startArticle, onClose, onArticleChange }: Props) {
  const r = useRegulationReader(regulationId);
  const { current, status, chunks, chunkIdx, articles, seek } = r;

  /* 열자마자 «보던 조문» 을 띄운다. 이걸 안 하면 재생을 누르기 전까지 늘 제1조가 보여
     "재생을 누르면 이 조문부터" 라는 안내와 어긋난다. 조문 목록이 오면 한 번만 맞춘다. */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !articles || startArticle == null) return;
    seeded.current = true;
    seek(startArticle);
  }, [articles, startArticle, seek]);

  // 재생 중일 때만 본문을 따라 스크롤한다. 열자마자(idle) 통지하면 보던 자리를 잃고
  // 무조건 제1조로 튀어 버린다 — 읽기 시작한 조문부터 따라가야 한다.
  useEffect(() => { if (current && status !== 'idle') onArticleChange?.(current.n); }, [current, status, onArticleChange]);

  if (!r.supported) {
    return (
      <div className={styles.panel}>
        <p className={styles.msg}>이 브라우저는 음성 읽기를 지원하지 않아요. 크롬이나 사파리에서 열어주세요.</p>
        <button type="button" className={styles.ctlBtn} onClick={onClose}>닫기</button>
      </div>
    );
  }
  if (r.loadError) {
    return (
      <div className={styles.panel}>
        <p className={styles.msg}>이 규정은 아직 음성 읽기를 준비하지 못했어요.</p>
        <button type="button" className={styles.ctlBtn} onClick={onClose}>닫기</button>
      </div>
    );
  }
  if (!r.articles) {
    return <div className={styles.panel}><p className={styles.msg}>조문을 불러오는 중…</p></div>;
  }

  const line = chunks[chunkIdx];
  const playing = status === 'playing';

  return (
    <div className={styles.panel} role="region" aria-label="규정 음성 읽기">
      <div className={styles.nowRow}>
        <span className={styles.nowArt}>
          {current ? `제${current.n}조 ${articleTitle(current.title)}`.trim() : '읽을 조문이 없어요'}
        </span>
        <span className={styles.nowCount}>{r.index + 1}/{r.total}</span>
        <button type="button" className={styles.closeBtn} onClick={() => { r.stop(); onClose(); }} aria-label="음성 읽기 닫기">
          <X size={20} />
        </button>
      </div>

      {/* 승강장처럼 시끄러운 곳에서 소리가 묻히면 눈으로 따라간다 */}
      <p
        className={`${styles.line} ${line?.kind === 'notice' ? styles.lineNotice : ''} ${!line ? styles.lineIdle : ''}`}
        aria-live="polite"
      >
        {line ? line.text : '재생을 누르면 이 조문부터 이어서 읽어드려요.'}
      </p>

      <div className={styles.controls}>
        <button type="button" className={styles.ctlBtn} onClick={() => r.jump(-1)} disabled={r.index === 0} aria-label="이전 조문">
          <SkipBack size={18} />
        </button>
        <button
          type="button"
          className={`${styles.ctlBtn} ${styles.playBtn}`}
          onClick={() => {
            if (playing) r.pause();
            else if (status === 'paused') r.resume();
            else r.play(startArticle);
          }}
          aria-label={playing ? '일시정지' : '읽기 시작'}
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
          <span>{playing ? '일시정지' : status === 'paused' ? '이어 듣기' : '읽어주기'}</span>
        </button>
        <button type="button" className={styles.ctlBtn} onClick={() => r.jump(1)} disabled={r.index >= r.total - 1} aria-label="다음 조문">
          <SkipForward size={18} />
        </button>
      </div>

      {/* 미리 합성한 음성이 있으면 그걸 쓴다 — 안내방송과 같은 목소리다.
          기기 음성 선택은 이때 의미가 없어 감춘다(못 받으면 자동으로 넘어간다). */}
      {r.usingRecorded && (
        <p className={styles.voiceNote}>안내방송과 같은 목소리로 읽어드려요</p>
      )}

      {/* 목소리 선택기는 없앴다 — 기기마다 가장 자연스러운 한국어 음성을 자동으로 고른다.
          50~60대 사용자에게 "무슨 목소리를 골라야 하나" 묻는 화면은 군더더기다. */}

      <div className={styles.speedRow}>
        <span className={styles.speedLabel}>속도</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.speedBtn} ${r.rate === s ? styles.speedOn : ''}`}
            onClick={() => r.setRate(s)}
            aria-pressed={r.rate === s}
          >
            {s}배
          </button>
        ))}
      </div>
    </div>
  );
}
