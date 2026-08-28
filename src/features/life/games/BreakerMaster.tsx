'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ArrowLeft, Volume2, VolumeX, Vibrate, VibrateOff, HelpCircle, X, Eye, EyeOff, Image as ImageIcon, List } from 'lucide-react';
import {
  BREAKERS, SWITCHES, BREAKER_QUIZ, STRIPS, SPOTS, itemsOfStrip, labelOf,
  type BreakerQuiz, type StripId,
} from '@/data/breakers';
import GameRanking from './GameRanking';
import { useGameFeedback } from './useGameFeedback';
import styles from './BreakerMaster.module.css';

/**
 * 차단기 마스터 — "이 증상이면 어느 차단기인가"를 배전반에서 직접 찾아 내리는 게임.
 *
 * 위치를 외우게 하는 게임이 아니다(진호 요청). 위치는 문제를 푸는 동안 저절로 익는 것이고,
 * 물어야 할 것은 언제나 "증상 → 차단기"다. 그래서 「ATCN1 어디?」 같은 문제는 내지 않는다.
 *
 * 한 판 5문제. 문제마다 기회는 두 번.
 *   첫 번째에 맞히면 100점, 두 번째에 맞히면 50점, 둘 다 틀리면 0점 + 정답 공개.
 * 틀린 문제는 판이 끝난 뒤 다시 풀 수 있다 — 다만 점수에는 넣지 않는다.
 * 넣으면 일부러 틀리고 다시 푸는 쪽이 이득이 되어 기록이 의미를 잃는다.
 */

interface Props {
  onBack: () => void;
}

const ROUND_SIZE = 5;
const SCORE_FIRST = 100;
const SCORE_SECOND = 50;
const MAX_TRIES = 2;

/** 문제에 쓸 수 있는 것만 — 라벨이 가려 못 읽은 차단기가 정답인 문제는 만들지 않았다 */
const QUIZ_POOL = BREAKER_QUIZ;

type Phase = 'idle' | 'ask' | 'reveal' | 'result';

