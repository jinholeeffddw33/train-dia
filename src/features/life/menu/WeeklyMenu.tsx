'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, UtensilsCrossed, Upload, Trash2, FileText, RotateCw } from 'lucide-react';
import styles from './WeeklyMenu.module.css';

interface MenuItem {
  url: string;
  kind: 'image' | 'pdf';
  name: string;
  updatedAt: string | null;
}

/** 업로드 전 이미지 리사이즈·압축(용량↓) — PDF는 그대로 */
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxW = 1400;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('blob'))), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 등록`;
}

export default function WeeklyMenu({ onBack }: { onBack: () => void }) {
  const [menu, setMenu] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const res = await fetch('/api/life/menu');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setMenu(json.data ?? null);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true); setMsg(null);
    try {
      const isPdf = f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf');
      let payload: Blob = f;
      let fname = f.name || 'menu';
      if (!isPdf) {
        payload = await compressImage(f);
        fname = 'menu.jpg';
      }
      const fd = new FormData();
      fd.append('file', new File([payload], fname, { type: payload.type || f.type || 'application/octet-stream' }));
      const res = await fetch('/api/life/menu', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || '업로드에 실패했어요');
      setMenu(json.data);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '업로드에 실패했어요. 다시 시도해주세요');
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async () => {
    setUploading(true); setMsg(null);
    try {
      const res = await fetch('/api/life/menu', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setMenu(null);
    } catch {
      setMsg('삭제에 실패했어요. 다시 시도해주세요');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h2 className={styles.title}>이번주 식당 메뉴</h2>
      </header>

      <div className={styles.body}>
        {loading ? (
          <div className={styles.skeleton} aria-label="불러오는 중" />
        ) : loadError ? (
          <div className={styles.state}>
            <UtensilsCrossed size={40} className={styles.stateIcon} />
            <p className={styles.stateText}>메뉴를 불러올 수 없어요.</p>
            <button type="button" className={styles.retryBtn} onClick={load}>
              <RotateCw size={16} /> 다시 시도
            </button>
          </div>
        ) : menu ? (
          <>
            {menu.kind === 'image' ? (
              <a href={menu.url} target="_blank" rel="noopener noreferrer" className={styles.imgLink}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={menu.url} alt="이번주 식당 메뉴" className={styles.menuImg} />
              </a>
            ) : (
              <a href={menu.url} target="_blank" rel="noopener noreferrer" className={styles.pdfCard}>
                <FileText size={30} />
                <span>메뉴 열기 (PDF)</span>
              </a>
            )}
            {menu.updatedAt && <p className={styles.meta}>{fmtDate(menu.updatedAt)}</p>}
          </>
        ) : (
          <div className={styles.state}>
            <UtensilsCrossed size={40} className={styles.stateIcon} />
            <p className={styles.stateText}>아직 등록된 메뉴가 없어요.</p>
            <p className={styles.stateHint}>아래 <b>메뉴 등록</b>으로 이번주 식단 사진을 올려주세요.</p>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*,application/pdf" className={styles.hiddenInput} onChange={onFile} />

        {!loading && (
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload size={18} /> {uploading ? '올리는 중…' : menu ? '메뉴 교체' : '메뉴 등록'}
            </button>
            {menu && (
              <button type="button" className={styles.delBtn} onClick={onDelete} disabled={uploading} aria-label="메뉴 삭제">
                <Trash2 size={16} /> 삭제
              </button>
            )}
          </div>
        )}

        {msg && <p className={styles.err}>{msg}</p>}
        <p className={styles.notice}>사진 또는 PDF 파일을 올릴 수 있어요. 올린 메뉴는 전 직원이 함께 봅니다.</p>
      </div>
    </div>
  );
}
