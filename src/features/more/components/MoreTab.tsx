'use client';

import { useState } from 'react';
import { useDriverStore } from '@/stores/driver';
import { useThemeStore } from '@/stores/theme';
import { useFontSizeStore, type FontSize } from '@/stores/fontSize';
import { useNotification } from '@/hooks/useNotification';
import { DAILY_TIPS, QUIZ } from '@/data/tips';
import styles from '../styles/More.module.css';

export default function MoreTab() {
  const driver = useDriverStore((s) => s.current);
  const { theme, toggle: toggleTheme } = useThemeStore();
  const { size: fontSize, setSize: setFontSize } = useFontSizeStore();
  const { supported: notifSupported, permission: notifPerm, requestPermission } = useNotification();
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);

  // 오늘의 팁 (날짜 기반)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 864e5);
  const todayTip = DAILY_TIPS[dayOfYear % DAILY_TIPS.length];

  const currentQuiz = QUIZ[quizIdx % QUIZ.length];

  return (
    <div className={styles.container}>
      <h2 className={styles.pageTitle}>설정</h2>

      {/* 현재 기관사 */}
      {driver && (
        <div className={styles.driverCard}>
          <div className={styles.driverAvatar}>{driver.n[0]}</div>
          <div className={styles.driverInfo}>
            <span className={styles.driverNameText}>{driver.n}</span>
            <span className={styles.driverNumText}>{driver.I}번 · 답십리 승무사업소</span>
          </div>
        </div>
      )}

      {/* 설정 섹션 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>설정</h3>

        {/* 다크모드 토글 */}
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingIcon}>{theme === 'dark' ? '🌙' : '☀️'}</span>
            <span className={styles.settingLabel}>다크 모드</span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${theme === 'dark' ? styles.toggleOn : ''}`}
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="다크 모드 토글"
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        {/* 글자 크기 */}
        <div className={styles.fontSizeRow}>
          <div className={styles.fontSizeInfo}>
            <span className={styles.settingIcon}>🔤</span>
            <span className={styles.settingLabel}>글자 크기</span>
          </div>
          <div className={styles.fontSizeBtnGroup}>
            {([
              { key: 'small' as FontSize, label: '작게', cls: styles.fontSizeBtnSmall },
              { key: 'normal' as FontSize, label: '보통', cls: styles.fontSizeBtnNormal },
              { key: 'large' as FontSize, label: '크게', cls: styles.fontSizeBtnLarge },
            ]).map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`${styles.fontSizeBtn} ${opt.cls} ${fontSize === opt.key ? styles.fontSizeBtnActive : ''}`}
                onClick={() => setFontSize(opt.key)}
                aria-pressed={fontSize === opt.key}
                aria-label={`글자 크기 ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 알림 설정 */}
        {notifSupported && (
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <span className={styles.settingIcon}>🔔</span>
              <span className={styles.settingLabel}>알림</span>
            </div>
            {notifPerm === 'granted' ? (
              <span className={styles.settingValue}>허용됨</span>
            ) : notifPerm === 'denied' ? (
              <span className={styles.settingValue}>차단됨</span>
            ) : (
              <button
                type="button"
                className={styles.quizNext}
                onClick={requestPermission}
              >
                허용하기
              </button>
            )}
          </div>
        )}

        {/* 앱 정보 */}
        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingIcon}>ℹ️</span>
            <span className={styles.settingLabel}>버전</span>
          </div>
          <span className={styles.settingValue}>v2.0.0</span>
        </div>
      </section>

      {/* 오늘의 한마디 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>오늘의 한마디</h3>
        <div className={styles.tipCard}>
          <span className={styles.tipIcon}>{todayTip.icon}</span>
          <p className={styles.tipText}>{todayTip.text}</p>
        </div>
      </section>

      {/* 퀴즈 */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>안전 퀴즈</h3>
        <div className={styles.quizCard}>
          <p className={styles.quizQuestion}>{currentQuiz.q}</p>
          <div className={styles.quizOptions}>
            {currentQuiz.a.map((opt, i) => {
              const isCorrect = i === currentQuiz.correct;
              const isSelected = quizAnswer === i;
              const showResult = quizAnswer !== null;
              return (
                <button
                  key={i}
                  type="button"
                  className={`${styles.quizOption} ${showResult && isCorrect ? styles.quizCorrect : ''} ${showResult && isSelected && !isCorrect ? styles.quizWrong : ''}`}
                  onClick={() => setQuizAnswer(i)}
                  disabled={showResult}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {quizAnswer !== null && (
            <div className={styles.quizExplanation}>
              <p>{quizAnswer === currentQuiz.correct ? '정답!' : '오답!'} {currentQuiz.exp}</p>
              <button
                type="button"
                className={styles.quizNext}
                onClick={() => { setQuizIdx((i) => i + 1); setQuizAnswer(null); }}
              >
                다음 문제
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
