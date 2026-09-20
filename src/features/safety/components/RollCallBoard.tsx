'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronUp, ChevronDown, Trash2, Plus, Paperclip, X, Pencil, AlertTriangle, Eraser, Save,
} from 'lucide-react';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import LoadingDots from '@/components/common/LoadingDots';
import { showToast } from '@/components/common/Toast';
import { useAuthStore } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import { isAdmin } from '@/lib/auth';
import { useRollCallStore, type RollCallItem } from '@/stores/rollcall';
import styles from '../styles/RollCall.module.css';

/** 새 항목 만들기 — id 는 화면에서 줄을 구분하려고만 쓴다(번호는 순서가 정한다) */
function newItem(): RollCallItem {
  return { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, text: '' };
}

function whenLabel(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일(${dow}) ${hh}:${mm}`;
}

/** 내용에 맞춰 늘어나는 입력칸 — 제목 길이에 제한을 두지 않기로 했다(진호 2026-09-20) */
function GrowTextarea({
  value, onChange, placeholder, className, minRows = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      rows={minRows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * 공지(점호)사항 게시판.
 *
 * 출근 점호에서 전달할 사항을 «항목»으로 쌓는다. 한 줄로 끝내도 되고, 필요하면 아래에 설명을 붙인다.
 * 날마다 새로 쓰지 않고 이 게시판 하나를 고쳐 간다 — 다음 근무자는 바뀐 항목만 손보면 된다.
 * 쓰기는 공지 등록 권한과 같은 사람(사업소 관리자)만, 보기는 누구나.
 */
export default function RollCallBoard() {
  const authUser = useAuthStore((s) => s.user);
  const driver = useDriverStore((s) => s.current);
  const sabun = authUser?.sabun ?? driver?.s ?? '';
  const name = authUser?.name ?? driver?.n ?? '';
  const canEdit = isAdmin(sabun);

  const { items, attachmentUrl, attachmentName, updatedBy, updatedAt, loading, error, load } = useRollCallStore();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RollCallItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [dropAttachment, setDropAttachment] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { load(); }, [load]);

  const startEdit = useCallback(() => {
    setDraft(items.length ? items.map((it) => ({ ...it })) : [newItem()]);
    setNewFile(null);
    setDropAttachment(false);
    setFormError(null);
    setEditing(true);
  }, [items]);

  const move = (index: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const next = [...prev];
      const to = index + dir;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  const patch = (index: number, part: Partial<RollCallItem>) => {
    setDraft((prev) => prev.map((it, i) => (i === index ? { ...it, ...part } : it)));
  };

  const save = async (clearAll = false) => {
    if (saving) return;
    const clean = clearAll
      ? []
      : draft
          .map((it) => ({ ...it, text: it.text.trim(), detail: it.detail?.trim() || undefined }))
          .filter((it) => it.text.length > 0);
    if (!clearAll && clean.length === 0) {
      setFormError('전달할 항목을 한 개 이상 적어주세요');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body = new FormData();
      body.append('items', JSON.stringify(clean));
      body.append('name', name);
      body.append('sabun', sabun);
      if (!clearAll && newFile) body.append('attachment', newFile);
      if (!clearAll && !newFile && !dropAttachment && attachmentUrl) body.append('keepAttachment', 'true');
      const r = await fetch('/api/rollcall', { method: 'POST', body });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        setFormError(typeof d?.message === 'string' ? d.message : '저장하지 못했어요. 잠시 후 다시 시도해주세요');
        return;
      }
      await load(true);
      setEditing(false);
      setConfirmClear(false);
      showToast(clearAll ? '점호 사항을 모두 지웠어요' : '점호 사항을 저장했어요', 'success');
    } catch {
      setFormError('연결이 끊겼어요. 잠시 후 다시 시도해주세요');
    } finally {
      setSaving(false);
    }
  };

  const meta = useMemo(() => {
    if (!updatedAt || (!updatedBy && items.length === 0)) return null;
    return `${updatedBy ?? ''} · ${whenLabel(updatedAt)} 기록`.replace(/^ · /, '');
  }, [updatedBy, updatedAt, items.length]);

  if (loading && !items.length) {
    return (
      <div className={styles.rcCenter}>
        <LoadingDots />
        <p className={styles.rcCenterText}>불러오는 중</p>
      </div>
    );
  }

  if (error && !items.length) {
    return (
      <div className={styles.rcCenter}>
        <AlertTriangle size={26} strokeWidth={2.2} aria-hidden />
        <p className={styles.rcCenterText}>점호 사항을 불러오지 못했어요</p>
        <button type="button" className={`z-glass-pill ${styles.rcRetry}`} onClick={() => load(true)} data-press>
          다시 시도
        </button>
      </div>
    );
  }

  // ── 고치기 ──
  if (editing) {
    return (
      <div className={styles.rcWrap}>
        <ol className={styles.rcEditList}>
          {draft.map((it, i) => (
            <li key={it.id} className={`z-glass-surface ${styles.rcEditItem}`}>
              <div className={styles.rcEditHead}>
                <span className={styles.rcNum}>{i + 1}</span>
                <div className={styles.rcEditTools}>
                  <button
                    type="button"
                    className={styles.rcToolBtn}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`${i + 1}번 항목 위로`}
                  >
                    <ChevronUp size={18} />
                  </button>
                  <button
                    type="button"
                    className={styles.rcToolBtn}
                    onClick={() => move(i, 1)}
                    disabled={i === draft.length - 1}
                    aria-label={`${i + 1}번 항목 아래로`}
                  >
                    <ChevronDown size={18} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.rcToolBtn} ${styles.rcToolDanger}`}
                    onClick={() => setDraft((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`${i + 1}번 항목 지우기`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <GrowTextarea
                className={styles.rcTitleInput}
                value={it.text}
                onChange={(v) => patch(i, { text: v })}
                placeholder="전달할 내용"
              />
              {it.detail === undefined ? (
                <button
                  type="button"
                  className={styles.rcDetailAdd}
                  onClick={() => patch(i, { detail: '' })}
                >
                  <Plus size={14} /> 설명 넣기
                </button>
              ) : (
                <GrowTextarea
                  className={styles.rcDetailInput}
                  value={it.detail}
                  onChange={(v) => patch(i, { detail: v })}
                  placeholder="부가 설명 (선택)"
                  minRows={2}
                />
              )}
            </li>
          ))}
        </ol>

        <button
          type="button"
          className={`z-glass-pill ${styles.rcAddBtn}`}
          onClick={() => setDraft((prev) => [...prev, newItem()])}
          data-press
        >
          <Plus size={18} /> 항목 추가
        </button>

        {/* 첨부 — 많이 쓰지 않아 아래에 작게 */}
        <div className={styles.rcFileRow}>
          <label className={styles.rcFileLabel}>
            <Paperclip size={14} />
            <span>{newFile ? newFile.name : '파일 첨부 (선택)'}</span>
            <input
              type="file"
              className={styles.rcFileInput}
              onChange={(e) => { setNewFile(e.target.files?.[0] ?? null); setDropAttachment(false); }}
            />
          </label>
          {!newFile && attachmentUrl && !dropAttachment && (
            <button type="button" className={styles.rcFileDrop} onClick={() => setDropAttachment(true)}>
              <X size={13} /> 기존 파일 빼기
            </button>
          )}
          {newFile && (
            <button type="button" className={styles.rcFileDrop} onClick={() => setNewFile(null)}>
              <X size={13} /> 취소
            </button>
          )}
        </div>

        {formError && <p className={styles.rcError} role="alert">{formError}</p>}

        <div className={styles.rcActions}>
          <button type="button" className={`z-glass-pill ${styles.rcCancelBtn}`} onClick={() => setEditing(false)} data-press>
            취소
          </button>
          <button type="button" className={`z-cta ${styles.rcSaveBtn}`} onClick={() => save()} disabled={saving} data-press>
            <Save size={18} /> {saving ? '저장 중…' : '저장하기'}
          </button>
        </div>
        <button type="button" className={styles.rcClearBtn} onClick={() => setConfirmClear(true)}>
          <Eraser size={15} /> 전부 지우고 새로 쓰기
        </button>

        <ConfirmDialog
          open={confirmClear}
          title="전부 지우기"
          message={<>적어 둔 점호 사항을 <b>모두 지웁니다</b>. 되돌릴 수 없어요.</>}
          confirmLabel="모두 지우기"
          variant="danger"
          onConfirm={() => save(true)}
          onClose={() => setConfirmClear(false)}
        />
      </div>
    );
  }

  // ── 보기 ──
  return (
    <div className={styles.rcWrap}>
      {items.length === 0 ? (
        <div className={styles.rcCenter}>
          <p className={styles.rcCenterText}>
            오늘 전달할 점호 사항이 없어요
            {canEdit && <><br />아래 «점호 사항 쓰기» 로 적어 주세요</>}
          </p>
        </div>
      ) : (
        <ol className={styles.rcList}>
          {items.map((it, i) => (
            <li key={it.id} className={`z-glass-surface ${styles.rcItem}`}>
              <span className={styles.rcNum}>{i + 1}</span>
              <div className={styles.rcItemBody}>
                <p className={styles.rcItemText}>{it.text}</p>
                {it.detail && <p className={styles.rcItemDetail}>{it.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {attachmentUrl && (
        <a className={styles.rcAttachment} href={attachmentUrl} target="_blank" rel="noopener noreferrer">
          <Paperclip size={14} />
          {attachmentName || '첨부 파일'}
        </a>
      )}

      {meta && <p className={styles.rcMeta}>{meta}</p>}

      {canEdit && (
        <button type="button" className={`z-cta ${styles.rcEditBtn}`} onClick={startEdit} data-press>
          <Pencil size={18} /> {items.length ? '점호 사항 고치기' : '점호 사항 쓰기'}
        </button>
      )}
    </div>
  );
}
