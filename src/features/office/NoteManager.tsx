'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Plus, X, Star, Pin, Trash2, PenLine, Mic, Eraser } from 'lucide-react';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useOfficeStore, OFFICE_CATEGORIES } from '@/stores/office';
import type { OfficeNote } from '@/stores/office';
import styles from './NoteManager.module.css';

function relTime(ts: number): string {
  if (!ts) return '';
  const now = Date.now();
  const diff = Math.floor((now - ts) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const y = new Date(today); y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return '어제';
  const days = Math.floor((now - ts) / 86400000);
  if (days < 7) return `${days}일 전`;
  return `${d.getMonth() + 1}.${d.getDate()}`;
}
const catDot = (k: string) => OFFICE_CATEGORIES.find((c) => c.key === k)?.dot ?? '#94a3b8';

export default function NoteManager({ onClose }: { onClose: () => void }) {
  const { notes, addNote, updateNote, togglePin, removeNote } = useOfficeStore();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string>('all');

  // 편집 시트
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [fTitle, setFTitle] = useState('');
  const [fBody, setFBody] = useState('');
  const [fCat, setFCat] = useState('gray');
  const [fPin, setFPin] = useState(false);

  // 음성 → 텍스트 (지원 브라우저에서만). 듣기 시작 시점의 내용을 base로 잡고
  // 세션 최종 텍스트를 '설정'만 함 → 안드로이드 크롬 중복 이벤트에도 중복 없음
  const voiceBaseRef = useRef('');
  const speech = useSpeechRecognition((sessionFinal) => {
    setFBody(voiceBaseRef.current + sessionFinal);
  });
  const startVoice = () => {
    voiceBaseRef.current = fBody.trim() ? `${fBody.replace(/\s+$/, '')} ` : '';
    speech.start();
  };
  const toggleVoice = () => { if (speech.listening) speech.stop(); else startVoice(); };
  // 시트 닫히면 마이크 정지(권한/녹음 해제)
  useEffect(() => { if (!open && speech.listening) speech.stop(); }, [open, speech.listening, speech]);

  // 화면 자체는 항상 등록(편집 시트가 열려도 유지) — !open 게이팅은 히스토리 churn/튕김 유발
  useHistoryBack('note-manager', onClose);
  useHistoryBack('note-edit', () => setOpen(false), open);

  const pinned = useMemo(() => notes.filter((n) => n.pinned), [notes]);
  const filtered = useMemo(() => {
    const qq = q.trim();
    return notes.filter((n) => {
      if (filter !== 'all' && n.category !== filter) return false;
      if (qq && !(n.title.includes(qq) || n.body.includes(qq))) return false;
      return true;
    });
  }, [notes, q, filter]);

  const startNew = () => { setEditId(null); setFTitle(''); setFBody(''); setFCat('gray'); setFPin(false); setOpen(true); };
  const startEdit = (n: OfficeNote) => { setEditId(n.id); setFTitle(n.title); setFBody(n.body); setFCat(n.category); setFPin(n.pinned); setOpen(true); };
  const save = () => {
    if (!fTitle.trim() && !fBody.trim()) return;
    if (editId) updateNote(editId, { title: fTitle.trim(), body: fBody.trim(), category: fCat, pinned: fPin });
    else addNote({ title: fTitle.trim(), body: fBody.trim(), category: fCat, pinned: fPin });
    setOpen(false);
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onClose} aria-label="닫기"><ArrowLeft size={20} /></button>
        <h1 className={styles.title}>메모</h1>
        <span className={styles.headSpacer} />
      </header>

      {/* 검색 */}
      <div className={styles.searchBar}>
        <Search size={16} className={styles.searchIcon} />
        <input className={styles.searchInput} type="search" placeholder="메모 검색"
          value={q} onChange={(e) => setQ(e.target.value)} aria-label="메모 검색"
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      </div>

      {/* 빠른 메모 (고정) */}
      {pinned.length > 0 && (
        <section className={styles.block}>
          <div className={styles.blockHead}><h2 className={styles.blockTitle}><Pin size={15} /> 빠른 메모</h2></div>
          <div className={styles.quickScroll}>
            {pinned.map((n) => (
              <button key={n.id} type="button" className={`${styles.quickCard} ${styles[`c_${n.category}`]}`} onClick={() => startEdit(n)}>
                <span className={styles.qcTitle}>{n.title || '메모'}</span>
                <span className={styles.qcBody}>{n.body}</span>
                <span className={styles.qcTs}>{relTime(n.ts)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 카테고리 필터 */}
      <div className={styles.filterRow}>
        <button type="button" className={filter === 'all' ? styles.fOn : styles.f} onClick={() => setFilter('all')}>전체</button>
        {OFFICE_CATEGORIES.map((c) => (
          <button key={c.key} type="button" className={filter === c.key ? styles.fOn : styles.f} onClick={() => setFilter(c.key)}>
            <span className={styles.fdot} style={{ background: c.dot }} />{c.label}
          </button>
        ))}
      </div>

      {/* 최근 메모 */}
      <section className={styles.block}>
        <div className={styles.blockHead}><h2 className={styles.blockTitle}>최근 메모</h2><span className={styles.count}>{filtered.length}개</span></div>
        <ul className={styles.noteList}>
          {filtered.length === 0 && <li className={styles.empty}>메모가 없어요. <b>+</b> 로 추가하세요.</li>}
          {filtered.map((n) => (
            <li key={n.id} className={styles.noteRow}>
              <button type="button" className={styles.noteMain} onClick={() => startEdit(n)}>
                <span className={styles.nStripe} style={{ background: catDot(n.category) }} />
                <span className={styles.nBody}>
                  <span className={styles.nTitle}>{n.title || n.body.slice(0, 30) || '(빈 메모)'}</span>
                  {n.title && n.body && <span className={styles.nSub}>{n.body}</span>}
                  <span className={styles.nMeta}>{relTime(n.ts)}</span>
                </span>
              </button>
              <button type="button" className={`${styles.starBtn} ${n.pinned ? styles.starOn : ''}`} onClick={() => togglePin(n.id)} aria-label="고정">
                <Star size={17} fill={n.pinned ? 'currentColor' : 'none'} />
              </button>
              <button type="button" className={styles.rowDel} onClick={() => removeNote(n.id)} aria-label="삭제"><X size={15} /></button>
            </li>
          ))}
        </ul>
      </section>

      <button type="button" className={styles.fab} onClick={startNew} aria-label="새 메모"><Plus size={24} /></button>

      {/* 편집 시트 */}
      {open && (
        <div className={styles.sheetOverlay} role="dialog" aria-modal="true" aria-label="메모 편집"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className={styles.sheet}>
            <div className={styles.grab} />
            <div className={styles.sheetHead}>
              <button type="button" className={styles.sheetX} onClick={() => setOpen(false)} aria-label="취소"><X size={20} /></button>
              <b>{editId ? '메모 편집' : '새 메모'}</b>
              <button type="button" className={styles.sheetSave} onClick={save}>저장</button>
            </div>

            <input className={styles.titleInput} type="text" value={fTitle} placeholder="제목" autoFocus
              onChange={(e) => setFTitle(e.target.value)} aria-label="제목" />
            <textarea className={styles.bodyInput} value={fBody} placeholder="내용을 입력하세요…" rows={6}
              onChange={(e) => setFBody(e.target.value)} aria-label="내용" />

            {/* 음성 입력(지원 브라우저) + 내용 지우기 */}
            {(speech.supported || fBody) && (
              <div className={styles.sttRow}>
                {speech.supported && (
                  <button type="button" className={speech.listening ? styles.micOn : styles.mic}
                    onClick={toggleVoice} aria-pressed={speech.listening}>
                    <Mic size={16} /> {speech.listening ? '듣는 중… 탭하여 정지' : '음성으로 입력'}
                  </button>
                )}
                {speech.listening && speech.interim && <span className={styles.sttInterim}>{speech.interim}</span>}
                {fBody && (
                  <button type="button" className={styles.clearBtn} onClick={() => { speech.stop(); setFBody(''); }}>
                    <Eraser size={14} /> 내용 지우기
                  </button>
                )}
              </div>
            )}

            <div className={styles.editRow}>
              <span className={styles.editLabel}>카테고리</span>
              <div className={styles.catPick}>
                {OFFICE_CATEGORIES.map((c) => (
                  <button key={c.key} type="button" className={`${styles.cp} ${fCat === c.key ? styles.cpSel : ''}`}
                    style={{ background: c.dot }} onClick={() => setFCat(c.key)} aria-label={c.label} title={c.label} />
                ))}
              </div>
            </div>
            <button type="button" className={styles.pinRow} onClick={() => setFPin((v) => !v)} aria-pressed={fPin}>
              <span className={styles.editLabel}><Pin size={14} /> 빠른 메모 고정</span>
              <span className={`${styles.switch} ${fPin ? styles.switchOn : ''}`}><span className={styles.knob} /></span>
            </button>

            {editId && (
              <button type="button" className={styles.deleteBtn} onClick={() => { removeNote(editId); setOpen(false); }}>
                <Trash2 size={15} /> 메모 삭제
              </button>
            )}
            {!editId && <p className={styles.hint}><PenLine size={12} /> 사진·음성 메모는 다음 단계에서 추가돼요.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
