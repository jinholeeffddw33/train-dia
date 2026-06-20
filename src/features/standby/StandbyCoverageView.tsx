'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, Check, X, ImageIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import { DOW } from '@/lib/constants';
import StandbyCoverageForm from './StandbyCoverageForm';
import styles from './StandbyCoverage.module.css';

interface CoverageRead {
  sabun: string;
  name: string;
  readAt: string;
}

interface Coverage {
  id: string;
  targetDate: string;
  imageUrl: string;
  uploadedBy: { sabun: string; name: string };
  createdAt: string;
  reads: CoverageRead[];
}

function formatTitle(targetDate: string): string {
  const [y, m, d] = targetDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = DOW[dt.getDay()];
  return `${m}월 ${d}일(${dow}) 대기충당현황`;
}

function formatReadTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

  const handleConfirm = useCallback(async (id: string) => {
    if (!sabun || !name) return;
    try {
      const res = await fetch(`/api/standby-coverage/${id}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sabun, name }),
      });
      if (res.ok) fetchItems();
    } catch { /* ignore */ }
  }, [sabun, name, fetchItems]);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.title}>대기충당확인</h1>
        <button
          type="button"
          className={styles.addBtn}
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
            <p className={styles.emptyHint}>"+ 등록" 버튼으로 대기충당기록부 사진을 올려주세요</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {items.map((it) => {
              const confirmed = it.reads.some((r) => r.sabun === sabun);
              return (
                <li key={it.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.cardTitle}>{formatTitle(it.targetDate)}</h2>
                    {confirmed && (
                      <span className={styles.cardConfirmBadge}>
                        <Check size={12} strokeWidth={3} /> 확인 완료
                      </span>
                    )}
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
                    {!confirmed && (
                      <button
                        type="button"
                        className={styles.confirmBtn}
                        onClick={() => handleConfirm(it.id)}
                      >
                        <Check size={14} strokeWidth={2.5} /> 확인했어요
                      </button>
                    )}
                  </div>
                  <div className={styles.readersBlock}>
                    <div className={styles.readersHead}>
                      <span className={styles.readersLabel}>확인한 기관사</span>
                      <span className={styles.readersCount}>{it.reads.length}명</span>
                    </div>
                    {it.reads.length === 0 ? (
                      <p className={styles.readersEmpty}>아직 확인한 사람이 없어요</p>
                    ) : (
                      <ul className={styles.readersList}>
                        {it.reads
                          .slice()
                          .sort((a, b) => b.readAt.localeCompare(a.readAt))
                          .map((r) => (
                            <li
                              key={r.sabun}
                              className={`${styles.readerItem} ${r.sabun === sabun ? styles.readerItemMine : ''}`}
                            >
                              <Check size={12} strokeWidth={3} className={styles.readerCheck} />
                              <span className={styles.readerName}>{r.name}</span>
                              <span className={styles.readerTime}>{formatReadTime(r.readAt)}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
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
