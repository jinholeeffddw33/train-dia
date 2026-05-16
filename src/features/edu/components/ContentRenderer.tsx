'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Volume2, Square } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useSpeak } from '@/hooks/useSpeak';
import styles from '../styles/edu.module.css';

/** 안내방송 텍스트로 보이는 callout인지 판정 (따옴표로 시작) */
function looksLikeAnnouncement(text: string): boolean {
  const t = text.trim();
  return t.startsWith('"') || t.startsWith("'") || t.startsWith('“') || t.startsWith('「');
}

/** 듣기용으로 따옴표 등 표기 기호 제거 */
function cleanForSpeech(text: string): string {
  return text.replace(/^["'“「]+|["'”」]+$/g, '').replace(/\s+/g, ' ').trim();
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ContentRendererProps {
  blocks: any[];
}

/* ── 풀스크린 슬라이드 뷰어 ── */
interface SlideViewerProps {
  images: { src: string; caption?: string }[];
  initialIndex: number;
  onClose: () => void;
}

function SlideViewer({ images, initialIndex, onClose }: SlideViewerProps) {
  const [idx, setIdx] = useState(initialIndex);
  const touchRef = useRef<{ startX: number; startY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const goPrev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIdx(i => Math.min(images.length - 1, i + 1)), [images.length]);

  // 키보드 네비게이션
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goPrev, goNext]);

  // 스와이프 처리
  const onTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dy = e.changedTouches[0].clientY - touchRef.current.startY;
    // 수평 스와이프가 수직보다 크고 50px 이상일 때만
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchRef.current = null;
  };

  return (
    <div
      className={styles.slideViewerOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="슬라이드 뷰어"
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* 상단 바 */}
      <div className={styles.slideViewerHeader}>
        <span className={styles.slideViewerCounter}>{idx + 1} / {images.length}</span>
        <button type="button" className={styles.slideViewerClose} onClick={onClose} aria-label="닫기">
          <X size={24} />
        </button>
      </div>

      {/* 슬라이드 이미지 */}
      <div className={styles.slideViewerBody}>
        {idx > 0 && (
          <button type="button" className={`${styles.slideViewerNav} ${styles.slideViewerNavLeft}`} onClick={goPrev} aria-label="이전">
            <ChevronLeft size={28} />
          </button>
        )}
        <img
          src={images[idx].src}
          alt={images[idx].caption || `슬라이드 ${idx + 1}`}
          className={styles.slideViewerImg}
          draggable={false}
        />
        {idx < images.length - 1 && (
          <button type="button" className={`${styles.slideViewerNav} ${styles.slideViewerNavRight}`} onClick={goNext} aria-label="다음">
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      {/* 캡션 */}
      {images[idx].caption && (
        <div className={styles.slideViewerCaption}>{images[idx].caption}</div>
      )}

      {/* 하단 인디케이터 */}
      <div className={styles.slideViewerDots}>
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.slideViewerDot} ${i === idx ? styles.slideViewerDotActive : ''}`}
            onClick={() => setIdx(i)}
            aria-label={`슬라이드 ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function FlowBlock({ title, steps }: { title?: string; steps: any[] }) {
  return (
    <div>
      {title && <div className={styles.heading}>{title}</div>}
      <div className={styles.flowWrap}>
        {steps.map((step: any, i: number) => (
          <div key={i} className={styles.flowStep}>
            <div className={styles.flowDot} />
            <div className={styles.flowItems}>
              {step.items.map((item: string, j: number) => (
                <div key={j} className={styles.flowItem}>{item}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableBlock({ headers, rows, highlightRows }: { headers: string[]; rows: string[][]; highlightRows?: number[] }) {
  const hlSet = highlightRows ? new Set(highlightRows) : null;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((h, i) => <th key={i}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={hlSet?.has(i) ? styles.tableRowHighlight : undefined}>
              {row.map((cell, j) => (
                <td key={j}>{cell.split('\n').map((line, k) => (
                  <span key={k}>{line}{k < cell.split('\n').length - 1 && <br />}</span>
                ))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareBlock({ items }: { items: any[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dia-space-3)' }}>
      {/* STYLE-EXCEPTION: flex-direction은 토큰으로 표현 불가 */}
      {items.map((item: any, i: number) => (
        <div key={i} className={styles.compareCard}>
          <div className={styles.compareTitle}>{item.category}</div>
          <div className={styles.compareRow}>
            {item.abb !== undefined && (
              <div className={styles.compareItem}>
                <div className={styles.compareLabel}>ABB</div>
                <div className={styles.compareText}>{item.abb}</div>
              </div>
            )}
            {item.woojin !== undefined && (
              <div className={styles.compareItem}>
                <div className={styles.compareLabel}>우진</div>
                <div className={styles.compareText}>{item.woojin}</div>
              </div>
            )}
            {item.rotem !== undefined && (
              <div className={styles.compareItem}>
                <div className={styles.compareLabel}>로템</div>
                <div className={styles.compareText}>{item.rotem}</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function isPlainNumber(s: string): boolean {
  return /^[0-9①②③④⑤⑥⑦⑧⑨⑩]+\.?$/.test(s.trim());
}

function ListBlock({ items }: { items: { term: string; desc: string }[] }) {
  return (
    <div className={styles.defList}>
      {items.map((item, i) => {
        const hideNumber = isPlainNumber(item.term) && item.desc;
        return (
          <div key={i} className={styles.defItem}>
            {hideNumber
              ? <div className={styles.defDesc}>{item.desc}</div>
              : <>
                  <div className={styles.defTerm}>{item.term}</div>
                  {item.desc && <div className={styles.defDesc}>{item.desc}</div>}
                </>
            }
          </div>
        );
      })}
    </div>
  );
}

export default function ContentRenderer({ blocks }: ContentRendererProps) {
  const [viewer, setViewer] = useState<{ images: { src: string; caption?: string }[]; index: number } | null>(null);
  const closeViewer = useCallback(() => setViewer(null), []);
  useHistoryBack('slide-viewer', closeViewer, !!viewer);
  const { speak, speakingId, supported: speakSupported } = useSpeak();

  // 모든 이미지 블록에서 이미지를 합산 (풀스크린에서 전체 스와이프용)
  const allImages = blocks
    .filter((b: any) => b.type === 'images')
    .flatMap((b: any) => b.items as { src: string; caption?: string }[]);

  const openViewer = useCallback((blockImages: { src: string; caption?: string }[], localIdx: number) => {
    // 전체 이미지 목록에서의 인덱스 계산
    const targetSrc = blockImages[localIdx].src;
    const globalIdx = allImages.findIndex(img => img.src === targetSrc);
    setViewer({ images: allImages, index: globalIdx >= 0 ? globalIdx : 0 });
  }, [allImages]);

  return (
    <>
      {blocks.map((block: any, i: number) => {
        switch (block.type) {
          case 'heading':
            return <h3 key={i} className={styles.heading}>{block.text}</h3>;
          case 'text':
            return <p key={i} className={styles.textBlock}>{block.text}</p>;
          case 'callout': {
            const isAnnounce = typeof block.text === 'string' && looksLikeAnnouncement(block.text);
            const announceId = `cb-${i}`;
            const isPlaying = speakingId === announceId;
            return (
              <div
                key={i}
                className={`${styles.callout} ${
                  block.variant === 'warning' ? styles.calloutWarning :
                  block.variant === 'danger' ? styles.calloutDanger :
                  styles.calloutInfo
                }`}
              >
                {isAnnounce && speakSupported && (
                  <button
                    type="button"
                    className={`${styles.calloutSpeakBtn} ${isPlaying ? styles.calloutSpeakBtnActive : ''}`}
                    onClick={() => speak(announceId, cleanForSpeech(block.text))}
                    aria-label={isPlaying ? '안내방송 정지' : '안내방송 듣기'}
                  >
                    {isPlaying ? <Square size={14} /> : <Volume2 size={14} />}
                    <span>{isPlaying ? '정지' : '듣기'}</span>
                  </button>
                )}
                {block.text}
              </div>
            );
          }
          case 'flow':
            return <FlowBlock key={i} title={block.title} steps={block.steps} />;
          case 'table':
            return <TableBlock key={i} headers={block.headers} rows={block.rows} highlightRows={block.highlightRows} />;
          case 'compare':
            return <CompareBlock key={i} items={block.items} />;
          case 'list':
            return <ListBlock key={i} items={block.items} />;
          case 'images':
            return (
              <div key={i} className={styles.slideList}>
                {block.items.map((img: { src: string; caption?: string }, j: number) => (
                  <figure key={j} className={styles.slideFigure}>
                    <button
                      type="button"
                      className={styles.slideBtn}
                      onClick={() => openViewer(block.items, j)}
                      aria-label={img.caption || `슬라이드 ${j + 1} 확대`}
                    >
                      <img src={img.src} alt={img.caption || ''} className={styles.slideImg} loading={j < 2 ? 'eager' : 'lazy'} />
                    </button>
                    {img.caption && <figcaption className={styles.slideCaption}>{img.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            );
          default:
            return null;
        }
      })}

      {/* 풀스크린 슬라이드 뷰어 */}
      {viewer && (
        <SlideViewer
          images={viewer.images}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
        />
      )}
    </>
  );
}
