'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Calendar, Search, Send, Check, X, Trash2, Bell, Megaphone, Hand, Info } from 'lucide-react';
import { useDriverStore } from '@/stores/driver';
import { useExchangeStore, type ExchangePost } from '@/stores/exchange';
import { showToast } from '@/components/common/Toast';
import { getDia, getType, getDiaDisplay, isHoliday as checkHoliday } from '@/lib/schedule';
import { DOW } from '@/lib/constants';
import { P } from '@/data/cycle';
import type { Person } from '@/lib/types';
import styles from '../styles/Exchange.module.css';

const WISH_TYPES = ['주간', '야간', '비번', '휴무'] as const;
type WishType = typeof WISH_TYPES[number];

type SubTab = 'search' | 'board';

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`;
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

/** WishType → DiaType/dia 패턴 매칭 */
function matchesWish(dia: string, wish: WishType): boolean {
  const type = getType(dia);
  switch (wish) {
    case '주간': return type === 'day';
    case '야간': return type === 'night' || (type === 'standby' && parseInt(dia.replace('대', '')) >= 61);
    case '비번': return dia.endsWith('~');
    case '휴무': return dia.startsWith('휴');
  }
}

/** 교번+날짜 → 행로 이미지 경로 */
function getRouteImagePath(dia: string, date: Date): string | null {
  if (dia.startsWith('휴') || dia.startsWith('대') || dia.endsWith('~')) return null;
  const diaNum = parseInt(dia.replace(/\D/g, ''));
  if (isNaN(diaNum)) return null;
  const h = checkHoliday(date);
  const tm = new Date(date);
  tm.setDate(tm.getDate() + 1);
  const th = checkHoliday(tm);
  const isNight = getType(dia) === 'night';
  let prefix: string;
  if (!isNight) { prefix = h ? 'p_hol' : 'p_ord'; }
  else if (h && th) prefix = 'p_hh';
  else if (h && !th) prefix = 'p_hp';
  else if (!h && th) prefix = 'p_ph';
  else prefix = 'p_pp';
  return `/images/route/${prefix}_${diaNum}.png`;
}

/** 오늘 기준 14일 미리보기 배열 */
function buildPreviewDays(): Date[] {
  const days: Date[] = [];
  const d = new Date();
  for (let i = 0; i < 14; i++) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export default function ExchangeRequest() {
  const driver = useDriverStore((s) => s.myDriver);
  const isViewMode = useDriverStore((s) => s.isViewMode);
  const todayStr = toISODate(new Date());
  const previewDays = useMemo(buildPreviewDays, []);

  // Supabase에서 게시글 로드 + 실시간 구독
  const fetchPosts = useExchangeStore((s) => s.fetchPosts);
  const subscribe = useExchangeStore((s) => s.subscribe);
  useEffect(() => {
    fetchPosts();
    const unsubscribe = subscribe();
    return unsubscribe;
  }, [fetchPosts, subscribe]);

  const [subTab, setSubTab] = useState<SubTab>('search');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [wishes, setWishes] = useState<Record<string, WishType>>({});
  const [memo, setMemo] = useState('');
  const [searched, setSearched] = useState(false);

  const posts = useExchangeStore((s) => s.posts);
  // 게시판 배지: 나에게 온 요청 + 내가 올린 대기 중 게시물
  const pendingCount = driver
    ? posts.filter((p) =>
        p.status === 'pending' && (
          (p.type === 'direct' && p.targetId === driver.I) ||
          (p.type === 'open' && p.requesterId === driver.I && p.volunteers.length > 0) ||
          (p.type === 'direct' && p.requesterId === driver.I)
        )
      ).length
    : 0;

  // 시작일~종료일 날짜 배열 (최대 7일)
  const dateRange = useMemo(() => {
    const start = fromISODate(startDate);
    const end = fromISODate(endDate);
    if (end < start) return [];
    const dates: Date[] = [];
    const d = new Date(start);
    while (d <= end && dates.length < 8) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate]);

  // 희망 근무 선택
  const handleWish = useCallback((dateKey: string, type: WishType) => {
    setWishes(prev => {
      if (prev[dateKey] === type) {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      }
      return { ...prev, [dateKey]: type };
    });
    setSearched(false);
  }, []);

  // 매칭 검색
  const matchResults = useMemo(() => {
    if (!searched) return [];
    const wishEntries = Object.entries(wishes);
    if (wishEntries.length === 0) return [];

    return P.filter(p => {
      if (driver && p.I === driver.I) return false;
      return wishEntries.every(([dateStr, wish]) => {
        const date = fromISODate(dateStr);
        const dia = getDia(p, date);
        return matchesWish(dia, wish);
      });
    });
  }, [searched, wishes, driver]);

  const handleSearch = () => {
    setSearched(true);
  };

  const wishCount = Object.keys(wishes).length;

  // 미리보기 날짜 클릭: 2탭 범위 선택
  const [pickPhase, setPickPhase] = useState<'start' | 'end'>('start');

  const handlePreviewTap = useCallback((date: Date) => {
    const iso = toISODate(date);

    if (iso === startDate && startDate === endDate) {
      setStartDate(todayStr);
      setEndDate(todayStr);
      setPickPhase('start');
      setSearched(false);
      return;
    }

    if (pickPhase === 'start') {
      setStartDate(iso);
      setEndDate(iso);
      setPickPhase('end');
    } else {
      if (iso === startDate) {
        setPickPhase('start');
      } else if (iso < startDate) {
        setEndDate(startDate);
        setStartDate(iso);
        setPickPhase('start');
      } else {
        setEndDate(iso);
        setPickPhase('start');
      }
    }
    setSearched(false);
  }, [pickPhase, startDate, endDate, todayStr]);

  return (
    <div className={styles.container}>
      <h2 className={styles.pageTitle}>교번 교체</h2>

      {/* 서브 탭 */}
      <div className={styles.subTabs} role="tablist" aria-label="교체 탭">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'search'}
          className={`${styles.subTab} ${subTab === 'search' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('search')}
        >
          <Search size={16} />
          매칭 검색
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'board'}
          className={`${styles.subTab} ${subTab === 'board' ? styles.subTabActive : ''}`}
          onClick={() => setSubTab('board')}
        >
          <Bell size={16} />
          게시판
          {pendingCount > 0 && (
            <span className={styles.subTabBadge}>{pendingCount}</span>
          )}
        </button>
      </div>

      {subTab === 'search' ? (
        <SearchView
          driver={driver}
          todayStr={todayStr}
          previewDays={previewDays}
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          wishes={wishes}
          handleWish={handleWish}
          memo={memo}
          setMemo={setMemo}
          searched={searched}
          handleSearch={handleSearch}
          wishCount={wishCount}
          handlePreviewTap={handlePreviewTap}
          dateRange={dateRange}
          matchResults={matchResults}
          pickPhase={pickPhase}
        />
      ) : (
        <BoardView driver={driver} />
      )}
    </div>
  );
}

