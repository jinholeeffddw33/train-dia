'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, X, Check, Clock, User, FileText, Trash2, Sparkles } from 'lucide-react';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useOfficeStore, todoPriority, type OfficeTodo, type OfficePriority } from '@/stores/office';
import styles from './TaskBoard.module.css';

interface Props {
  onBack: () => void;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const PRIO: Record<OfficePriority, { label: string; cls: string; rank: number }> = {
  urgent: { label: '긴급', cls: styles.prioUrgent, rank: 0 },
  important: { label: '중요', cls: styles.prioImportant, rank: 1 },
  normal: { label: '일반', cls: styles.prioNormal, rank: 2 },
};

type Filter = 'all' | OfficePriority | 'done';

function fmtDate(d: Date): string {
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')} (${DOW[d.getDay()]})`;
}

/** 오늘의 할 일 전체보기 — office 스토어(todos) 사용 */
export default function TaskBoard({ onBack }: Props) {
  const today = useMemo(() => new Date(), []);
  const todos = useOfficeStore((s) => s.todos);
  const addTodo = useOfficeStore((s) => s.addTodo);
  const updateTodo = useOfficeStore((s) => s.updateTodo);
  const toggleTodo = useOfficeStore((s) => s.toggleTodo);
  const removeTodo = useOfficeStore((s) => s.removeTodo);

  const [filter, setFilter] = useState<Filter>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<OfficeTodo | null>(null);

  useHistoryBack('office-taskboard-editor', () => setEditorOpen(false), editorOpen);
  useEscapeClose(editorOpen, () => setEditorOpen(false));

  const doneCount = todos.filter((t) => t.done).length;
  const total = todos.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const counts = useMemo(() => ({
    all: total,
    urgent: todos.filter((t) => !t.done && todoPriority(t) === 'urgent').length,
    important: todos.filter((t) => !t.done && todoPriority(t) === 'important').length,
    normal: todos.filter((t) => !t.done && todoPriority(t) === 'normal').length,
    done: doneCount,
  }), [todos, total, doneCount]);

  const priorityTop = useMemo(
    () => todos
      .filter((t) => !t.done && todoPriority(t) !== 'normal')
      .sort((a, b) => PRIO[todoPriority(a)].rank - PRIO[todoPriority(b)].rank || (a.time || '99:99').localeCompare(b.time || '99:99'))
      .slice(0, 3),
    [todos],
  );

  const visible = useMemo(() => {
    const list = filter === 'all' ? todos
      : filter === 'done' ? todos.filter((t) => t.done)
      : todos.filter((t) => !t.done && todoPriority(t) === filter);
    return [...list].sort((a, b) =>
      Number(a.done) - Number(b.done) ||
      PRIO[todoPriority(a)].rank - PRIO[todoPriority(b)].rank ||
      (a.time || '99:99').localeCompare(b.time || '99:99'),
    );
  }, [todos, filter]);

  const R = 26;
  const C = 2 * Math.PI * R;
  const dash = C * (pct / 100);

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (t: OfficeTodo) => { setEditing(t); setEditorOpen(true); };

  const aiTip = useMemo(() => {
    const n = todos.filter((t) => !t.done && todoPriority(t) !== 'normal').length;
    if (n === 0) return null;
    const hour = today.getHours();
    const when = hour < 12 ? '오전' : hour < 18 ? '오후' : '저녁';
    return `${when}에 ${n}건의 중요 업무가 있어요. 우선순위 높은 것부터 처리해보세요!`;
  }, [todos, today]);

  return (
    <div className={styles.screen}>
      <header className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.topTitle}>오늘의 할 일</h1>
      </header>

      <div className={styles.body}>
        <p className={styles.dateLine}><span className={styles.dateText}>{fmtDate(today)}</span></p>

        {/* 요약 카드 */}
        <section className={styles.summary}>
          <div className={styles.ringWrap}>
            <svg className={styles.ring} viewBox="0 0 64 64" width="64" height="64" aria-hidden>
              <circle className={styles.ringBg} cx="32" cy="32" r={R} />
              <circle className={styles.ringFg} cx="32" cy="32" r={R} strokeDasharray={`${dash} ${C - dash}`} />
            </svg>
            <span className={styles.ringPct}>{pct}<span className={styles.ringUnit}>%</span></span>
          </div>
          <div className={styles.summaryInfo}>
            <span className={styles.summaryDone}><strong>{doneCount}</strong> / {total} 건 완료</span>
            {priorityTop.length > 0 ? (
              <div className={styles.prioList}>
                <span className={styles.prioListTitle}>⭐ 우선 처리 {priorityTop.length}건</span>
                {priorityTop.map((t) => (
                  <button key={t.id} type="button" className={styles.prioItem} onClick={() => openEdit(t)}>
                    <span className={`${styles.prioDot} ${PRIO[todoPriority(t)].cls}`} />
                    <span className={styles.prioItemText}>{t.text}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className={styles.prioNone}>급한 업무가 없어요 👍</span>
            )}
          </div>
        </section>

        {/* 필터 칩 */}
        <div className={styles.chips}>
          {([
            { key: 'all' as Filter, label: '전체' },
            { key: 'urgent' as Filter, label: '긴급' },
            { key: 'important' as Filter, label: '중요' },
            { key: 'normal' as Filter, label: '일반' },
            { key: 'done' as Filter, label: '완료' },
          ]).map((c) => (
            <button
              key={c.key}
              type="button"
              className={`${styles.chip} ${filter === c.key ? styles.chipOn : ''}`}
              onClick={() => setFilter(c.key)}
              aria-pressed={filter === c.key}
            >
              {c.label} {counts[c.key]}
            </button>
          ))}
        </div>

        {/* 목록 */}
        {visible.length === 0 ? (
          <div className={styles.empty}>
            <FileText size={40} className={styles.emptyIcon} aria-hidden />
            <p className={styles.emptyText}>{filter === 'all' ? '오늘 할 일이 없어요' : '해당 항목이 없어요'}</p>
            <button type="button" className={styles.emptyAdd} onClick={openNew}><Plus size={16} /> 할 일 추가</button>
          </div>
        ) : (
          <ul className={styles.list}>
            {visible.map((t) => {
              const prio = todoPriority(t);
              return (
                <li key={t.id} className={`${styles.card} ${t.done ? styles.cardDone : ''}`}>
                  <button
                    type="button"
                    className={`${styles.check} ${t.done ? styles.checkOn : ''}`}
                    onClick={() => toggleTodo(t.id)}
                    aria-label={t.done ? '완료 취소' : '완료 체크'}
                  >
                    {t.done && <Check size={14} strokeWidth={3} />}
                  </button>
                  <button type="button" className={styles.cardMain} onClick={() => openEdit(t)}>
                    <div className={styles.cardHead}>
                      <span className={`${styles.badge} ${t.done ? styles.badgeDone : PRIO[prio].cls}`}>
                        {t.done ? '완료' : PRIO[prio].label}
                      </span>
                      <span className={`${styles.cardTitle} ${t.done ? styles.cardTitleDone : ''}`}>{t.text}</span>
                      {(t.time || t.completedAt) && (
                        <span className={`${styles.cardTime} ${t.done ? styles.cardTimeDone : PRIO[prio].cls}`}>
                          {t.done ? t.completedAt : t.time}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardMeta}>
                      {t.assignee && <span className={styles.metaItem}><User size={12} />{t.assignee}</span>}
                      {t.time && !t.done && <span className={styles.metaItem}><Clock size={12} />마감 {t.time}</span>}
                      {t.memo && <span className={styles.metaItem}><FileText size={12} />메모</span>}
                    </div>
                    {typeof t.progress === 'number' && t.progress > 0 && !t.done && (
                      <div className={styles.progRow}>
                        <div className={styles.progBar}><span className={styles.progFill} style={progWidth(t.progress)} /></div>
                        <span className={styles.progPct}>진행 {t.progress}%</span>
                      </div>
                    )}
                  </button>
                  <button type="button" className={styles.delBtn} onClick={() => removeTodo(t.id)} aria-label="삭제">
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {aiTip && (
          <div className={styles.aiCard}>
            <span className={styles.aiIcon}><Sparkles size={18} /></span>
            <p className={styles.aiText}>{aiTip}</p>
          </div>
        )}
      </div>

      <button type="button" className={styles.fab} onClick={openNew} aria-label="할 일 추가">
        <Plus size={26} strokeWidth={2.4} />
      </button>

      {editorOpen && (
        <TodoEditor
          initial={editing}
          onClose={() => setEditorOpen(false)}
          onSave={(v) => {
            if (editing) {
              updateTodo(editing.id, { text: v.text, priority: v.priority, urgent: v.priority === 'urgent', time: v.time ?? '', assignee: v.assignee, progress: v.progress, memo: v.memo });
            } else {
              addTodo({ text: v.text, time: v.time, urgent: v.priority === 'urgent', priority: v.priority, progress: v.progress, assignee: v.assignee, memo: v.memo });
            }
            setEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}

// STYLE-EXCEPTION: 진행률은 런타임 동적 값이라 CSS 변수로 표현 불가
function progWidth(pct: number): React.CSSProperties {
  return { width: `${Math.max(0, Math.min(100, pct))}%` };
}

interface EditorVals { text: string; priority: OfficePriority; time?: string; assignee?: string; progress?: number; memo?: string }

function TodoEditor({
  initial, onClose, onSave,
}: {
  initial: OfficeTodo | null;
  onClose: () => void;
  onSave: (v: EditorVals) => void;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const [priority, setPriority] = useState<OfficePriority>(initial ? todoPriority(initial) : 'normal');
  const [time, setTime] = useState(initial?.time ?? '');
  const [assignee, setAssignee] = useState(initial?.assignee ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [progress, setProgress] = useState(initial?.progress ?? 0);

  const canSave = text.trim().length > 0;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="할 일 편집" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>{initial ? '할 일 수정' : '할 일 추가'}</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="닫기"><X size={20} /></button>
        </div>
        <div className={styles.modalBody}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>업무 내용</span>
            <input className={styles.input} value={text} onChange={(e) => setText(e.target.value)} placeholder="예) 계약서 검토" autoFocus maxLength={60} />
          </label>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>우선순위</span>
            <div className={styles.segRow}>
              {(['urgent', 'important', 'normal'] as OfficePriority[]).map((p) => (
                <button key={p} type="button" className={`${styles.segBtn} ${priority === p ? `${styles.segOn} ${PRIO[p].cls}` : ''}`} onClick={() => setPriority(p)}>
                  {PRIO[p].label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>마감 시각</span>
              <input className={styles.input} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>담당자</span>
              <input className={styles.input} value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="예) 김대리" maxLength={20} />
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>진행률 {progress}%</span>
            <input className={styles.range} type="range" min={0} max={100} step={10} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>메모</span>
            <textarea className={styles.textarea} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택)" rows={2} maxLength={200} />
          </label>
        </div>
        <button
          type="button"
          className={styles.saveBtn}
          disabled={!canSave}
          onClick={() => onSave({
            text: text.trim(),
            priority,
            time: time || undefined,
            assignee: assignee.trim() || undefined,
            memo: memo.trim() || undefined,
            progress: progress || undefined,
          })}
        >
          {initial ? '수정 저장' : '할 일 추가'}
        </button>
      </div>
    </div>
  );
}
