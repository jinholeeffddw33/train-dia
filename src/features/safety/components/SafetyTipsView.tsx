'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Plus, Play, Image as ImageIcon, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import SafetyTipsForm from './SafetyTipsForm';
import styles from './SafetyTips.module.css';

import { acquireScrollLock, releaseScrollLock } from '@/lib/overlay/scrollLockManager';
interface Tip {
  id: string;
  title: string;
  description: string;
  contentType: 'video' | 'image';
  mediaUrl: string;
  thumbnailUrl: string;
  createdBy: { sabun: string; name: string };
  createdAt: string;
}

/** YouTube URL → 임베드 가능 URL (watch?v=…, youtu.be/… 모두 처리) */
function toYoutubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : null;
}
/** YouTube ID → 썸네일 */
function toYoutubeThumb(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  onBack: () => void;
}

export default function SafetyTipsView({ onBack }: Props) {
  const [items, setItems] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Tip | null>(null);

  const authUser = useAuthStore((s) => s.user);
  const driverSabun = useDriverStore((s) => s.myDriver?.s ?? '');
  const driverName = useDriverStore((s) => s.myDriver?.n ?? '');
  const sabun = authUser?.sabun || driverSabun;
  const name = authUser?.name || driverName;

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/safety/tips', { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = (await res.json()) as { data: Tip[] };
      setItems(json.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', onKey);
    acquireScrollLock();
    return () => {
      document.removeEventListener('keydown', onKey);
      releaseScrollLock();
    };
  }, [selected]);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.title}>안전상식</h1>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setShowForm(true)}
          aria-label="안전상식 등록"
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
            <p className={styles.emptyText}>등록된 안전상식이 없어요</p>
            <p className={styles.emptyHint}>&quot;+ 등록&quot; 버튼으로 동영상 링크 또는 사진을 올려주세요</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {items.map((it) => {
              const isVideo = it.contentType === 'video';
              const thumb = isVideo
                ? (it.thumbnailUrl || toYoutubeThumb(it.mediaUrl) || '')
                : it.mediaUrl;
              return (
                <li key={it.id} className={styles.card}>
                  <button
                    type="button"
                    className={styles.cardBtn}
                    onClick={() => setSelected(it)}
                    aria-label={`${it.title} ${isVideo ? '동영상 보기' : '사진 보기'}`}
                  >
                    <div className={styles.cardMedia}>
                      {thumb ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={thumb} alt={it.title} className={styles.cardThumb} />
                      ) : (
                        <div className={styles.cardThumbFallback}>
                          {isVideo ? <Play size={32} /> : <ImageIcon size={32} />}
                        </div>
                      )}
                      {isVideo && (
                        <span className={styles.playOverlay} aria-hidden>
                          <Play size={28} strokeWidth={2.5} fill="#fff" />
                        </span>
                      )}
                      <span className={`${styles.typeBadge} ${isVideo ? styles.typeBadgeVideo : styles.typeBadgeImage}`}>
                        {isVideo ? '동영상' : '사진'}
                      </span>
                    </div>
                    <div className={styles.cardBody}>
                      <h2 className={styles.cardTitle}>{it.title}</h2>
                      {it.description && <p className={styles.cardDesc}>{it.description}</p>}
                      <div className={styles.cardMeta}>
                        <span>{it.createdBy.name}</span>
                        <span className={styles.metaDot}>·</span>
                        <span>{formatDate(it.createdAt)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {showForm && (
        <SafetyTipsForm
          sabun={sabun}
          name={name}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchItems(); }}
        />
      )}

      {selected && (
        <div className={styles.detailOverlay} role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <div className={styles.detailCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.detailHead}>
              <h2 className={styles.detailTitle}>{selected.title}</h2>
              <button
                type="button"
                className={styles.detailClose}
                onClick={() => setSelected(null)}
                aria-label="닫기"
              >
                <X size={20} strokeWidth={2.4} />
              </button>
            </div>
            <div className={styles.detailMedia}>
              {selected.contentType === 'video' ? (
                (() => {
                  const embed = toYoutubeEmbed(selected.mediaUrl);
                  return embed ? (
                    <iframe
                      className={styles.detailVideo}
                      src={embed}
                      title={selected.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <a href={selected.mediaUrl} target="_blank" rel="noopener noreferrer" className={styles.detailExtLink}>
                      외부 영상 열기 →
                    </a>
                  );
                })()
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={selected.mediaUrl} alt={selected.title} className={styles.detailImage} />
              )}
            </div>
            {selected.description && (
              <p className={styles.detailDesc}>{selected.description}</p>
            )}
            <p className={styles.detailMeta}>
              등록 · {selected.createdBy.name} · {formatDate(selected.createdAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