/* ─── 검색 뷰 ─── */
interface SearchViewProps {
  driver: Person | null;
  todayStr: string;
  previewDays: Date[];
  startDate: string;
  endDate: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  wishes: Record<string, WishType>;
  handleWish: (key: string, type: WishType) => void;
  memo: string;
  setMemo: (v: string) => void;
  searched: boolean;
  handleSearch: () => void;
  wishCount: number;
  handlePreviewTap: (d: Date) => void;
  dateRange: Date[];
  matchResults: Person[];
  pickPhase: 'start' | 'end';
}

function SearchView({
  driver, todayStr, previewDays, startDate, endDate,
  setStartDate, setEndDate, wishes, handleWish, memo, setMemo,
  searched, handleSearch, wishCount, handlePreviewTap,
  dateRange, matchResults, pickPhase,
}: SearchViewProps) {
  const addPost = useExchangeStore((s) => s.addPost);
  const posts = useExchangeStore((s) => s.posts);
  const [openPosted, setOpenPosted] = useState(false);

  // 이미 같은 날짜로 전체 공지를 올렸는지
  const alreadyOpenPosted = useMemo(() => {
    if (!driver || dateRange.length === 0) return false;
    const dateKeys = dateRange.map(toISODate);
    return posts.some(
      (p) =>
        p.type === 'open' &&
        p.requesterId === driver.I &&
        p.status === 'pending' &&
        JSON.stringify(p.dates) === JSON.stringify(dateKeys),
    );
  }, [posts, driver, dateRange]);

  const handleOpenPost = () => {
    if (!driver || dateRange.length === 0 || alreadyOpenPosted || openPosted) return;

    const dates = dateRange.map(toISODate);
    const requesterDias: Record<string, string> = {};
    dateRange.forEach((date) => {
      const key = toISODate(date);
      requesterDias[key] = getDiaDisplay(getDia(driver, date));
    });

    addPost({
      type: 'open',
      requesterId: driver.I,
      requesterName: driver.n,
      targetId: '',
      targetName: '',
      dates,
      requesterDias,
      targetDias: {},
      memo,
    });
    setOpenPosted(true);
    showToast('전체 공지가 등록되었어요', 'success');
  };

  const isOpenDone = openPosted || alreadyOpenPosted;

  return (
    <>
      {/* 내 근무 미리보기 스트립 */}
      {driver && (
        <div className={styles.previewSection}>
          <h3 className={styles.previewLabel}>
            내 근무 (2주)
            <span className={styles.pickHint}>
              {pickPhase === 'start' ? '시작일을 선택하세요' : '종료일을 선택하세요'}
            </span>
          </h3>
          <div className={styles.previewScroll}>
            {previewDays.map((date) => {
              const key = toISODate(date);
              const dia = getDia(driver, date);
              const type = getType(dia);
              const display = getDiaDisplay(dia);
              const isSelected = key >= startDate && key <= endDate;
              const isToday = key === todayStr;

              return (
                <button
                  key={key}
                  type="button"
                  className={`${styles.previewDay} ${isSelected ? styles.previewDaySelected : ''} ${isToday ? styles.previewDayToday : ''}`}
                  onClick={() => handlePreviewTap(date)}
                >
                  <span className={styles.previewDow}>{DOW[date.getDay()]}</span>
                  <span className={styles.previewDate}>{date.getDate()}</span>
                  <span className={`${styles.previewDia} ${styles[`dia_${type}`]}`}>{display}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 날짜 선택 */}
      <div className={styles.dateRow}>
        <span className={styles.dateLabel}>희망일</span>
        <label className={styles.dateBtn}>
          <Calendar size={14} />
          <span>{formatShort(fromISODate(startDate))}</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (e.target.value > endDate) setEndDate(e.target.value);
            }}
            className={styles.dateInput}
          />
        </label>
        <span className={styles.dateSep}>~</span>
        <label className={styles.dateBtn}>
          <Calendar size={14} />
          <span>{formatShort(fromISODate(endDate))}</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={styles.dateInput}
          />
        </label>
      </div>

      {/* 교체 희망 근무 */}
      <h3 className={styles.sectionTitle}>교체 희망 근무</h3>

      <div className={styles.dayList}>
        {dateRange.map((date) => {
          const key = toISODate(date);
          const dia = driver ? getDia(driver, date) : '-';
          const type = getType(dia);
          const display = getDiaDisplay(dia);
          const selected = wishes[key];

          return (
            <div key={key} className={styles.dayRow}>
              <div className={styles.dayInfo}>
                <span className={styles.dayDate}>{formatShort(date)}</span>
                <span className={`${styles.dayDia} ${styles[`dia_${type}`]}`}>{display}</span>
              </div>
              <div className={styles.wishBtns}>
                {WISH_TYPES.map((wt) => (
                  <button
                    key={wt}
                    type="button"
                    className={`${styles.wishBtn} ${selected === wt ? styles[`wish_${wt}`] : ''}`}
                    onClick={() => handleWish(key, wt)}
                  >
                    {wt}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {dateRange.length === 0 && (
        <p className={styles.hint}>시작일과 종료일을 선택하세요</p>
      )}

      {/* 메모 */}
      <div className={styles.memoSection}>
        <h3 className={styles.sectionTitle}>메모</h3>
        <textarea
          className={styles.memoInput}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="교체 사유나 참고 사항을 적어주세요"
          rows={3}
        />
      </div>

      {/* 액션 버튼 영역 */}
      {dateRange.length > 0 && driver && (
        <div className={styles.actionBtns}>
          {/* 전체 공지 올리기 */}
          <button
            type="button"
            className={`${styles.openPostBtn} ${isOpenDone ? styles.openPostBtnDone : ''}`}
            onClick={handleOpenPost}
            disabled={isOpenDone}
          >
            {isOpenDone ? (
              <>
                <Check size={18} />
                전체 공지 등록됨
              </>
            ) : (
              <>
                <Megaphone size={18} />
                전체 공지 올리기
              </>
            )}
          </button>

          {/* 매칭 검색 */}
          {wishCount > 0 && (
            <button
              type="button"
              className={styles.searchBtn}
              onClick={handleSearch}
            >
              <Search size={18} />
              매칭되는 기관사 찾기
            </button>
          )}
        </div>
      )}

      {/* 매칭 결과 */}
      {searched && (
        <div className={styles.resultSection}>
          <h3 className={styles.sectionTitle}>
            매칭 결과 <span className={styles.resultCount}>{matchResults.length}명</span>
          </h3>
          {matchResults.length === 0 ? (
            <p className={styles.noResult}>조건에 맞는 기관사가 없어요</p>
          ) : (
            <div className={styles.resultList}>
              {matchResults.map((p) => (
                <MatchCard
                  key={p.I}
                  person={p}
                  dateRange={dateRange}
                  driver={driver}
                  memo={memo}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ─── 매칭 카드 (1:1 요청) ─── */
function MatchCard({
  person,
  dateRange,
  driver,
  memo,
}: {
  person: Person;
  dateRange: Date[];
  driver: Person | null;
  memo: string;
}) {
  const addPost = useExchangeStore((s) => s.addPost);
  const posts = useExchangeStore((s) => s.posts);
  const [sent, setSent] = useState(false);
  const [routePreview, setRoutePreview] = useState<{ dia: string; date: Date; imgPath: string } | null>(null);

  const alreadySent = useMemo(() => {
    if (!driver) return false;
    const dateKeys = dateRange.map(toISODate);
    return posts.some(
      (p) =>
        p.type === 'direct' &&
        p.requesterId === driver.I &&
        p.targetId === person.I &&
        p.status === 'pending' &&
        JSON.stringify(p.dates) === JSON.stringify(dateKeys),
    );
  }, [posts, driver, person.I, dateRange]);

  const handleSend = () => {
    if (!driver || alreadySent || sent) return;

    const dates = dateRange.map(toISODate);
    const requesterDias: Record<string, string> = {};
    const targetDias: Record<string, string> = {};

    dateRange.forEach((date) => {
      const key = toISODate(date);
      requesterDias[key] = getDiaDisplay(getDia(driver, date));
      targetDias[key] = getDiaDisplay(getDia(person, date));
    });

    addPost({
      type: 'direct',
      requesterId: driver.I,
      requesterName: driver.n,
      targetId: person.I,
      targetName: person.n,
      dates,
      requesterDias,
      targetDias,
      memo,
    });
    setSent(true);
    showToast(`${person.n}에게 교체 요청을 보냈어요`, 'success');
  };

  const isSent = sent || alreadySent;

  return (
    <div className={styles.matchCard}>
      <div className={styles.matchHeader}>
        <span className={styles.matchAvatar}>{person.n[0]}</span>
        <span className={styles.matchName}>{person.n}</span>
        <button
          type="button"
          className={`${styles.sendBtn} ${isSent ? styles.sendBtnSent : ''}`}
          onClick={handleSend}
          disabled={isSent}
          aria-label={isSent ? '요청 완료' : `${person.n}에게 교체 요청`}
        >
          {isSent ? (
            <>
              <Check size={14} />
              요청됨
            </>
          ) : (
            <>
              <Send size={14} />
              교체 요청
            </>
          )}
        </button>
      </div>
      <div className={styles.matchDias}>
        {dateRange.map((date) => {
          const key = toISODate(date);
          const dia = getDia(person, date);
          const type = getType(dia);
          const display = getDiaDisplay(dia);
          const imgPath = getRouteImagePath(dia, date);
          return (
            <div key={key} className={styles.matchDay}>
              <span className={styles.matchDayLabel}>{formatShort(date)}</span>
              {imgPath ? (
                <button
                  type="button"
                  className={`${styles.matchDayDia} ${styles[`dia_${type}`]} ${styles.matchDiaBtn}`}
                  onClick={() => setRoutePreview({ dia, date, imgPath })}
                  aria-label={`${display}번 근무 행로 보기`}
                >
                  {display}
                </button>
              ) : (
                <span className={`${styles.matchDayDia} ${styles[`dia_${type}`]}`}>{display}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 행로 이미지 미리보기 */}
      {routePreview && (
        <div className={styles.routeOverlay} onClick={() => setRoutePreview(null)}>
          <div className={styles.routePanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.routeHeader}>
              <h3 className={styles.routeTitle}>
                {person.n} · {getDiaDisplay(routePreview.dia)}번 근무
              </h3>
              <button
                type="button"
                className={styles.routeClose}
                onClick={() => setRoutePreview(null)}
                aria-label="닫기"
              >
                <X size={22} />
              </button>
            </div>
            <div className={styles.routeBody}>
              <img
                src={routePreview.imgPath}
                alt={`${getDiaDisplay(routePreview.dia)}번 행로표`}
                className={styles.routeImg}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 거절 사유 선택지 ─── */
const DECLINE_REASONS = [
  '일정이 맞지 않아요',
  '개인 사정이 있어요',
  '이미 다른 교체가 진행 중이에요',
  '직접 입력',
] as const;

/* ─── 확인 다이얼로그 상태 타입 ─── */
interface ConfirmState {
  type: 'accept' | 'decline' | 'cancel' | 'acceptVolunteer';
  postId: string;
  volunteerId?: string;
  volunteerName?: string;
  requesterName?: string;
}

/* ─── 게시판 뷰 ─── */
function BoardView({ driver }: { driver: Person | null }) {
  const posts = useExchangeStore((s) => s.posts);
  const accept = useExchangeStore((s) => s.accept);
  const decline = useExchangeStore((s) => s.decline);
  const remove = useExchangeStore((s) => s.remove);
  const volunteerFn = useExchangeStore((s) => s.volunteer);
  const acceptVolunteer = useExchangeStore((s) => s.acceptVolunteer);

  // 확인 다이얼로그
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  // 거절 사유
  const [declineReason, setDeclineReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);

  const handleConfirmAction = useCallback(() => {
    if (!confirm) return;

    switch (confirm.type) {
      case 'accept':
        accept(confirm.postId);
        showToast('교체 요청을 수락했어요', 'success');
        break;
      case 'decline': {
        const reason = declineReason === '직접 입력' ? customReason : declineReason;
        decline(confirm.postId, reason || undefined);
        showToast('교체 요청을 거절했어요', 'info');
        break;
      }
      case 'cancel':
        remove(confirm.postId);
        showToast('요청을 취소했어요', 'info');
        break;
      case 'acceptVolunteer':
        if (confirm.volunteerId) {
          acceptVolunteer(confirm.postId, confirm.volunteerId);
          showToast(`${confirm.volunteerName || '지원자'}를 수락했어요`, 'success');
        }
        break;
    }

    setConfirm(null);
    setDeclineReason('');
    setCustomReason('');
    setShowDeclineForm(false);
  }, [confirm, accept, decline, remove, acceptVolunteer, declineReason, customReason]);

  const handleCancelConfirm = useCallback(() => {
    setConfirm(null);
    setDeclineReason('');
    setCustomReason('');
    setShowDeclineForm(false);
  }, []);

  const handleVolunteer = useCallback((postId: string) => {
    if (!driver) return;
    volunteerFn(postId, driver.I, driver.n);
    showToast('교체 가능으로 지원했어요', 'success');
  }, [driver, volunteerFn]);

  // 나에게 온 1:1 요청 (대기 중)
  const incoming = useMemo(
    () =>
      driver
        ? posts.filter((p) => p.type === 'direct' && p.targetId === driver.I && p.status === 'pending')
        : [],
    [posts, driver],
  );

  // 내가 보낸 요청 (1:1 + open 모두)
  const outgoing = useMemo(
    () => (driver ? posts.filter((p) => p.requesterId === driver.I) : []),
    [posts, driver],
  );

  // 전체 공지 (내 것 제외, 대기 중)
  const openPosts = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.type === 'open' &&
          p.status === 'pending' &&
          (!driver || p.requesterId !== driver.I),
      ),
    [posts, driver],
  );

  // 기타 1:1 (나와 무관, 대기 중)
  const otherDirect = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.type === 'direct' &&
          p.status === 'pending' &&
          (!driver || (p.requesterId !== driver.I && p.targetId !== driver.I)),
      ),
    [posts, driver],
  );

  if (!driver) {
    return <p className={styles.hint}>기관사를 선택하면 게시판을 볼 수 있어요</p>;
  }

  const isEmpty = incoming.length === 0 && outgoing.length === 0 && openPosts.length === 0 && otherDirect.length === 0;

  return (
    <div className={styles.boardContainer}>
      {isEmpty && (
        <div className={styles.emptyBoard}>
          <Bell size={32} className={styles.emptyIcon} />
          <p>아직 교체 요청이 없어요</p>
          <p className={styles.emptyHint}>매칭 검색에서 요청을 보내거나 전체 공지를 올려보세요</p>
        </div>
      )}

      {/* 나에게 온 1:1 요청 */}
      {incoming.length > 0 && (
        <section className={styles.boardSection}>
          <h3 className={styles.boardSectionTitle}>
            <span className={styles.boardBadge}>{incoming.length}</span>
            나에게 온 요청
          </h3>
          <div className={styles.boardList}>
            {incoming.map((post) => (
              <PostCard key={post.id} post={post} variant="incoming">
                <div className={styles.postActions}>
                  <button
                    type="button"
                    className={styles.acceptBtn}
                    onClick={() => setConfirm({ type: 'accept', postId: post.id, requesterName: post.requesterName })}
                    aria-label="수락"
                  >
                    <Check size={16} />
                    수락
                  </button>
                  <button
                    type="button"
                    className={styles.declineBtn}
                    onClick={() => {
                      setConfirm({ type: 'decline', postId: post.id, requesterName: post.requesterName });
                      setShowDeclineForm(true);
                    }}
                    aria-label="거절"
                  >
                    <X size={16} />
                    거절
                  </button>
                </div>
              </PostCard>
            ))}
          </div>
        </section>
      )}

      {/* 전체 공지 */}
      {openPosts.length > 0 && (
        <section className={styles.boardSection}>
          <h3 className={styles.boardSectionTitle}>
            <Megaphone size={16} />
            전체 공지
          </h3>
          <div className={styles.boardList}>
            {openPosts.map((post) => {
              const alreadyVolunteered = post.volunteers.some((v) => v.id === driver.I);
              return (
                <PostCard key={post.id} post={post} variant="public">
                  <div className={styles.postActions}>
                    <button
                      type="button"
                      className={`${styles.volunteerBtn} ${alreadyVolunteered ? styles.volunteerBtnDone : ''}`}
                      onClick={() => handleVolunteer(post.id)}
                      disabled={alreadyVolunteered}
                    >
                      {alreadyVolunteered ? (
                        <>
                          <Check size={14} />
                          지원 완료
                        </>
                      ) : (
                        <>
                          <Hand size={14} />
                          교체 가능
                        </>
                      )}
                    </button>
                    {post.volunteers.length > 0 && (
                      <span className={styles.volunteerCount}>
                        {post.volunteers.length}명 지원
                      </span>
                    )}
                  </div>
                </PostCard>
              );
            })}
          </div>
        </section>
      )}

      {/* 내가 보낸 요청 */}
      {outgoing.length > 0 && (
        <section className={styles.boardSection}>
          <h3 className={styles.boardSectionTitle}>내가 보낸 요청</h3>
          <div className={styles.boardList}>
            {outgoing.map((post) => (
              <PostCard key={post.id} post={post} variant="outgoing">
                <div className={styles.postActions}>
                  {post.type === 'open' && post.status === 'pending' && post.volunteers.length > 0 ? (
                    /* open 공지에 지원자가 있으면 선택 UI */
                    <div className={styles.volunteerList}>
                      <span className={styles.volunteerListLabel}>
                        {post.volunteers.length}명 지원:
                      </span>
                      {post.volunteers.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          className={styles.volunteerSelectBtn}
                          onClick={() => setConfirm({
                            type: 'acceptVolunteer',
                            postId: post.id,
                            volunteerId: v.id,
                            volunteerName: v.name,
                          })}
                        >
                          <Check size={12} />
                          {v.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <span className={`${styles.statusBadge} ${styles[`status_${post.status}`]}`}>
                        {post.status === 'pending' && (post.type === 'open' ? '지원자 대기' : '대기 중')}
                        {post.status === 'accepted' && (
                          post.type === 'open' && post.acceptedVolunteerId
                            ? `${post.volunteers.find((v) => v.id === post.acceptedVolunteerId)?.name || ''} 수락`
                            : '수락됨'
                        )}
                        {post.status === 'declined' && '거절됨'}
                      </span>

                      {/* 수락됨 → 안내 텍스트 */}
                      {post.status === 'accepted' && (
                        <div className={styles.guidanceText}>
                          <Info size={14} />
                          관리자에게 교체 근무 전달하세요
                        </div>
                      )}

                      {/* 거절 사유 표시 */}
                      {post.status === 'declined' && post.declineReason && (
                        <span className={styles.declineReasonText}>
                          사유: {post.declineReason}
                        </span>
                      )}

                      {/* 대기 중 → 취소 버튼 */}
                      {post.status === 'pending' && (
                        <button
                          type="button"
                          className={styles.cancelBtn}
                          onClick={() => setConfirm({ type: 'cancel', postId: post.id })}
                          aria-label="요청 취소"
                        >
                          <X size={14} />
                          취소
                        </button>
                      )}

                      {post.status !== 'pending' && (
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={() => remove(post.id)}
                          aria-label="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </PostCard>
            ))}
          </div>
        </section>
      )}

      {/* 기타 1:1 요청 */}
      {otherDirect.length > 0 && (
        <section className={styles.boardSection}>
          <h3 className={styles.boardSectionTitle}>다른 교체 요청</h3>
          <div className={styles.boardList}>
            {otherDirect.map((post) => (
              <PostCard key={post.id} post={post} variant="public" />
            ))}
          </div>
        </section>
      )}

      {/* 확인 다이얼로그 */}
      {confirm && (
        <div className={styles.confirmOverlay} onClick={handleCancelConfirm}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h4 className={styles.confirmTitle}>
              {confirm.type === 'accept' && '교체 요청 수락'}
              {confirm.type === 'decline' && '교체 요청 거절'}
              {confirm.type === 'cancel' && '요청 취소'}
              {confirm.type === 'acceptVolunteer' && '지원자 수락'}
            </h4>
            <p className={styles.confirmMessage}>
              {confirm.type === 'accept' && `${confirm.requesterName}의 교체 요청을 수락할까요?`}
              {confirm.type === 'decline' && `${confirm.requesterName}의 교체 요청을 거절할까요?`}
              {confirm.type === 'cancel' && '이 요청을 취소할까요? 상대방에게 알림이 사라져요.'}
              {confirm.type === 'acceptVolunteer' && `${confirm.volunteerName}을(를) 교체 대상자로 수락할까요?`}
            </p>

            {/* 거절 시 사유 선택 */}
            {showDeclineForm && (
              <div className={styles.declineReasonSection}>
                <span className={styles.declineReasonLabel}>거절 사유 (선택)</span>
                <div className={styles.declineReasonOptions}>
                  {DECLINE_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className={`${styles.declineReasonBtn} ${declineReason === reason ? styles.declineReasonBtnActive : ''}`}
                      onClick={() => setDeclineReason(prev => prev === reason ? '' : reason)}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                {declineReason === '직접 입력' && (
                  <input
                    type="text"
                    className={styles.customReasonInput}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="거절 사유를 입력하세요"
                    maxLength={50}
                    autoFocus
                  />
                )}
              </div>
            )}

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.confirmCancelBtn}
                onClick={handleCancelConfirm}
              >
                돌아가기
              </button>
              <button
                type="button"
                className={`${styles.confirmOkBtn} ${confirm.type === 'decline' || confirm.type === 'cancel' ? styles.confirmOkBtnDanger : ''}`}
                onClick={handleConfirmAction}
              >
                {confirm.type === 'accept' && '수락'}
                {confirm.type === 'decline' && '거절'}
                {confirm.type === 'cancel' && '취소'}
                {confirm.type === 'acceptVolunteer' && '수락'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 게시글 카드 ─── */
function PostCard({
  post,
  variant,
  children,
}: {
  post: ExchangePost;
  variant: 'incoming' | 'outgoing' | 'public';
  children?: React.ReactNode;
}) {
  const isOpen = post.type === 'open';

  return (
    <div className={`${styles.postCard} ${variant === 'incoming' ? styles.postCardIncoming : ''} ${isOpen ? styles.postCardOpen : ''}`}>
      <div className={styles.postHeader}>
        {isOpen ? (
          /* 전체 공지: 요청자만 표시 */
          <>
            <span className={styles.postAvatar}>{post.requesterName[0]}</span>
            <div className={styles.postNames}>
              <span className={styles.postRequester}>{post.requesterName}</span>
              <span className={styles.openLabel}>전체 공지</span>
            </div>
          </>
        ) : (
          /* 1:1 요청: 요청자 → 대상자 */
          <>
            <div className={styles.postAvatars}>
              <span className={styles.postAvatar}>{post.requesterName[0]}</span>
              <span className={styles.postArrow}>→</span>
              <span className={`${styles.postAvatar} ${styles.postAvatarTarget}`}>
                {post.targetName[0]}
              </span>
            </div>
            <div className={styles.postNames}>
              <span className={styles.postRequester}>{post.requesterName}</span>
              <span className={styles.postArrowText}>→</span>
              <span className={styles.postTarget}>{post.targetName}</span>
            </div>
          </>
        )}
        <span className={styles.postTime}>{timeAgo(post.createdAt)}</span>
      </div>

      {/* 교번 표시 */}
      <div className={styles.postDias}>
        {post.dates.map((dateStr) => {
          const date = fromISODate(dateStr);
          const rDia = post.requesterDias[dateStr];
          const rType = getType(rDia || '');

          if (isOpen) {
            return (
              <div key={dateStr} className={styles.postDiaCol}>
                <span className={styles.postDiaDate}>{formatShort(date)}</span>
                <span className={`${styles.postDiaValue} ${styles[`dia_${rType}`]}`}>{rDia}</span>
              </div>
            );
          }

          const tDia = post.targetDias[dateStr];
          const tType = getType(tDia || '');
          return (
            <div key={dateStr} className={styles.postDiaCol}>
              <span className={styles.postDiaDate}>{formatShort(date)}</span>
              <span className={`${styles.postDiaValue} ${styles[`dia_${rType}`]}`}>{rDia}</span>
              <span className={styles.postDiaSwap}>↕</span>
              <span className={`${styles.postDiaValue} ${styles[`dia_${tType}`]}`}>{tDia}</span>
            </div>
          );
        })}
      </div>

      {post.memo && <p className={styles.postMemo}>{post.memo}</p>}

      {children}
    </div>
  );
}
