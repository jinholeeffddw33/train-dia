'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Heart, MoreVertical, Pencil, Trash2, X, Check, Plus, Paperclip, Send, CheckCircle2, RotateCcw, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useHazardStore, type HazardComment, type ReadStatusResponse } from '@/stores/hazard';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import { isAdmin } from '@/lib/auth';
import AttachmentLightbox from './AttachmentLightbox';
import styles from './Hazard.module.css';

// Stable empty array — prevents useSyncExternalStore from triggering infinite re-renders
// when comments[reportId] is undefined (React 19 + Zustand 5 strict reference equality check)
const EMPTY_COMMENTS: HazardComment[] = [];

const DOW_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const;

function formatDate(iso: string): string {
  if (!iso) return '';
  const normalized = iso.replace(' ', 'T').replace(/\+00$/, '+00:00');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseDateInfo(iso: string) {
  if (!iso) return null;
  const normalized = iso.replace(' ', 'T').replace(/\+00$/, '+00:00');
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  const day = d.getDay();
  return {
    month: `${d.getMonth() + 1}월`,
    date: String(d.getDate()),
    dow: DOW_FULL[day],
    isHoliday: day === 0 || day === 6,
    full: `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${DOW_FULL[day]}`,
  };
}

interface HazardDetailProps {
  reportId: string;
  onBack: () => void;
}

export default function HazardDetail({ reportId, onBack }: HazardDetailProps) {
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [readStatus, setReadStatus] = useState<ReadStatusResponse | null>(null);
  const [readStatusExpanded, setReadStatusExpanded] = useState(false);
  const [readStatusTab, setReadStatusTab] = useState<'unread' | 'read'>('unread');
  const bottomRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const report = useHazardStore((s) => s.reports.find((r) => r.id === reportId));
  const comments = useHazardStore((s) => s.comments[reportId] ?? EMPTY_COMMENTS);
  const loadingComments = useHazardStore((s) => s.loadingComments);
  const fetchComments = useHazardStore((s) => s.fetchComments);
  const addComment = useHazardStore((s) => s.addComment);
  const updateReport = useHazardStore((s) => s.updateReport);
  const deleteReport = useHazardStore((s) => s.deleteReport);
  const toggleResolved = useHazardStore((s) => s.toggleResolved);
  const updateComment = useHazardStore((s) => s.updateComment);
  const deleteComment = useHazardStore((s) => s.deleteComment);
  const toggleLike = useHazardStore((s) => s.toggleLike);
  const recordRead = useHazardStore((s) => s.recordRead);
  const fetchReadStatus = useHazardStore((s) => s.fetchReadStatus);
  const incrementView = useHazardStore((s) => s.incrementView);

  const driverName = useDriverStore((s) => (s.myDriver)?.n ?? '');
  const driverSabun = useDriverStore((s) => (s.myDriver)?.s ?? '');
  const authName = useAuthStore((s) => s.user?.name ?? '');
  const authSabun = useAuthStore((s) => s.user?.sabun ?? '');
  const name = authName || driverName;
  const sabun = authSabun || driverSabun;

  const isMyReport = report && name && report.createdBy === name;
  const adminUser = isAdmin(sabun);
  const canManage = isMyReport || adminUser;
  const isNotice = report?.category === 'inspect';

  // 번호 목록 편집은 "순수 공지사항"(태그 prefix 없음)에만 적용.
  // 열차정보·운전정보처럼 `[503편성] ...` 태그가 있는 inspect 글은 textarea 편집을 사용해야
  // 첫 줄의 태그가 보존되어 cardKey 필터에서 올바른 카테고리로 유지됨.
  const hasTagPrefix = ((report?.description ?? '').trim().startsWith('['));
  const isPureNotice = isNotice && !hasTagPrefix;

  // 열차 정보 편집: 위치 대신 편성 dropdown 노출
  const TRAIN_TAG_RE = /^(?:\d+|전)편성$/;
  const TRAIN_NUMBERS = Array.from({ length: 80 }, (_, i) => String(501 + i));
  const parseTaggedDesc = (desc: string): { tag: string; body: string } => {
    const normalized = (desc || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    const firstLine = (lines[0] || '').trim();
    const m = firstLine.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (!m) return { tag: '', body: normalized };
    const rest = m[2].trim();
    const remaining = lines.slice(1).join('\n');
    return { tag: m[1].trim(), body: rest + (remaining ? '\n' + remaining : '') };
  };
  const reportTag = parseTaggedDesc(report?.description ?? '').tag;
  // 태그가 편성 패턴이면 카테고리 무관하게 열차 정보 편집 폼 사용
  const isTrainEdit = TRAIN_TAG_RE.test(reportTag);
  // 운전 정보 분류 (시설물 / 열차 / 신호) 편집
  const DRIVING_KINDS = ['시설물', '열차', '신호'] as const;
  const isDrivingEdit = (DRIVING_KINDS as readonly string[]).includes(reportTag);
  // 사고사례 편집: category='action' → 사례교육 호수 + 분류 picker
  // 태그 형식: `사례교육 2026-N·분류` 또는 `분류` (legacy)
  const isIncidentEdit = report?.category === 'action';

  // 알림마당 수정용: description을 번호별 items로 파싱
  const [editItems, setEditItems] = useState<string[]>([]);
  const [removeFile, setRemoveFile] = useState(false);
  // 열차 정보 수정용: 편성번호 별도 상태
  const [editTrainTag, setEditTrainTag] = useState<string>('전');
  // 운전 정보 수정용: 분류 별도 상태
  const [editDrivingKind, setEditDrivingKind] = useState<string>('열차');
  // 사고사례 수정용: 사례교육 호수 + 분류
  const [editCaseEduNo, setEditCaseEduNo] = useState<string>('');
  const [editIncidentKind, setEditIncidentKind] = useState<string>('열차');

  const parseDescToItems = (desc: string): string[] => {
    const lines = desc.split('\n');
    return lines.map((l) => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
  };

  const itemsToDesc = (items: string[]): string => {
    return items.filter((s) => s.trim()).map((text, i) => `${i + 1}. ${text.trim()}`).join('\n');
  };

  useEffect(() => {
    fetchComments(reportId);
    if (sabun && name) recordRead(reportId, sabun, name);
    incrementView(reportId);
  }, [reportId, fetchComments, recordRead, incrementView, sabun, name]);

  // 읽음 현황: 진입 시 + 본인 읽음 기록 후 잠시 뒤 재조회 (본인 카운트 반영)
  useEffect(() => {
    let cancelled = false;
    fetchReadStatus(reportId).then((s) => { if (!cancelled) setReadStatus(s); });
    const t = window.setTimeout(() => {
      fetchReadStatus(reportId).then((s) => { if (!cancelled && s) setReadStatus(s); });
    }, 1200);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [reportId, fetchReadStatus]);

  // 메뉴 외부 클릭 닫기
  useEffect(() => {
    if (!showMenu && !commentMenuId) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setCommentMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu, commentMenuId]);

  const handleSend = async () => {
    if (!commentText.trim()) return;
    if (!name || !sabun) { setError('기관사 정보를 먼저 설정해주세요'); return; }

    setSubmitting(true);
    setError('');
    try {
      await addComment(reportId, commentText.trim(), name, sabun);
      setCommentText('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : '댓글 등록에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!name || !sabun) return;
    if (!window.confirm('정말 삭제하시겠습니까? 댓글과 사진도 모두 삭제됩니다.')) return;

    setError('');
    try {
      await deleteReport(reportId, name, sabun);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다');
    }
  };

  const handleToggleResolved = async () => {
    if (!name || !sabun || !report) return;
    const nextResolved = !report.resolved;
    const msg = nextResolved
      ? '조치완료로 표시하시겠습니까?'
      : '조치완료 표시를 해제하시겠습니까?';
    if (!window.confirm(msg)) return;
    setShowMenu(false);
    setError('');
    try {
      await toggleResolved(reportId, nextResolved, name, sabun);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조치완료 처리에 실패했습니다');
    }
  };

  const handleEditStart = () => {
    if (!report) return;
    setEditLocation(report.location);
    setRemoveFile(false);
    if (isPureNotice) {
      setEditDesc(report.description);
      setEditItems(parseDescToItems(report.description));
    } else if (isTrainEdit) {
      // 열차 정보: [편성] prefix 제거하고 body만 textarea로 편집
      const parsed = parseTaggedDesc(report.description);
      setEditTrainTag(parsed.tag.replace(/편성$/, ''));
      setEditDesc(parsed.body);
    } else if (isDrivingEdit) {
      // 운전 정보: [시설물/열차/신호] prefix 제거하고 body만 textarea로 편집
      const parsed = parseTaggedDesc(report.description);
      setEditDrivingKind(parsed.tag);
      setEditDesc(parsed.body);
    } else if (isIncidentEdit) {
      // 사고사례: 운전정보와 동일 포맷 — `[분류] 제목` + location에 호수
      const parsed = parseTaggedDesc(report.description);
      const kindPart = (DRIVING_KINDS as readonly string[]).includes(parsed.tag) ? parsed.tag : '';
      setEditIncidentKind(kindPart || '열차');
      setEditCaseEduNo(report.location || '');
      setEditDesc(parsed.body);
    } else {
      setEditDesc(report.description);
    }
    setEditMode(true);
    setShowMenu(false);
  };

  const handleEditSave = async () => {
    let desc: string;
    if (isPureNotice) {
      desc = itemsToDesc(editItems);
    } else if (isTrainEdit) {
      const tag = editTrainTag.trim() || '전';
      desc = `[${tag}편성] ${editDesc.trim()}`;
    } else if (isDrivingEdit) {
      const kind = (DRIVING_KINDS as readonly string[]).includes(editDrivingKind) ? editDrivingKind : '열차';
      desc = `[${kind}] ${editDesc.trim()}`;
    } else if (isIncidentEdit) {
      const kind = (DRIVING_KINDS as readonly string[]).includes(editIncidentKind) ? editIncidentKind : '열차';
      desc = `[${kind}] ${editDesc.trim()}`;
    } else {
      desc = editDesc.trim();
    }
    if (!desc || !name || !sabun) return;
    // 호수는 location 컬럼에 저장 (사고사례=editCaseEduNo, 그 외=editLocation)
    const finalLocation = isIncidentEdit ? editCaseEduNo.trim() : editLocation.trim();
    setError('');
    try {
      await updateReport(reportId, desc, finalLocation, name, sabun, removeFile || undefined);
      setEditMode(false);
      setRemoveFile(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정에 실패했습니다');
    }
  };

  const handleLike = async () => {
    if (!name || !sabun) { setError('기관사 정보를 먼저 설정해주세요'); return; }
    setError('');
    try {
      await toggleLike(reportId, name, sabun);
    } catch (e) {
      setError(e instanceof Error ? e.message : '좋아요에 실패했습니다');
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    if (!name || !sabun) return;
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
    setError('');
    setCommentMenuId(null);
    try {
      await deleteComment(reportId, commentId, name, sabun);
    } catch (e) {
      setError(e instanceof Error ? e.message : '댓글 삭제에 실패했습니다');
    }
  };

  const handleCommentEditStart = (c: HazardComment) => {
    setEditingCommentId(c.id);
    setEditCommentText(c.comment);
    setCommentMenuId(null);
  };

  const handleCommentEditSave = async () => {
    if (!editingCommentId || !editCommentText.trim() || !name || !sabun) return;
    setError('');
    try {
      await updateComment(reportId, editingCommentId, editCommentText.trim(), name, sabun);
      setEditingCommentId(null);
      setEditCommentText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '댓글 수정에 실패했습니다');
    }
  };

  if (!report) {
    return (
      <div className={styles.detailWrap}>
        <header className={styles.detailHeader}>
          <button type="button" className={styles.detailBackBtn} onClick={onBack} aria-label="뒤로">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h1 className={styles.detailTitle}>상세보기</h1>
        </header>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>게시물을 찾을 수 없어요</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.detailWrap}>
      <header className={styles.detailHeader}>
        <button type="button" className={styles.detailBackBtn} onClick={onBack} aria-label="뒤로">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.detailTitle}>상세보기</h1>
        {canManage && (
          <div className={styles.menuWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setShowMenu((v) => !v)}
              aria-label="더보기"
            >
              <MoreVertical size={20} strokeWidth={2} />
            </button>
            {showMenu && (
              <div className={styles.menuDropdown}>
                {report?.category === 'hazard' && (
                  <button type="button" className={styles.menuItem} onClick={handleToggleResolved}>
                    {report.resolved ? (
                      <><RotateCcw size={16} /> 조치완료 해제</>
                    ) : (
                      <><CheckCircle2 size={16} /> 조치완료 표시</>
                    )}
                  </button>
                )}
                {isMyReport && (
                  <button type="button" className={styles.menuItem} onClick={handleEditStart}>
                    <Pencil size={16} /> 수정
                  </button>
                )}
                <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleDelete}>
                  <Trash2 size={16} /> 삭제
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <div className={styles.detailScroll}>
        {/* 사진 — 빈 URL/placeholder 숨김 + 로드 실패 시 숨김. 탭하면 라이트박스로 확대 */}
        {report.photoUrl && !report.photoUrl.includes('placeholder') && report.photoUrl.length > 10 && (
          <button
            type="button"
            className={styles.detailPhotoBtn}
            onClick={() => setLightboxOpen(true)}
            aria-label="사진 크게 보기"
          >
            <img
              src={report.photoUrl}
              alt="첨부 사진"
              className={styles.detailPhoto}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </button>
        )}

        {/* 내용 */}
        <div className={styles.detailContent}>
          {report.category === 'hazard' && report.resolved && (
            <div className={styles.resolvedBanner}>
              <CheckCircle2 size={18} strokeWidth={2.4} />
              <span>
                조치완료
                {report.resolvedBy && <span className={styles.resolvedBy}> · {report.resolvedBy}</span>}
                {report.resolvedAt && <span className={styles.resolvedAt}> · {new Date(report.resolvedAt).toLocaleDateString('ko-KR')}</span>}
              </span>
            </div>
          )}
          {editMode ? (
            isPureNotice ? (
              /* 공지사항 수정: 번호별 항목 편집 (태그 prefix 없는 순수 공지) */
              <>
                <div className={styles.noticeEditHeader}>공지사항 수정</div>
                <div className={styles.noticeItemList}>
                  {editItems.map((text, i) => (
                    <div key={i} className={`${styles.noticeItem} ${i < 2 ? styles.noticeItemHighlight : ''}`}>
                      <span className={`${styles.noticeItemNum} ${i < 2 ? styles.noticeItemNumHighlight : ''}`}>{i + 1}</span>
                      <input
                        type="text"
                        className={styles.noticeItemInput}
                        placeholder={i < 2 ? '강조 항목' : `${i + 1}번 항목`}
                        value={text}
                        onChange={(e) => { const next = [...editItems]; next[i] = e.target.value; setEditItems(next); }}
                        maxLength={200}
                      />
                      {editItems.length > 1 && (
                        <button type="button" className={styles.noticeItemDel} onClick={() => setEditItems(editItems.filter((_, j) => j !== i))}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {editItems.length < 10 && (
                  <button type="button" className={styles.noticeAddBtn} onClick={() => setEditItems([...editItems, ''])}>
                    <Plus size={14} /> 항목 추가
                  </button>
                )}
                {/* 첨부파일 삭제 */}
                {report.photoUrl && !report.photoUrl.includes('placeholder') && report.photoUrl !== '' && (
                  <div className={styles.fileDeleteWrap}>
                    <Paperclip size={14} />
                    <span className={styles.fileDeleteName}>첨부파일</span>
                    {removeFile ? (
                      <span className={styles.fileDeletedLabel}>삭제 예정 (저장 시 적용)</span>
                    ) : (
                      <button type="button" className={styles.fileDeleteBtn} onClick={() => setRemoveFile(true)}>
                        <Trash2 size={14} /> 삭제
                      </button>
                    )}
                  </div>
                )}
                <div className={styles.editActions}>
                  <button type="button" className={styles.editCancelBtn} onClick={() => setEditMode(false)}>
                    <X size={16} /> 취소
                  </button>
                  <button type="button" className={styles.editSaveBtn} onClick={handleEditSave} disabled={editItems.every((s) => !s.trim())}>
                    <Check size={16} /> 저장
                  </button>
                </div>
              </>
            ) : isTrainEdit ? (
              /* 열차 정보 수정: 위치 대신 편성 dropdown */
              <>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>편성</label>
                  <select
                    className={styles.textInput}
                    value={editTrainTag}
                    onChange={(e) => setEditTrainTag(e.target.value)}
                  >
                    <option value="전">전편성</option>
                    {TRAIN_NUMBERS.map((n) => (
                      <option key={n} value={n}>{n}편성</option>
                    ))}
                  </select>
                </div>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>설명</label>
                  <textarea className={styles.textArea} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} maxLength={1000} />
                </div>
                <div className={styles.editActions}>
                  <button type="button" className={styles.editCancelBtn} onClick={() => setEditMode(false)}>
                    <X size={16} /> 취소
                  </button>
                  <button type="button" className={styles.editSaveBtn} onClick={handleEditSave} disabled={!editDesc.trim()}>
                    <Check size={16} /> 저장
                  </button>
                </div>
              </>
            ) : isDrivingEdit ? (
              /* 운전 정보 수정: 분류(시설물/열차/신호) + 호수 + 설명 */
              <>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>분류</label>
                  <div className={styles.kindRow}>
                    {DRIVING_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={`${styles.kindBtn} ${editDrivingKind === k ? styles.kindBtnActive : ''}`}
                        onClick={() => setEditDrivingKind(k)}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>호수 (예: 1호)</label>
                  <input type="text" className={styles.textInput} value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="예: 1호" maxLength={20} />
                </div>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>설명</label>
                  <textarea className={styles.textArea} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} maxLength={1000} />
                </div>
                <div className={styles.editActions}>
                  <button type="button" className={styles.editCancelBtn} onClick={() => setEditMode(false)}>
                    <X size={16} /> 취소
                  </button>
                  <button type="button" className={styles.editSaveBtn} onClick={handleEditSave} disabled={!editDesc.trim()}>
                    <Check size={16} /> 저장
                  </button>
                </div>
              </>
            ) : isIncidentEdit ? (
              /* 사고사례 수정: 분류(시설물/열차/신호) + 사례교육 호수 + 설명 */
              <>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>분류</label>
                  <div className={styles.kindRow}>
                    {DRIVING_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className={`${styles.kindBtn} ${editIncidentKind === k ? styles.kindBtnActive : ''}`}
                        onClick={() => setEditIncidentKind(k)}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>사례교육 호수 (예: 2026-1)</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={editCaseEduNo}
                    onChange={(e) => setEditCaseEduNo(e.target.value)}
                    placeholder="예: 2026-1"
                    maxLength={20}
                  />
                </div>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>설명</label>
                  <textarea className={styles.textArea} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} maxLength={1000} />
                </div>
                <div className={styles.editActions}>
                  <button type="button" className={styles.editCancelBtn} onClick={() => setEditMode(false)}>
                    <X size={16} /> 취소
                  </button>
                  <button type="button" className={styles.editSaveBtn} onClick={handleEditSave} disabled={!editDesc.trim()}>
                    <Check size={16} /> 저장
                  </button>
                </div>
              </>
            ) : (
              /* 일반 수정 */
              <>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>위치</label>
                  <input type="text" className={styles.textInput} value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="위치 (선택)" maxLength={100} />
                </div>
                <div className={styles.editField}>
                  <label className={styles.editLabel}>설명</label>
                  <textarea className={styles.textArea} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} maxLength={1000} />
                </div>
                <div className={styles.editActions}>
                  <button type="button" className={styles.editCancelBtn} onClick={() => setEditMode(false)}>
                    <X size={16} /> 취소
                  </button>
                  <button type="button" className={styles.editSaveBtn} onClick={handleEditSave} disabled={!editDesc.trim()}>
                    <Check size={16} /> 저장
                  </button>
                </div>
              </>
            )
          ) : (
            <>
              {/* 날짜 + 요일 강조 + 작성자 — 그라데이션 헤더 카드 */}
              {(() => {
                const di = parseDateInfo(report.createdAt);
                const isImportant = report.location === '중요알림';
                const headerCardClass = `${styles.detailHeaderCard} ${isImportant ? styles.detailHeaderCardImportant : styles.detailHeaderCardRollcall}`;
                return (
                  <div className={headerCardClass}>
                    <div className={styles.detailHeaderRow}>
                      {report.location && (
                        <span className={`${styles.noticeType} ${isImportant ? styles.noticeTypeImportant : styles.noticeTypeRollcall}`}>
                          {/* 운전 정보(driving)는 "운전정보 N호" 로 정확히 표기, 그 외는 location 그대로 */}
                          {isDrivingEdit && /^\d+호$/.test(report.location) ? `운전정보 ${report.location}` : report.location}
                        </span>
                      )}
                      {di && (
                        <span className={styles.noticeDateWrap}>
                          <span className={styles.noticeDateMonth}>{di.month}</span>
                          <span className={styles.noticeDateDay}>{di.date}</span>
                          <span className={`${styles.noticeDateDow} ${di.isHoliday ? styles.noticeDateHoliday : ''}`}>{di.dow}</span>
                        </span>
                      )}
                      <span className={styles.detailAuthorWrap}>
                        <span className={styles.authorAvatar}>{report.createdBy.charAt(0)}</span>
                        <span className={styles.detailAuthor}>{report.createdBy}</span>
                      </span>
                    </div>
                  </div>
                );
              })()}

              {!isNotice && report.location && (
                <span className={styles.detailLocation}>📍 {report.location}</span>
              )}

              {/* 본문 + 첨부 + 좋아요/조회 통합 카드 */}
              <div className={styles.detailBodyCard}>
                {isNotice ? (
                  <div className={styles.noticeBody}>
                    {report.description.split('\n').map((line, i) => {
                      const num = parseInt(line);
                      const isHighlight = num === 1 || num === 2;
                      return (
                        <div key={i} className={`${styles.noticeLine} ${isHighlight ? styles.noticeLineHighlight : ''}`}>
                          {line}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.detailDesc}>{report.description}</p>
                )}

                {/* 첨부파일 — 클릭 시 라이트박스로 인앱 열람 (이미지) 또는 다운로드 */}
                {isNotice && report.photoUrl && !report.photoUrl.includes('placeholder') && report.photoUrl.length > 10 && (
                  <button
                    type="button"
                    className={styles.noticeFileLink}
                    onClick={() => setLightboxOpen(true)}
                  >
                    <Paperclip size={14} /> 첨부파일 보기
                  </button>
                )}

                {/* 좋아요 + 확인 상태 */}
                <div className={styles.likeSection}>
                  <button
                    type="button"
                    className={`${styles.likeBtn} ${report.likedByMe ? styles.likeBtnActive : ''}`}
                    onClick={handleLike}
                    aria-label={report.likedByMe ? '좋아요 취소' : '좋아요'}
                  >
                    <Heart
                      size={20}
                      fill={report.likedByMe ? 'var(--dia-red)' : 'none'}
                      stroke={report.likedByMe ? 'var(--dia-red)' : 'currentColor'}
                    />
                    <span className={styles.likeCount}>{report.likeCount}</span>
                  </button>
                  {/* 순수 공지사항만 확인 배지 미표시 — 위험·조치·열차·운전 정보는 유지 */}
                  {!isPureNotice && (
                    <span className={styles.confirmedBadge} aria-label="확인 완료">
                      <Check size={16} strokeWidth={3} />
                      <span>확인 완료</span>
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.divider} />

        {/* 읽음 현황 — 펼침 카드 (전 직원 기준, 인턴·제외명단 제외) */}
        <div className={styles.readStatusSection}>
          <button
            type="button"
            className={styles.readStatusHeader}
            onClick={() => setReadStatusExpanded((v) => !v)}
            aria-expanded={readStatusExpanded}
          >
            <Users size={16} strokeWidth={2.2} />
            <span className={styles.readStatusHeaderLabel}>읽음 현황</span>
            {readStatus ? (
              <span className={styles.readStatusCount}>
                <strong>{readStatus.readCount}</strong>
                <span>/ {readStatus.totalExpected}</span>
              </span>
            ) : (
              <span className={styles.readStatusCount}>불러오는 중...</span>
            )}
            {readStatusExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {readStatusExpanded && readStatus && (
            <div className={styles.readStatusBody}>
              <div className={styles.readStatusTabs} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={readStatusTab === 'unread'}
                  className={`${styles.readStatusTab} ${readStatusTab === 'unread' ? styles.readStatusTabActive : ''}`}
                  onClick={() => setReadStatusTab('unread')}
                >
                  안 읽음 <span className={styles.readStatusTabNum}>{readStatus.nonReaders.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={readStatusTab === 'read'}
                  className={`${styles.readStatusTab} ${readStatusTab === 'read' ? styles.readStatusTabActive : ''}`}
                  onClick={() => setReadStatusTab('read')}
                >
                  읽음 <span className={styles.readStatusTabNum}>{readStatus.readers.length}</span>
                </button>
              </div>

              {readStatusTab === 'unread' ? (
                readStatus.nonReaders.length === 0 ? (
                  <p className={styles.readStatusEmpty}>모두 읽었습니다 🎉</p>
                ) : (
                  <div className={styles.readStatusChips}>
                    {readStatus.nonReaders.map((p) => (
                      <span key={p.sabun} className={`${styles.readChip} ${styles.readChipUnread}`}>
                        {p.name || p.sabun}
                      </span>
                    ))}
                  </div>
                )
              ) : readStatus.readers.length === 0 ? (
                <p className={styles.readStatusEmpty}>아직 읽은 사람이 없습니다</p>
              ) : (
                <div className={styles.readStatusChips}>
                  {readStatus.readers.map((p) => (
                    <span key={p.sabun} className={`${styles.readChip} ${styles.readChipRead}`}>
                      {p.name || p.sabun}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.divider} />

        {/* 댓글 섹션 */}
        <div className={styles.commentsSection}>
          <h2 className={styles.commentsTitle}>
            댓글 <span className={styles.commentsCount}>{comments.length}</span>
          </h2>

          {loadingComments && comments.length === 0 ? (
            <div className={styles.loadingState}>
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} />
              <span className={styles.loadingDot} />
            </div>
          ) : comments.length === 0 ? (
            <div className={styles.emptyComments}>
              <p>첫 댓글을 달아주세요</p>
            </div>
          ) : (
            <div className={styles.commentList}>
              {comments.map((c) => {
                const isMyComment = name && c.createdBy === name;
                const isEditing = editingCommentId === c.id;

                return (
                  <div key={c.id} className={styles.commentCard}>
                    <span className={styles.authorAvatar}>{c.createdBy.charAt(0)}</span>
                    <div className={styles.commentBody}>
                      <div className={styles.commentHeader}>
                        <span className={styles.commentAuthor}>{c.createdBy}</span>
                        <div className={styles.commentHeaderRight}>
                          <span className={styles.commentTime}>{formatDate(c.createdAt)}</span>
                          {isMyComment && !isEditing && (
                            <div className={styles.commentMenuWrap}>
                              <button
                                type="button"
                                className={styles.commentMenuBtn}
                                onClick={() => setCommentMenuId(commentMenuId === c.id ? null : c.id)}
                                aria-label="댓글 더보기"
                              >
                                <MoreVertical size={14} />
                              </button>
                              {commentMenuId === c.id && (
                                <div className={styles.commentMenuDropdown} ref={menuRef}>
                                  <button type="button" className={styles.menuItem} onClick={() => handleCommentEditStart(c)}>
                                    <Pencil size={14} /> 수정
                                  </button>
                                  <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => handleCommentDelete(c.id)}>
                                    <Trash2 size={14} /> 삭제
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <div className={styles.commentEditWrap}>
                          <textarea
                            className={styles.commentEditInput}
                            value={editCommentText}
                            onChange={(e) => setEditCommentText(e.target.value)}
                            rows={2}
                            maxLength={500}
                          />
                          <div className={styles.commentEditActions}>
                            <button
                              type="button"
                              className={styles.commentEditCancel}
                              onClick={() => { setEditingCommentId(null); setEditCommentText(''); }}
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              className={styles.commentEditSave}
                              onClick={handleCommentEditSave}
                              disabled={!editCommentText.trim()}
                            >
                              저장
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className={styles.commentText}>{c.comment}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 스크롤 앵커 */}
        <div ref={bottomRef} className={styles.commentAnchor} />
      </div>

      {/* 댓글 입력 (하단 고정) */}
      <div className={styles.commentInputWrap}>
        {error && <p className={styles.commentError}>{error}</p>}
        <div className={styles.commentInputRow}>
          <textarea
            className={styles.commentInput}
            placeholder="댓글을 입력하세요..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={1}
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            type="button"
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={submitting || !commentText.trim()}
            aria-label="댓글 등록"
          >
            {submitting ? '...' : <Send size={18} />}
          </button>
        </div>
      </div>

      {/* 첨부파일 라이트박스 — 이미지면 인라인 표시, 그 외엔 다운로드 */}
      {lightboxOpen && report.photoUrl && (
        <AttachmentLightbox url={report.photoUrl} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}
