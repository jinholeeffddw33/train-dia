'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, X, ImageIcon, ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import { DOW } from '@/lib/constants';
import StandbyCoverageForm from './StandbyCoverageForm';
import styles from './StandbyCoverage.module.css';

interface Coverage {
  id: string;
  targetDate: string;
  imageUrl: string;
  uploadedBy: { sabun: string; name: string };
  createdAt: string;
  // reads는 서버에서 계속 내려오지만 현재 UI에서는 비표시 (재활성화 대비 유지)
  reads: { sabun: string; name: string; readAt: string }[];
}

function formatTitle(targetDate: string): string {
  const [y, m, d] = targetDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = DOW[dt.getDay()];
  return `${m}월 ${d}일(${dow}) 대기충당현황`;
}

interface Props {
  onBack: () => void;
}

export default function StandbyCoverageView({ onBack }: Props) {
  const [items, setItems] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const authUser = useAuthStore((s) => s.user);
  const driverSabun = useDriverStore((s) => s.myDriver?.s ?? '');
  const driverName = useDriverStore((s) => s.myDriver?.n ?? '');
  const sabun = authUser?.sabun || driverSabun;
  const name = authUser?.name || driverName;

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/standby-coverage', { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as { data: Coverage[] };
      setItems(json.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.title}>대기충당확인</h1>
        <button
          type="button"
          className={`z-glass-pill ${styles.addBtn}`}
          data-press
          onClick={() => setShowForm(true)}
          aria-label="대기충당현황 등록"
        >
          <Plus size={16} strokeWidth={2.4} />
          <span>등록</span>
        </button>
      </header>

      <main className={styles.content}>
        {loading ? (
          <div className={styles.loadingState}>
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
            <span className={styles.loadingDot} />
          </div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <ImageIcon size={48} className={styles.emptyIcon} aria-hidden />
            <p className={styles.emptyText}>최근 3일 안에 등록된 기록이 없어요</p>
            <p className={styles.emptyHint}>&quot;+ 등록&quot; 버튼으로 대기충당기록부 사진을 올려주세요</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {items.map((it) => (
              <li key={it.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>{formatTitle(it.targetDate)}</h2>
                </div>
                <button
                  type="button"
                  className={styles.cardImageBtn}
                  onClick={() => setZoomImage(it.imageUrl)}
                  aria-label="사진 크게 보기"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.imageUrl} alt={formatTitle(it.targetDate)} className={styles.cardImage} />
                </button>
                <div className={styles.cardFoot}>
                  <span className={styles.cardUploadedBy}>
                    등록 · {it.uploadedBy.name}
                  </span>
                </div>
                <div className={styles.cafeNotice}>
                  <ExternalLink size={14} strokeWidth={2.4} aria-hidden />
                  <span>대기충당 확인 기록은 카페에 등록하세요</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {showForm && (
        <StandbyCoverageForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchItems(); }}
          sabun={sabun}
          name={name}
        />
      )}

      {zoomImage && (
        <div className={styles.zoomOverlay} role="dialog" aria-modal="true" onClick={() => setZoomImage(null)}>
          <button
            type="button"
            className={styles.zoomCloseBtn}
            onClick={() => setZoomImage(null)}
            aria-label="닫기"
          >
            <X size={22} strokeWidth={2.4} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomImage} alt="대기충당현황 크게 보기" className={styles.zoomImage} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
