'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, BookOpen, Play, X, FileText, HelpCircle, Train, Users, UserCheck, Award, Warehouse, ChevronRight, FileCog } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import styles from '../styles/edu.module.css';
import RegulationViewer from './RegulationViewer';
import QuizPlayer from './QuizPlayer';

interface TrainingItem {
  id: string;
  title: string;
  category: string;
  slide?: { chapterIds: string[] };
  video?: { youtubeId: string };
  doc?: { url: string; pdfUrl?: string; version?: string };
  quiz?: { url: string };
}

type RegTheme = 'blue' | 'sky' | 'purple' | 'amber' | 'green' | 'rose' | 'teal';

interface RegMeta {
  theme: RegTheme;
  icon: typeof Train;
  subtitle: string;
}

const REG_META: Record<string, RegMeta> = {
  'operation-rules':       { theme: 'blue',   icon: Train,      subtitle: '열차 운전·신호·폐색 기본 원칙' },
  'crew-business-rules':   { theme: 'sky',    icon: BookOpen,   subtitle: '전동차 출고·운전·기기취급 매뉴얼' },
  'crew-management-rules': { theme: 'purple', icon: Users,      subtitle: '승무원 지도·운용·교육 관리' },
  'operating-staff-rules': { theme: 'amber',  icon: UserCheck,  subtitle: '운전관계 직원의 안전 작업' },
  'depot-operation-rules': { theme: 'green',  icon: Warehouse,  subtitle: '차량기지 입·출고 운전 취급' },
  'safety-record-rules':   { theme: 'rose',   icon: Award,      subtitle: '무사고 누적·심사·포상' },
  'detail-operation-rules':{ theme: 'teal',   icon: FileCog,    subtitle: '화재·대용폐색·전령법·고장조치 세부절차' },
};

const THEME_CLASS: Record<RegTheme, string> = {
  blue:   styles.regThemeBlue,
  sky:    styles.regThemeSky,
  purple: styles.regThemePurple,
  amber:  styles.regThemeAmber,
  green:  styles.regThemeGreen,
  rose:   styles.regThemeRose,
  teal:   styles.regThemeTeal,
};

interface TrainingListProps {
  onBack: () => void;
  onSlide: (chapterIds: string[], title?: string) => void;
}