interface Attempt {
  quiz: BreakerQuiz;
  /** 몇 번째 시도에 맞혔나. 0 = 못 맞힘 */
  gotOn: 0 | 1 | 2;
  score: number;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const ROW_TITLE: Record<number, string> = { 1: '윗줄', 2: '가운뎃줄', 3: '아랫줄' };

export default function BreakerMaster({ onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [quizzes, setQuizzes] = useState<BreakerQuiz[]>([]);
  const [idx, setIdx] = useState(0);
  const [tries, setTries] = useState(0);
  /** 이번 문제에서 이미 내려 본 것 — 같은 걸 또 눌러도 기회가 깎이지 않게 */
  const [picked, setPicked] = useState<string[]>([]);
  /** 정답이 둘인 문제에서 지금까지 맞게 고른 것 */
  const [hit, setHit] = useState<string[]>([]);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [labelsOn, setLabelsOn] = useState(true);
  const [help, setHelp] = useState(false);
  /* 실제 사진으로 볼 것인가 — 진호 요청. 사진이면 실물과 같은 자리라 위치도 함께 익는다.
     목록은 글씨가 커서 찾기 쉬우니 남겨 둔다. */
  const [photo, setPhoto] = useState(true);
  const [strip, setStrip] = useState<StripId>('row1');
  /** 다시 풀기 중인가 — 점수에 넣지 않는다 */
  const [review, setReview] = useState(false);

  const { feedback, soundOn, vibrateOn, toggleSound, toggleVibrate } = useGameFeedback();
  const fbRef = useRef(feedback);
  useEffect(() => { fbRef.current = feedback; }, [feedback]);
  const play = useCallback((k: Parameters<typeof feedback>[0]) => fbRef.current(k), []);

  const timerRef = useRef<number | null>(null);
  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  const BEST_KEY = 'traindia-breakermaster-best';
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial sync from localStorage
      if (raw) setBest(Number(raw) || 0);
    } catch { /* ignore */ }
  }, []);

  const quiz = quizzes[idx];
  const answered = phase === 'reveal';

  /** 한 판 시작 */
  const start = useCallback((list?: BreakerQuiz[]) => {
    const picks = list ?? shuffle(QUIZ_POOL).slice(0, ROUND_SIZE);
    setQuizzes(picks);
    setReview(!!list);
    setIdx(0); setTries(0); setPicked([]); setHit([]);
    setWrongFlash(null); setAttempts([]); setScore(0);
    setPhase('ask');
    play('button');
  }, [play]);

  /** 이 문제를 끝내고 정답 공개로 */
  const finishQuestion = useCallback((gotOn: 0 | 1 | 2) => {
    const gained = review ? 0 : gotOn === 1 ? SCORE_FIRST : gotOn === 2 ? SCORE_SECOND : 0;
    setScore((s) => s + gained);
    setAttempts((a) => [...a, { quiz: quizzes[idx], gotOn, score: gained }]);
    setPhase('reveal');
  }, [idx, quizzes, review]);

  /** 배전반에서 하나를 취급했다 */
  const pick = useCallback((id: string) => {
    if (phase !== 'ask' || !quiz) return;
    if (hit.includes(id)) return;                    // 이미 맞게 고른 것

    if (quiz.answer.includes(id)) {
      const nextHit = [...hit, id];
      setHit(nextHit);
      if (nextHit.length < quiz.answer.length) {
        play('tick');                                 // 정답이 둘 — 아직 하나 남았다
        return;
      }
      play('success');
      finishQuestion((tries + 1) as 1 | 2);
      return;
    }

    // 오답
    if (picked.includes(id)) return;                  // 같은 오답을 또 눌렀다 — 기회는 그대로
    setPicked((p) => [...p, id]);
    setWrongFlash(id);
    play('buzzer');
    window.setTimeout(() => setWrongFlash(null), 620);

    const used = tries + 1;
    setTries(used);
    if (used >= MAX_TRIES) {
      timerRef.current = window.setTimeout(() => finishQuestion(0), 500);
    } else {
      setHit([]);                                     // 두 번째 기회는 처음부터
    }
  }, [phase, quiz, hit, picked, tries, play, finishQuestion]);

  /** 다음 문제 (또는 결과) */
  const next = useCallback(() => {
    if (idx + 1 >= quizzes.length) {
      const total = attempts.reduce((n, a) => n + a.score, 0);
      if (!review) {
        if (total > best) {
          setBest(total);
          try { localStorage.setItem(BEST_KEY, String(total)); } catch { /* ignore */ }
        }
        fetch('/api/games/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game: 'breaker', score: total }),
        }).catch(() => {});
        play(total >= ROUND_SIZE * SCORE_FIRST ? 'record' : 'gameover');
      } else {
        play('button');
      }
      setPhase('result');
      return;
    }
    setIdx((i) => i + 1);
    setTries(0); setPicked([]); setHit([]); setWrongFlash(null);
    setPhase('ask');
  }, [idx, quizzes.length, attempts, best, review, play]);

  /* 정답이 나오면 그 차단기가 있는 줄로 옮기고, 그 자리가 보이게 밀어 준다 —
     어디였는지 눈으로 봐야 남는다. 화면 밖에 있으면 알려 줘도 못 본다. */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (phase !== 'reveal' || !quiz) return;
    const s = SPOTS[quiz.answer[0]]?.strip;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 정답 공개에 맞춰 보이는 줄을 옮긴다
    if (s) setStrip(s);
  }, [phase, quiz]);

  useEffect(() => {
    if (phase !== 'reveal' || !quiz || !photo) return;
    const el = scrollRef.current;
    const spot = SPOTS[quiz.answer[0]];
    if (!el || !spot || spot.strip !== strip) return;
    const target = spot.x * STRIPS[strip].w - el.clientWidth / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [phase, quiz, photo, strip]);

  const wrongOnes = useMemo(
    () => attempts.filter((a) => a.gotOn === 0).map((a) => a.quiz),
    [attempts],
  );
  const firstTry = attempts.filter((a) => a.gotOn === 1).length;
  const secondTry = attempts.filter((a) => a.gotOn === 2).length;

  /** 지금 이 차단기가 어떤 꼴로 보여야 하나 */
  const stateOf = (id: string) => ({
    isAnswer: answered && !!quiz?.answer.includes(id),
    isWrong: wrongFlash === id,
    isHit: hit.includes(id),
    wasPicked: picked.includes(id),
  });

  /** ── 사진 배전반 ──
      실물 사진을 줄별로 잘라 놓고 그 위에 투명한 버튼을 얹는다. 자리가 실물과 같으니
      문제를 푸는 동안 "그 차단기가 어디쯤 있었다"가 손에 남는다. */
  const renderPhoto = () => {
    const s = STRIPS[strip];
    const ids = itemsOfStrip(strip);
    const spotW = strip === 'sw' ? 86 : 48;
    const spotH = strip === 'sw' ? 86 : 120;
    return (
      <div className={styles.photoBoard}>
        <div className={styles.tabs}>
          {(Object.keys(STRIPS) as StripId[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`${styles.tab} ${strip === k ? styles.tabOn : ''}`}
              onClick={() => setStrip(k)}
              aria-pressed={strip === k}
            >
              {STRIPS[k].title}
            </button>
          ))}
        </div>
        {/* 가로로 미는 판 — swipe-guard 가 없으면 미는 동작이 교번/더보기 이동으로 새어 나간다 */}
        <div className={styles.photoScroll} data-swipe-guard ref={scrollRef}>
          {/* STYLE-EXCEPTION: 사진 조각마다 크기가 달라 CSS 로 못 적는다 */}
          <div className={styles.photoInner} style={{ width: s.w, height: s.h }}>
            <img
              src={s.src}
              alt={`운전실 배전반 ${s.title}`}
              width={s.w}
              height={s.h}
              className={styles.photoImg}
              draggable={false}
            />
            {ids.map((id) => {
              const p = SPOTS[id];
              const st = stateOf(id);
              const spare = id.startsWith('SPARE');
              return (
                <button
                  key={id}
                  type="button"
                  className={[
                    styles.spot,
                    st.isHit ? styles.spotHit : '',
                    st.isWrong ? styles.spotWrong : '',
                    st.wasPicked && !st.isWrong ? styles.spotUsed : '',
                    st.isAnswer ? styles.spotAnswer : '',
                  ].filter(Boolean).join(' ')}
                  /* STYLE-EXCEPTION: 사진 위 실제 좌표 — 차단기마다 다르다 */
                  style={{
                    left: p.x * s.w - spotW / 2,
                    top: p.y * s.h - spotH / 2,
                    width: spotW,
                    height: spotH,
                  }}
                  onClick={() => pick(id)}
                  disabled={phase !== 'ask' || spare}
                  aria-label={`${id} ${labelOf(id)}`}
                >
                  {(st.isAnswer || st.isHit) && <span className={styles.spotTag}>{id}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <p className={styles.photoHint}>옆으로 밀어서 찾으세요 · 줄은 위 단추로 바꿉니다</p>
      </div>
    );
  };

  /** 배전반 한 줄 (목록 보기) */
  const renderRow = (row: 1 | 2 | 3) => (
    <div className={styles.rowBlock} key={row}>
      <span className={styles.rowTitle}>{ROW_TITLE[row]}</span>
      <div className={styles.chips}>
        {BREAKERS.filter((b) => b.row === row).map((b) => {
          const isAnswer = answered && quiz?.answer.includes(b.id);
          const isWrong = wrongFlash === b.id;
          const isHit = hit.includes(b.id);
          const wasPicked = picked.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              className={[
                styles.chip,
                b.spare ? styles.chipSpare : '',
                b.red ? styles.chipRed : '',
                isHit ? styles.chipHit : '',
                isWrong ? styles.chipWrong : '',
                wasPicked && !isWrong ? styles.chipUsed : '',
                isAnswer ? styles.chipAnswer : '',
              ].filter(Boolean).join(' ')}
              onClick={() => pick(b.id)}
              disabled={phase !== 'ask' || b.spare}
            >
              <span className={styles.chipCode}>{b.id.replace(/^SPARE\d$/, 'SPARE')}</span>
              {labelsOn && <span className={styles.chipKo}>{b.ko}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.headerTitle}>차단기 마스터</h1>
        {phase !== 'idle' && !review && (
          <span className={styles.roundBadge}>{Math.min(idx + 1, ROUND_SIZE)} / {ROUND_SIZE}</span>
        )}
        {review && <span className={styles.roundBadge}>다시 풀기</span>}
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setPhoto((v) => !v)}
          aria-label={photo ? '목록으로 보기' : '실제 사진으로 보기'}
          aria-pressed={photo}
        >
          {photo ? <List size={18} strokeWidth={2} /> : <ImageIcon size={18} strokeWidth={2} />}
        </button>
        {!photo && (
          <button
            type="button"
            className={`${styles.toggleBtn} ${!labelsOn ? styles.toggleBtnOff : ''}`}
            onClick={() => setLabelsOn((v) => !v)}
            aria-label={labelsOn ? '우리말 라벨 감추기' : '우리말 라벨 보기'}
            aria-pressed={labelsOn}
          >
            {labelsOn ? <Eye size={18} strokeWidth={2} /> : <EyeOff size={18} strokeWidth={2} />}
          </button>
        )}
        <button
          type="button"
          className={`${styles.toggleBtn} ${!soundOn ? styles.toggleBtnOff : ''}`}
          onClick={toggleSound}
          aria-label={soundOn ? '효과음 끄기' : '효과음 켜기'}
          aria-pressed={soundOn}
        >
          {soundOn ? <Volume2 size={18} strokeWidth={2} /> : <VolumeX size={18} strokeWidth={2} />}
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${!vibrateOn ? styles.toggleBtnOff : ''}`}
          onClick={toggleVibrate}
          aria-label={vibrateOn ? '진동 끄기' : '진동 켜기'}
          aria-pressed={vibrateOn}
        >
          {vibrateOn ? <Vibrate size={18} strokeWidth={2} /> : <VibrateOff size={18} strokeWidth={2} />}
        </button>
      </header>

      {/* ── 시작 ── */}
      {phase === 'idle' && (
        <div className={styles.panel}>
          <div className={styles.hero}>
            <div className={styles.heroPanel} aria-hidden>
              {[0, 1, 2].map((r) => (
                <div className={styles.heroRow} key={r}>
                  {Array.from({ length: 9 }, (_, i) => (
                    <span
                      key={i}
                      className={`${styles.heroSw} ${(r * 9 + i) % 7 === 3 ? styles.heroSwOff : ''}`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <p className={styles.heroLead}>증상을 보고 <b>내릴 차단기</b>를 찾으세요</p>
            <p className={styles.heroSub}>기회는 두 번 · 한 판 {ROUND_SIZE}문제</p>
          </div>

          <div className={styles.startStats}>
            <div className={styles.startStat}>
              <span className={styles.startStatLabel}>최고 점수</span>
              <b className={styles.startStatValue}>{best > 0 ? best.toLocaleString() : '—'}</b>
            </div>
            <div className={styles.startStat}>
              <span className={styles.startStatLabel}>문제</span>
              <b className={styles.startStatValue}>{QUIZ_POOL.length}</b>
            </div>
            <div className={styles.startStat}>
              <span className={styles.startStatLabel}>만점</span>
              <b className={styles.startStatValue}>{ROUND_SIZE * SCORE_FIRST}</b>
            </div>
          </div>

          <button type="button" className={styles.primaryBtn} onClick={() => start()}>출발</button>
          <button type="button" className={styles.ghostBtn} onClick={() => setHelp(true)}>
            <HelpCircle size={15} strokeWidth={2.2} />
            자세한 규칙
          </button>

          {help && (
            <div className={styles.rulesCard}>
              <div className={styles.rulesHead}>
                <h2 className={styles.rulesTitle}>규칙</h2>
                <button type="button" className={styles.rulesClose} onClick={() => setHelp(false)} aria-label="닫기">
                  <X size={16} strokeWidth={2.4} />
                </button>
              </div>
              <ul className={styles.rules}>
                <li>증상이 나오면 배전반에서 <b>내릴 차단기</b>를 누릅니다.</li>
                <li>맞히면 <b>{SCORE_FIRST}점</b>, 틀리면 부저가 울리고 <b>한 번 더</b> 기회가 있습니다. 두 번째에 맞히면 <b>{SCORE_SECOND}점</b>.</li>
                <li>두 번 다 틀리면 <b>정답을 알려주고</b> 다음 문제로 넘어갑니다.</li>
                <li>정답이 둘인 문제는 <b>둘 다</b> 눌러야 맞습니다.</li>
                <li>한 판은 {ROUND_SIZE}문제, 만점은 {ROUND_SIZE * SCORE_FIRST}점입니다.</li>
                <li>틀린 문제는 끝나고 <b>다시 풀 수 있습니다.</b> 다만 <b>점수에는 넣지 않습니다</b> — 공부용입니다.</li>
                <li>눈 아이콘으로 <b>우리말 라벨을 감출</b> 수 있습니다. 익숙해지면 감추고 해 보세요.</li>
              </ul>
            </div>
          )}

          <GameRanking game="breaker" scoreLabel="점수" scoreUnit="점" />
        </div>
      )}

      {/* ── 문제 · 정답 공개 ── */}
      {(phase === 'ask' || phase === 'reveal') && quiz && (
        <div className={styles.play}>
          <div className={styles.askCard}>
            <p className={styles.symptom}>{quiz.symptom}</p>
            <div className={styles.askMeta}>
              {quiz.answer.length > 1 && (
                <span className={styles.multiTag}>{quiz.answer.length}개를 모두</span>
              )}
              <span className={styles.tries} aria-label={`남은 기회 ${MAX_TRIES - tries}회`}>
                {Array.from({ length: MAX_TRIES }, (_, i) => (
                  <span key={i} className={`${styles.tryDot} ${i < tries ? styles.tryDotUsed : ''}`} />
                ))}
              </span>
            </div>
          </div>

          {answered && (
            <div className={`${styles.answerCard} ${attempts[attempts.length - 1]?.gotOn === 0 ? styles.answerCardBad : ''}`}>
              <div className={styles.answerTop}>
                <span className={styles.answerCode}>{quiz.answer.join(' + ')}</span>
                <span className={styles.answerKo}>{quiz.answer.map(labelOf).join(' · ')}</span>
              </div>
              <p className={styles.answerWhy}>{quiz.explain}</p>
              {quiz.trap && <p className={styles.answerTrap}>{quiz.trap}</p>}
              <p className={styles.answerSrc}>{quiz.src}</p>
              <button type="button" className={styles.primaryBtn} onClick={next}>
                {idx + 1 >= quizzes.length ? '결과 보기' : '다음 문제'}
              </button>
            </div>
          )}

          {photo && renderPhoto()}

          {/* 배전반 — 실물 3단 구성 그대로 묶었다 */}
          {!photo && (
          <div className={styles.board}>
            {([1, 2, 3] as const).map(renderRow)}

            <div className={styles.rowBlock}>
              <span className={styles.rowTitle}>돌리는 스위치</span>
              <div className={styles.chips}>
                {SWITCHES.map((s) => {
                  const isAnswer = answered && quiz.answer.includes(s.id);
                  const isWrong = wrongFlash === s.id;
                  const isHit = hit.includes(s.id);
                  const wasPicked = picked.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={[
                        styles.chip, styles.chipSwitch,
                        isHit ? styles.chipHit : '',
                        isWrong ? styles.chipWrong : '',
                        wasPicked && !isWrong ? styles.chipUsed : '',
                        isAnswer ? styles.chipAnswer : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => pick(s.id)}
                      disabled={phase !== 'ask'}
                    >
                      <span className={styles.chipCode}>{s.id}</span>
                      {labelsOn && <span className={styles.chipKo}>{s.ko}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          )}

          <div className={styles.foot}>
            <span className={styles.footItem}>문제 <b>{idx + 1}</b> / {quizzes.length}</span>
            <span className={styles.footItem}>{review ? '연습 중 — 점수 없음' : <>점수 <b>{score.toLocaleString()}</b></>}</span>
          </div>
        </div>
      )}

      {/* ── 결과 ── */}
      {phase === 'result' && (
        <div className={styles.panel}>
          <p className={styles.resultTitle}>{review ? '다시 풀기 끝' : '한 판 끝'}</p>

          {!review && (
            <div className={styles.resultScore}>
              <span className={styles.resultScoreV}>{score.toLocaleString()}</span>
              <span className={styles.resultScoreU}>점</span>
            </div>
          )}

          <p className={styles.resultLine}>
            한 번에 <b>{firstTry}</b> · 두 번째에 <b>{secondTry}</b> · 못 맞힘 <b>{wrongOnes.length}</b>
          </p>
          {!review && score >= best && score > 0 && <p className={styles.record}>신기록입니다</p>}

          {attempts.length > 0 && (
            <div className={styles.review}>
              <h3 className={styles.reviewTitle}>이번 판 다시 보기</h3>
              <ul className={styles.reviewList}>
                {attempts.map((a) => (
                  <li key={a.quiz.id} className={a.gotOn === 0 ? styles.reviewBad : ''}>
                    <b>{a.quiz.answer.join(' + ')}</b>
                    <span className={styles.reviewKo}>{a.quiz.answer.map(labelOf).join(' · ')}</span>
                    <small>{a.quiz.symptom}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {wrongOnes.length > 0 && (
            <button type="button" className={styles.primaryBtn} onClick={() => start(shuffle(wrongOnes))}>
              틀린 {wrongOnes.length}문제 다시 풀기
            </button>
          )}
          <button
            type="button"
            className={wrongOnes.length > 0 ? styles.ghostBtn : styles.primaryBtn}
            onClick={() => start()}
          >
            새 문제로 다시
          </button>

          <GameRanking game="breaker" scoreLabel="점수" scoreUnit="점" />
        </div>
      )}
    </div>
  );
}
