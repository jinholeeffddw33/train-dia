'use client';

import { useState, useCallback, useRef } from 'react';
import {
  X, Plus, Globe, ImageIcon, FileText, Trash2, Pin, PinOff,
  ExternalLink, Download, Upload, ChevronDown, Pencil, Check,
} from 'lucide-react';
import { useShortcutsStore, type ShortcutType, type Shortcut } from '@/stores/shortcuts';
import styles from '../styles/Shortcuts.module.css';
import moreStyles from '../styles/More.module.css';

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

type FilterTab = 'all' | 'web' | 'image' | 'file';

const FILTER_LABELS: Record<FilterTab, string> = {
  all: '전체',
  web: '웹사이트',
  image: '사진',
  file: '파일',
};

const TYPE_ICONS: Record<ShortcutType, typeof Globe> = {
  web: Globe,
  image: ImageIcon,
  file: FileText,
};

/** 파일을 base64 data URL로 읽기 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ─── Add Modal ─── */
function AddModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (item: { type: ShortcutType; title: string; url: string; fileName?: string }) => void;
}) {
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [type, setType] = useState<ShortcutType>('web');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const pickType = (t: ShortcutType) => {
    setType(t);
    setStep('form');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 10MB 제한
    if (file.size > 10 * 1024 * 1024) {
      alert('10MB 이하 파일만 저장할 수 있습니다.');
      return;
    }
    const dataUrl = await readFileAsDataURL(file);
    setUrl(dataUrl);
    setFileName(file.name);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
  };

  const canSubmit = title.trim() && url.trim();

  const submit = () => {
    if (!canSubmit) return;
    onAdd({
      type,
      title: title.trim(),
      url: url.trim(),
      ...(fileName ? { fileName } : {}),
    });
    onClose();
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {step === 'type' ? (
          <>
            <h3 className={styles.modalTitle}>바로가기 추가</h3>
            <div className={styles.typeGrid}>
              <button type="button" className={styles.typeBtn} onClick={() => pickType('web')}>
                <Globe size={24} />
                <span>웹 주소</span>
              </button>
              <button type="button" className={styles.typeBtn} onClick={() => pickType('image')}>
                <ImageIcon size={24} />
                <span>사진</span>
              </button>
              <button type="button" className={styles.typeBtn} onClick={() => pickType('file')}>
                <FileText size={24} />
                <span>파일</span>
              </button>
            </div>
            <button type="button" className={styles.modalCancel} onClick={onClose}>
              취소
            </button>
          </>
        ) : (
          <>
            <h3 className={styles.modalTitle}>
              {type === 'web' ? '웹 주소 추가' : type === 'image' ? '사진 추가' : '파일 추가'}
            </h3>

            <label className={styles.fieldLabel}>제목</label>
            <input
              className={styles.fieldInput}
              placeholder="바로가기 이름"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />

            {type === 'web' ? (
              <>
                <label className={styles.fieldLabel}>URL</label>
                <input
                  className={styles.fieldInput}
                  placeholder="https://"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  type="url"
                  inputMode="url"
                />
              </>
            ) : (
              <>
                <label className={styles.fieldLabel}>
                  {type === 'image' ? '사진 선택' : '파일 선택'}
                </label>
                <button
                  type="button"
                  className={styles.filePickBtn}
                  onClick={() => fileRef.current?.click()}
                >
                  {fileName || '파일을 선택하세요'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={type === 'image' ? 'image/*' : '*/*'}
                  onChange={handleFile}
                  hidden
                />
              </>
            )}

            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancel} onClick={() => setStep('type')}>
                이전
              </button>
              <button
                type="button"
                className={styles.modalSubmit}
                disabled={!canSubmit}
                onClick={submit}
              >
                추가
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Favicon with fallback ─── */
function FaviconImg({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  let hostname = '';
  try { hostname = new URL(url).hostname; } catch { /* invalid url */ }

  if (failed || !hostname) return <Globe size={20} />;

  return (
    <img
      className={styles.cardFavicon}
      src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`}
      alt=""
      width={24}
      height={24}
      onError={() => setFailed(true)}
    />
  );
}

/* ─── Shortcut Card ─── */
function ShortcutCard({ item, onEdit, onDelete, onTogglePin }: {
  item: Shortcut;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const Icon = TYPE_ICONS[item.type];
  const isImage = item.type === 'image';

  const openLink = () => {
    if (item.type === 'web') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } else {
      // 파일/이미지 → 새 탭에서 열기
      const w = window.open('');
      if (w) {
        w.document.write(
          item.type === 'image'
            ? `<img src="${item.url}" style="max-width:100%;height:auto" />`
            : `<iframe src="${item.url}" style="width:100%;height:100%;border:none"></iframe>`,
        );
      }
    }
  };

  return (
    <div className={`${styles.card} ${item.pinned ? styles.cardPinned : ''}`}>
      <button type="button" className={styles.cardMain} onClick={openLink}>
        <div className={styles.cardIcon}>
          {isImage && item.url.startsWith('data:') ? (
            <div
              className={styles.cardThumb}
              /* STYLE-EXCEPTION: 동적 base64 이미지 배경 — CSS로 표현 불가 */
              style={{ backgroundImage: `url(${item.url})` }}
            />
          ) : item.type === 'web' ? (
            <FaviconImg url={item.url} />
          ) : (
            <Icon size={20} />
          )}
        </div>
        <div className={styles.cardInfo}>
          <span className={styles.cardTitle}>{item.title}</span>
          <span className={styles.cardMeta}>
            {item.type === 'web' ? item.url.replace(/^https?:\/\//, '').slice(0, 40) : (item.fileName ?? item.type)}
          </span>
        </div>
        <ExternalLink size={16} className={styles.cardArrow} />
      </button>

      <div className={styles.cardActions}>
        <button type="button" className={styles.cardActionBtn} onClick={onTogglePin} aria-label={item.pinned ? '고정 해제' : '고정'}>
          {item.pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
        <button type="button" className={styles.cardActionBtn} onClick={onEdit} aria-label="수정">
          <Pencil size={16} />
        </button>
        <button type="button" className={`${styles.cardActionBtn} ${styles.cardActionDanger}`} onClick={onDelete} aria-label="삭제">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

/* ─── Edit Modal ─── */
function EditModal({ item, onClose, onSave }: {
  item: Shortcut;
  onClose: () => void;
  onSave: (title: string, url?: string) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url);

  const submit = () => {
    if (!title.trim()) return;
    onSave(title.trim(), item.type === 'web' ? url.trim() : undefined);
    onClose();
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>바로가기 수정</h3>

        <label className={styles.fieldLabel}>제목</label>
        <input
          className={styles.fieldInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        {item.type === 'web' && (
          <>
            <label className={styles.fieldLabel}>URL</label>
            <input
              className={styles.fieldInput}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              type="url"
              inputMode="url"
            />
          </>
        )}

        <div className={styles.modalActions}>
          <button type="button" className={styles.modalCancel} onClick={onClose}>취소</button>
          <button type="button" className={styles.modalSubmit} disabled={!title.trim()} onClick={submit}>
            <Check size={16} /> 저장
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Overlay ─── */
export default function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  const { items, add, update, remove } = useShortcutsStore();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Shortcut | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const filtered = items
    .filter((it) => filter === 'all' || it.type === filter)
    .sort((a, b) => {
      // pinned 먼저
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0; // 원래 순서 유지
    });

  const handleExport = useCallback(() => {
    const data = useShortcutsStore.getState().exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dia-shortcuts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  }, []);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const result = useShortcutsStore.getState().importData(text);
      alert(`${result.added}개 추가됨 (${result.skipped}개 중복 건너뜀)`);
    } catch {
      alert('파일 형식이 올바르지 않습니다.');
    }
    // reset input
    e.target.value = '';
    setMenuOpen(false);
  }, []);

  if (!open) return null;

  return (
    <div className={moreStyles.fullOverlay}>
      <div className={moreStyles.overlayHeader}>
        <button
          type="button"
          className={moreStyles.overlayClose}
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={22} />
        </button>
        <h2 className={moreStyles.overlayTitle}>내 바로가기</h2>

        {/* 우측 메뉴 */}
        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.headerMenuBtn}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="더보기"
          >
            <ChevronDown size={18} />
          </button>
          {menuOpen && (
            <div className={styles.dropdown}>
              <button type="button" className={styles.dropdownItem} onClick={handleExport}>
                <Download size={16} /> 백업 내보내기
              </button>
              <button type="button" className={styles.dropdownItem} onClick={() => importRef.current?.click()}>
                <Upload size={16} /> 백업 가져오기
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                hidden
              />
            </div>
          )}
        </div>
      </div>

      {/* 필터 탭 */}
      <div className={styles.filterBar} role="tablist" aria-label="바로가기 필터">
        {(Object.keys(FILTER_LABELS) as FilterTab[]).map((tab) => {
          const count = tab === 'all' ? items.length : items.filter((it) => it.type === tab).length;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={filter === tab}
              className={`${styles.filterTab} ${filter === tab ? styles.filterTabActive : ''}`}
              onClick={() => setFilter(tab)}
            >
              {FILTER_LABELS[tab]}
              {count > 0 && <span className={styles.filterCount}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* 목록 */}
      <div className={styles.listWrap}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            {items.length === 0
              ? '바로가기가 없습니다.\n자주 쓰는 사이트나 파일을 추가하세요.'
              : '이 카테고리에 저장된 항목이 없습니다.'}
          </div>
        ) : (
          filtered.map((item) => (
            <ShortcutCard
              key={item.id}
              item={item}
              onEdit={() => setEditTarget(item)}
              onDelete={() => {
                if (confirm(`"${item.title}" 바로가기를 삭제할까요?`)) {
                  remove(item.id);
                }
              }}
              onTogglePin={() => update(item.id, { pinned: !item.pinned })}
            />
          ))
        )}
      </div>

      {/* FAB — 추가 버튼 */}
      <button
        type="button"
        className={styles.fab}
        onClick={() => setAddOpen(true)}
        aria-label="바로가기 추가"
      >
        <Plus size={24} />
      </button>

      {/* 모달 */}
      {addOpen && (
        <AddModal
          onClose={() => setAddOpen(false)}
          onAdd={(item) => add(item)}
        />
      )}
      {editTarget && (
        <EditModal
          item={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={(title, url) => {
            update(editTarget.id, { title, ...(url !== undefined ? { url } : {}) });
          }}
        />
      )}
    </div>
  );
}