export default function TrainingList({ onBack, onSlide }: TrainingListProps) {
  const [items, setItems] = useState<TrainingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeVideo, setActiveVideo] = useState<{ title: string; youtubeId: string } | null>(null);
  const [activeDoc, setActiveDoc] = useState<{ title: string; url: string; pdfUrl?: string; initialPage?: number } | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<{ title: string; url: string; docUrl?: string; pdfUrl?: string } | null>(null);

  const closePlayer = useCallback(() => setActiveVideo(null), []);
  useHistoryBack('training-video', closePlayer, !!activeVideo);

  const closeDoc = useCallback(() => setActiveDoc(null), []);
  useHistoryBack('training-doc', closeDoc, !!activeDoc);

  const closeQuiz = useCallback(() => setActiveQuiz(null), []);
  useHistoryBack('training-quiz', closeQuiz, !!activeQuiz);

  useEffect(() => {
    fetch('/data/edu/training.json')
      .then(r => r.json())
      .then((data: TrainingItem[]) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.topTitle}>규정</h2>
      </div>

      <div className={styles.trainingListWrap}>
        {loading && (
          <div className={styles.videoEmpty}>
            <p>불러오는 중...</p>
          </div>
        )}

        {error && (
          <div className={styles.videoEmpty}>
            <p>규정 자료를 불러올 수 없어요</p>
            <button
              type="button"
              className={styles.videoRetryBtn}
              onClick={() => window.location.reload()}
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className={styles.videoEmpty}>
            <BookOpen size={40} />
            <p>아직 등록된 규정이 없어요</p>
          </div>
        )}

        {!loading && !error && items.map(item => {
          const meta = REG_META[item.id];
          const themeClass = meta ? THEME_CLASS[meta.theme] : styles.regThemeBlue;
          const Icon = meta?.icon ?? FileText;
          const version = item.doc?.version;
          return (
            <article key={item.id} className={`${styles.regCard} ${themeClass}`}>
              <div className={styles.regCardGlow} aria-hidden />
              <div className={styles.regCardHeader}>
                <div className={styles.regIconWrap}>
                  <Icon size={26} strokeWidth={2} />
                </div>
                <div className={styles.regHeaderText}>
                  <div className={styles.regCategoryRow}>
                    <span className={styles.regCategoryDot} aria-hidden />
                    <span className={styles.regCategoryText}>{item.category}</span>
                    {version && <span className={styles.regVersionChip}>v{version}</span>}
                  </div>
                  <h3 className={styles.regTitle}>{item.title}</h3>
                  {meta?.subtitle && <p className={styles.regSubtitle}>{meta.subtitle}</p>}
                </div>
              </div>

              <div className={styles.regActions}>
                {item.slide && (
                  <button
                    type="button"
                    className={`${styles.regBtn} ${styles.regBtnGhost}`}
                    onClick={() => onSlide(item.slide!.chapterIds, item.title)}
                  >
                    <BookOpen size={17} />
                    <span>슬라이드</span>
                  </button>
                )}
                {item.video && (
                  <button
                    type="button"
                    className={`${styles.regBtn} ${styles.regBtnGhost}`}
                    onClick={() => setActiveVideo({ title: item.title, youtubeId: item.video!.youtubeId })}
                  >
                    <Play size={17} />
                    <span>동영상</span>
                  </button>
                )}
                {item.doc && (
                  <button
                    type="button"
                    className={`${styles.regBtn} ${styles.regBtnSolid}`}
                    onClick={() => setActiveDoc({ title: item.title, url: item.doc!.url, pdfUrl: item.doc!.pdfUrl })}
                  >
                    <FileText size={17} />
                    <span>본문 열기</span>
                    <ChevronRight size={14} className={styles.regBtnArrow} />
                  </button>
                )}
                {item.quiz && (
                  <button
                    type="button"
                    className={`${styles.regBtn} ${styles.regBtnAccent}`}
                    onClick={() => setActiveQuiz({
                      title: item.title,
                      url: item.quiz!.url,
                      docUrl: item.doc?.url,
                      pdfUrl: item.doc?.pdfUrl,
                    })}
                  >
                    <HelpCircle size={17} />
                    <span>문제 풀기</span>
                    <ChevronRight size={14} className={styles.regBtnArrow} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* 규정 본문 뷰어 (검색·하이라이트·원본 PDF 보기) */}
      {activeDoc && (
        <RegulationViewer
          title={activeDoc.title}
          url={activeDoc.url}
          pdfUrl={activeDoc.pdfUrl}
          initialPage={activeDoc.initialPage}
          onClose={closeDoc}
        />
      )}

      {/* 규정 문제 풀이 */}
      {activeQuiz && (
        <QuizPlayer
          title={activeQuiz.title}
          url={activeQuiz.url}
          onClose={closeQuiz}
          onViewBody={(page) => {
            if (activeQuiz.docUrl) {
              setActiveDoc({
                title: activeQuiz.title,
                url: activeQuiz.docUrl,
                pdfUrl: activeQuiz.pdfUrl,
                initialPage: page,
              });
            }
          }}
        />
      )}

      {/* 동영상 풀스크린 플레이어 */}
      {activeVideo && (
        <div
          className={styles.videoPlayerOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={activeVideo.title}
        >
          <div className={styles.videoPlayerHeader}>
            <h3 className={styles.videoPlayerTitle}>{activeVideo.title}</h3>
            <button
              type="button"
              className={styles.videoPlayerClose}
              onClick={closePlayer}
              aria-label="닫기"
            >
              <X size={24} />
            </button>
          </div>
          <div className={styles.videoPlayerBody}>
            <div className={styles.videoIframeWrap}>
              <iframe
                src={`https://www.youtube.com/embed/${activeVideo.youtubeId}?autoplay=1&rel=0`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className={styles.videoIframe}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
