'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Train, Users, Coffee, Sparkles, Share2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import { pickFortune, todayKey, type FortuneCard } from './fortuneData';
import styles from './Fortune.module.css';

interface Props {
  onBack: () => void;
}

const TONE_LABEL: Record<FortuneCard['tone'], string> = {
  'great':  '대길',
  'good':   '중길',
  'so-so':  '평이',
  'care':   '주의',
};

const TONE_STARS: Record<FortuneCard['tone'], number> = {
  'great': 5,
  'good':  4,
  'so-so': 3,
  'care':  2,
};

export default function TodayFortune({ onBack }: Props) {
  const driver = useDriverStore((s) => s.current);
  const authUser = useAuthStore((s) => s.user);
  const sabun = driver?.s ?? authUser?.sabun ?? 'guest';
  const name = driver?.n ?? authUser?.name ?? '기관사';

  const [flipped, setFlipped] = useState(false);
  const dateKey = todayKey();
  const card = useMemo(() => pickFortune(sabun, dateKey), [sabun, dateKey]);
  const stars = TONE_STARS[card.tone];
  const toneLabel = TONE_LABEL[card.tone];

  const dateLabel = useMemo(() => {
    const d = new Date();
    const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dow})`;
  }, []);

  const shareText = `${name} ${toneLabel} ${card.emoji}\n"${card.headline}"\n오늘의 행운 키워드: ${card.luckyKeyword}\n— 기관사 DIA 오늘의 운세`;

  const handleShare = async () => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & { share?: (data: { text: string }) => Promise<void> };
    if (typeof nav.share === 'function') {
      try { await nav.share({ text: shareText }); } catch { /* user cancelled */ }
    } else if (nav.clipboard) {
      try {
        await nav.clipboard.writeText(shareText);
        alert('운세가 복사되었어요. 카톡 등에 붙여넣어 보세요.');
      } catch { /* ignore */ }
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>오늘의 운세</h1>
      </div>

      <div className={styles.body}>
        <p className={styles.dateLine}>{dateLabel} · {name}</p>

        <div
          className={`${styles.card} ${styles[`tone_${card.tone}`]} ${flipped ? styles.cardFlipped : ''}`}
          onClick={() => setFlipped((f) => !f)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFlipped((f) => !f); }}
          aria-label={flipped ? '운세 상세 보기' : '카드 뒤집어서 운세 보기'}
        >
          {!flipped ? (
            <div className={styles.cardFront}>
              <Sparkles size={20} className={styles.cardSparkleTop} />
              <span className={styles.cardBigEmoji}>{card.emoji}</span>
              <span className={styles.cardToneLabel}>{toneLabel}</span>
              <span className={styles.cardStars} aria-label={`${stars}점`}>
                {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
              </span>
              <span className={styles.cardTapHint}>탭하면 펼쳐져요</span>
            </div>
          ) : (
            <div className={styles.cardBack}>
              <span className={styles.cardEmojiSmall}>{card.emoji}</span>
              <h2 className={styles.cardHeadline}>{card.headline}</h2>
              <div className={styles.cardSections}>
                <div className={styles.cardSection}>
                  <Train size={16} className={styles.cardSectionIcon} />
                  <div>
                    <span className={styles.cardSectionLabel}>운전</span>
                    <p className={styles.cardSectionText}>{card.driving}</p>
                  </div>
                </div>
                <div className={styles.cardSection}>
                  <Users size={16} className={styles.cardSectionIcon} />
                  <div>
                    <span className={styles.cardSectionLabel}>동료</span>
                    <p className={styles.cardSectionText}>{card.partner}</p>
                  </div>
                </div>
                <div className={styles.cardSection}>
                  <Coffee size={16} className={styles.cardSectionIcon} />
                  <div>
                    <span className={styles.cardSectionLabel}>일상</span>
                    <p className={styles.cardSectionText}>{card.daily}</p>
                  </div>
                </div>
              </div>
              <div className={styles.cardLuckyBox}>
                <span className={styles.cardLuckyLabel}>오늘의 행운 키워드</span>
                <span className={styles.cardLuckyValue}>{card.luckyKeyword}</span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={`z-glass-pill ${styles.actionBtn}`} data-press onClick={handleShare}>
            <Share2 size={16} />
            <span>공유하기</span>
          </button>
        </div>

        <p className={styles.footnote}>
          매일 자정에 새 운세가 도착해요.<br />
          이건 그냥 재미예요. 너무 진지하게 받아들이지 마세요 ☕
        </p>
      </div>
    </div>
  );
}
