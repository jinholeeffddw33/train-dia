'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, UtensilsCrossed, Upload, Trash2, FileText, RotateCw, Check, X } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import styles from './WeeklyMenu.module.css';

interface MenuItem {
  url: string;
  kind: 'image' | 'pdf';
  name: string;
  /** 적용 주(월요일). null = 구 버전에 올린 파일 → 이번주 메뉴로 인정 */
  week: string | null;
  updatedAt: string | null;
}

type Tab = 'this' | 'next';

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromISO(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

/**
 * 그 날짜가 속한 주(월~일)의 월요일.
 * 메뉴는 월~일 단위라 일요일 자정(=월요일 00:00)에 다음 주로 넘어간다.
 * ★ 반드시 브라우저(한국시간)에서 계산할 것 — 서버는 UTC라 일요일 15시에 넘어가 버린다.
 */
function mondayOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay(); // 0=일 … 6=토
  x.setDate(x.getDate() + (dow === 0 ? -6 : 1 - dow));
  return iso(x);
}
function addDays(s: string, n: number): string { const d = fromISO(s); d.setDate(d.getDate() + n); return iso(d); }

/** 월요일 → "7.13 ~ 7.19" */
function weekLabel(mondayISO: string): string {
  const s = fromISO(mondayISO);
  const e = fromISO(addDays(mondayISO, 6));
  return `${s.getMonth() + 1}.${s.getDate()} ~ ${e.getMonth() + 1}.${e.getDate()}`;
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
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tab, setTab] = useState<Tab>('this');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 식단 사진 인앱 뷰어 — 새 탭 대신 앱 위에 띄우고 뒤로가기/X/배경/ESC 로 닫는다
  const [viewer, setViewer] = useState(false);
  const [viewerClosing, setViewerClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const openViewer = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    setViewerClosing(false);
    setViewer(true);
  }, []);
  const closeViewer = useCallback(() => {
    if (closeTimer.current) return;            // 이미 닫히는 중 — 중복 방지
    setViewerClosing(true);                    // 축소하며 사라지는 exit 애니메이션
    closeTimer.current = window.setTimeout(() => {
      setViewer(false);
      setViewerClosing(false);
      closeTimer.current = null;
    }, 200);                                   // --dia-dur-slow 와 맞춤
  }, []);

  // 하드웨어/제스처 뒤로가기 → 뷰어부터 닫는다 (앱을 벗어나지 않는다)
  useHistoryBack('menu-photo', closeViewer, viewer);

  // ESC 로 닫기 + 열려 있는 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeViewer(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [viewer, closeViewer]);

  // 언마운트 시 타이머 정리
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // 매 렌더가 아니라 마운트 시 1회 — 보는 중에 날짜가 바뀌는 일은 사실상 없다
  const thisWeek = useMemo(() => mondayOf(new Date()), []);
  const nextWeek = useMemo(() => addDays(thisWeek, 7), [thisWeek]);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const res = await fetch('/api/life/menu');
      if (!res.ok) throw new Error();
      const json = await res.json();
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // 이번주는 구 버전 파일(week=null)도 인정 — 새 방식 배포 직후 메뉴가 사라지지 않게
  const thisMenu = items.find((i) => i.week === thisWeek) ?? items.find((i) => i.week === null) ?? null;
  const nextMenu = items.find((i) => i.week === nextWeek) ?? null;
  const shown = tab === 'this' ? thisMenu : nextMenu;
  const targetWeek = tab === 'this' ? thisWeek : nextWeek;

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
        try {
          // 브라우저에서 리사이즈·압축(용량↓)
          payload = await compressImage(f);
          fname = 'menu.jpg';
        } catch {
          // 압축 실패(아이폰 HEIC·대용량·일부 브라우저 등) → 원본 사진 그대로 업로드
          payload = f;
          fname = f.name || 'menu.jpg';
        }
      }
      const fd = new FormData();
      fd.append('file', new File([payload], fname, { type: payload.type || f.type || 'application/octet-stream' }));
      fd.append('week', targetWeek);
      fd.append('current', thisWeek);
      const res = await fetch('/api/life/menu', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || '업로드에 실패했어요');
      await load(); // 서버가 정리한 결과를 그대로 반영
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '업로드에 실패했어요. 다시 시도해주세요');
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async () => {
    if (!shown) return;
    setUploading(true); setMsg(null);
    try {
      const res = await fetch(`/api/life/menu?name=${encodeURIComponent(shown.name)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await load();
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
        <h2 className={styles.title}>식당 메뉴</h2>
      </header>

      {/* 이번주 / 다음주 — 다음주를 미리 올려두면 일요일 밤에 저절로 바뀐다 */}
      <div className={styles.tabs} role="tablist" aria-label="주간 선택">
        {(['this', 'next'] as Tab[]).map((t) => {
          const week = t === 'this' ? thisWeek : nextWeek;
          const has = t === 'this' ? !!thisMenu : !!nextMenu;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              tabIndex={tab === t ? 0 : -1}
              className={`${styles.tab} ${tab === t ? styles.tabOn : ''}`}
              onClick={() => setTab(t)}
            >
              <span className={styles.tabName}>
                {t === 'this' ? '이번주' : '다음주'}
                {t === 'next' && has && <Check size={13} strokeWidth={3} className={styles.tabCheck} aria-label="등록됨" />}
              </span>
              <span className={styles.tabWeek}>{weekLabel(week)}</span>
            </button>
          );
        })}
      </div>

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
        ) : shown ? (
          <>
            {shown.kind === 'image' ? (
              <button type="button" onClick={openViewer} className={styles.imgLink} aria-label="식단 사진 크게 보기">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shown.url} alt={`${tab === 'this' ? '이번주' : '다음주'} 식당 메뉴`} className={styles.menuImg} />
              </button>
            ) : (
              <a href={shown.url} target="_blank" rel="noopener noreferrer" className={styles.pdfCard}>
                <FileText size={30} />
                <span>메뉴 열기 (PDF)</span>
              </a>
            )}
            {shown.updatedAt && <p className={styles.meta}>{fmtDate(shown.updatedAt)}</p>}
          </>
        ) : (
          <div className={styles.state}>
            <UtensilsCrossed size={40} className={styles.stateIcon} />
            <p className={styles.stateText}>
              {tab === 'this' ? '아직 등록된 메뉴가 없어요.' : '다음주 메뉴가 아직 없어요.'}
            </p>
            <p className={styles.stateHint}>
              아래 <b>메뉴 등록</b>으로 {tab === 'this' ? '이번주' : '다음주'} 식단 사진을 올려주세요.
            </p>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*,application/pdf" className={styles.hiddenInput} onChange={onFile} />

        {/* 버튼은 사진 바로 아래(일반 흐름) — 사진을 가리지 않음. 긴 사진은 스크롤로 내려서 봄 */}
        {!loading && (
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload size={18} /> {uploading ? '올리는 중…' : shown ? '메뉴 교체' : '메뉴 등록'}
            </button>
            {shown && (
              <button type="button" className={styles.delBtn} onClick={onDelete} disabled={uploading} aria-label="메뉴 삭제">
                <Trash2 size={16} /> 삭제
              </button>
            )}
          </div>
        )}

        {msg && <p className={styles.err}>{msg}</p>}
        <p className={styles.notice}>
          {tab === 'next'
            ? '다음주 메뉴를 미리 올려두면 일요일 밤에 자동으로 바뀌어요. 이번주 메뉴는 그대로 있습니다.'
            : '사진 또는 PDF 파일을 올릴 수 있어요. 올린 메뉴는 전 직원이 함께 봅니다.'}
        </p>
      </div>

      {/* 식단 사진 인앱 뷰어 — 이미지일 때만. PDF 는 지금처럼 새 탭이 맞다. */}
      {viewer && shown?.kind === 'image' && (
        <div
          className={`${styles.viewerOverlay} ${viewerClosing ? styles.viewerClosing : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="식단 사진 보기"
          onClick={closeViewer}
        >
          <button
            type="button"
            className={styles.viewerClose}
            onClick={(e) => { e.stopPropagation(); closeViewer(); }}
            aria-label="닫기"
          >
            <X size={22} strokeWidth={2.4} />
          </button>
          {/* 사진을 버튼으로 감싸 키보드 접근 보장 — 탭/Enter 시 닫기 */}
          <button
            type="button"
            className={styles.viewerImageBtn}
            onClick={(e) => { e.stopPropagation(); closeViewer(); }}
            aria-label="사진 닫기"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown.url} alt="식단 사진 크게 보기" className={styles.viewerImage} />
          </button>
        </div>
      )}
    </div>
  );
}
