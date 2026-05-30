'use client';

import { useEffect } from 'react';
import { X, Download } from 'lucide-react';
import styles from './Hazard.module.css';

interface Props {
  url: string;
  onClose: () => void;
}

/** URL 확장자가 이미지면 inline, 그 외(PDF·문서 등)는 다운로드 버튼 표시 */
function isImage(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|heic|bmp|avif)(\?|$|#)/i.test(url);
}

export default function AttachmentLightbox({ url, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const image = isImage(url);

  return (
    <div
      className={styles.lightboxOverlay}
      role="dialog"
      aria-modal="true"
      aria-label="첨부파일 보기"
      onClick={onClose}
    >
      <button
        type="button"
        className={styles.lightboxClose}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="닫기"
      >
        <X size={22} strokeWidth={2.4} />
      </button>
      {image ? (
        <img
          src={url}
          alt="첨부 파일"
          className={styles.lightboxImage}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className={styles.lightboxFile} onClick={(e) => e.stopPropagation()}>
          <p className={styles.lightboxFileText}>이 파일은 미리보기를 지원하지 않습니다.</p>
          <a
            href={url}
            download
            rel="noopener noreferrer"
            className={styles.lightboxDownloadBtn}
          >
            <Download size={16} /> 파일 다운로드
          </a>
        </div>
      )}
    </div>
  );
}
