'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Users, Target, Disc, Plus, LogIn, Trophy } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import OmokGame from './omok/OmokGame';
import ReversiGame from './reversi/ReversiGame';
import MultiRanking from './MultiRanking';
import styles from './MultiLobby.module.css';

type GameKind = 'omok' | 'reversi';
type Phase =
  | { kind: 'select' }
  | { kind: 'ranking' }
  | { kind: 'mode'; game: GameKind }
  | { kind: 'create'; game: GameKind; code: string }
  | { kind: 'join'; game: GameKind }
  | { kind: 'play'; game: GameKind; code: string; role: 'host' | 'guest' };

function makeRoomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function MultiLobby({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'select' });
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSelectGame = useCallback((game: GameKind) => {
    setPhase({ kind: 'mode', game });
    setError(null);
  }, []);

  const handleCreate = useCallback(() => {
    if (phase.kind !== 'mode') return;
    const code = makeRoomCode();
    setPhase({ kind: 'play', game: phase.game, code, role: 'host' });
  }, [phase]);

  const handleJoinStart = useCallback(() => {
    if (phase.kind !== 'mode') return;
    setPhase({ kind: 'join', game: phase.game });
    setJoinCode('');
    setError(null);
  }, [phase]);

  const handleJoinSubmit = useCallback(() => {
    if (phase.kind !== 'join') return;
    const trimmed = joinCode.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      setError('4자리 숫자를 입력해주세요');
      return;
    }
    setPhase({ kind: 'play', game: phase.game, code: trimmed, role: 'guest' });
  }, [phase, joinCode]);

  const goBack = useCallback(() => {
    if (phase.kind === 'select') { onBack(); return; }
    if (phase.kind === 'mode' || phase.kind === 'play' || phase.kind === 'create' || phase.kind === 'join') {
      setPhase({ kind: 'select' });
      setError(null);
      return;
    }
  }, [phase, onBack]);

  // ── Supabase 미연결 안내 ──
  if (!isSupabaseConfigured) {
    return (
      <div className={styles.wrap}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h2 className={styles.headerTitle}>온라인 대전</h2>
        </div>
        <div className={styles.empty}>
          <p>실시간 서버 연결이 필요합니다.</p>
          <p className={styles.emptySub}>관리자에게 문의해주세요.</p>
        </div>
      </div>
    );
  }

  // ── 랭킹 ──
  if (phase.kind === 'ranking') {
    return <MultiRanking onBack={() => setPhase({ kind: 'select' })} />;
  }

  // ── 게임 진행 ──
  if (phase.kind === 'play') {
    if (phase.game === 'omok') {
      return <OmokGame roomCode={phase.code} role={phase.role} onLeave={() => setPhase({ kind: 'select' })} />;
    }
    return <ReversiGame roomCode={phase.code} role={phase.role} onLeave={() => setPhase({ kind: 'select' })} />;
  }

  // ── 방 코드 입력 ──
  if (phase.kind === 'join') {
    return (
      <div className={styles.wrap}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={goBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h2 className={styles.headerTitle}>방 참여</h2>
        </div>
        <div className={styles.formBody}>
          <p className={styles.formSub}>친구가 알려준 4자리 방 코드를 입력해주세요.</p>
          <input
            type="tel"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            className={styles.codeInput}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="0000"
            aria-label="방 코드 4자리"
            autoFocus
          />
          {error && <p className={styles.errorText}>{error}</p>}
          <button type="button" className={`z-cta ${styles.primaryBtn}`} onClick={handleJoinSubmit}>
            <LogIn size={18} /> 입장
          </button>
        </div>
      </div>
    );
  }

  // ── 게임 선택 후 모드(만들기/참여) ──
  if (phase.kind === 'mode') {
    const gameLabel = phase.game === 'omok' ? '오목' : '오델로';
    return (
      <div className={styles.wrap}>
        <div className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={goBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h2 className={styles.headerTitle}>{gameLabel}</h2>
        </div>
        <div className={styles.modeBody}>
          <button type="button" className={styles.modeCard} onClick={handleCreate}>
            <div className={`${styles.modeIcon} ${styles.modeIconBlue}`}>
              <Plus size={28} strokeWidth={2.5} />
            </div>
            <div className={styles.modeText}>
              <span className={styles.modeLabel}>방 만들기</span>
              <span className={styles.modeDesc}>새 방을 만들고 코드를 공유하세요</span>
            </div>
          </button>
          <button type="button" className={styles.modeCard} onClick={handleJoinStart}>
            <div className={`${styles.modeIcon} ${styles.modeIconGreen}`}>
              <LogIn size={28} strokeWidth={2.5} />
            </div>
            <div className={styles.modeText}>
              <span className={styles.modeLabel}>방 참여</span>
              <span className={styles.modeDesc}>친구가 알려준 4자리 코드 입력</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── 게임 종류 선택 ──
  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h2 className={styles.headerTitle}>온라인 대전</h2>
      </div>
      <div className={styles.modeBody}>
        <p className={styles.formSubInline}>
          <Users size={14} /> <span>두 명이 함께하는 턴제 게임이에요</span>
        </p>
        <button type="button" className={styles.modeCard} onClick={() => setPhase({ kind: 'ranking' })}>
          <div className={`${styles.modeIcon} ${styles.modeIconAmber}`}>
            <Trophy size={28} strokeWidth={2.5} />
          </div>
          <div className={styles.modeText}>
            <span className={styles.modeLabel}>랭킹 보기</span>
            <span className={styles.modeDesc}>오목 · 오델로 Elo 레이팅 순위</span>
          </div>
        </button>
        <button type="button" className={styles.modeCard} onClick={() => handleSelectGame('omok')}>
          <div className={`${styles.modeIcon} ${styles.modeIconBlack}`}>
            <Target size={28} strokeWidth={2.5} />
          </div>
          <div className={styles.modeText}>
            <span className={styles.modeLabel}>오목</span>
            <span className={styles.modeDesc}>먼저 5개를 한 줄로 만든 사람이 승리</span>
          </div>
        </button>
        <button type="button" className={styles.modeCard} onClick={() => handleSelectGame('reversi')}>
          <div className={`${styles.modeIcon} ${styles.modeIconGreen}`}>
            <Disc size={28} strokeWidth={2.5} />
          </div>
          <div className={styles.modeText}>
            <span className={styles.modeLabel}>오델로</span>
            <span className={styles.modeDesc}>돌을 끼워 뒤집기! 더 많은 돌을 차지하세요</span>
          </div>
        </button>
      </div>
    </div>
  );
}
