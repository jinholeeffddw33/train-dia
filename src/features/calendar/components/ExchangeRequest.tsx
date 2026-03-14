'use client';

import { useState, useMemo, useCallback } from 'react';
import { Calendar, Search, Send, Check, X, Trash2, Bell } from 'lucide-react';
import { useDriverStore } from '@/stores/driver';
import { useExchangeStore, type ExchangePost } from '@/stores/exchange';
import { getDia, getType, getDiaDisplay } from '@/lib/schedule';
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
  const driver = useDriverStore((s) => s.current);
  const todayStr = toISODate(new Date());
  const previewDays = useMemo(buildPreviewDays, []);

  const [subTab, setSubTab] = useState<SubTab>('search');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [wishes, setWishes] = useState<Record<string, WishType>>({});
  const [memo, setMemo] = useState('');
  const [searched, setSearched] = useState(false);

  const posts = useExchangeStore((s) => s.posts);
  const pendingCount = driver
    ? posts.filter((p) => p.targetId === driver.I && p.status === 'pending').length
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

  // 미리보기 날짜 클릭
  const handlePreviewTap = useCallback((date: Date) => {
    const iso = toISODate(date);
    setStartDate(iso);
    if (iso > endDate) setEndDate(iso);
    setSearched(false);
  }, [endDate]);

  return (
    <div className={styles.container}>
      <h2 className={styles.pageTitle}>교체 희망</h2>

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
}

function SearchView({
  driver, todayStr, previewDays, startDate, endDate,
  setStartDate, setEndDate, wishes, handleWish, memo, setMemo,
  searched, handleSearch, wishCount, handlePreviewTap,
  dateRange, matchResults,
}: SearchViewProps) {
  return (
    <>
      {/* 내 근무 미리보기 스트립 */}
      {driver && (
        <div className={styles.previewSection}>
          <h3 className={styles.previewLabel}>내 근무 (2주)</h3>
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

      {/* 검색 버튼 */}
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
    </>
  );
}

/* ─── 매칭 카드 ─── */
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

  // 이미 같은 대상에게 같은 날짜로 보낸 요청이 있는지
  const alreadySent = useMemo(() => {
    if (!driver) return false;
    const dateKeys = dateRange.map(toISODate);
    return posts.some(
      (p) =>
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
          return (
            <div key={key} className={styles.matchDay}>
              <span className={styles.matchDayLabel}>{formatShort(date)}</span>
              <span className={`${styles.matchDayDia} ${styles[`dia_${type}`]}`}>{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── 게시판 뷰 ─── */
function BoardView({ driver }: { driver: Person | null }) {
  const posts = useExchangeStore((s) => s.posts);
  const accept = useExchangeStore((s) => s.accept);
  const decline = useExchangeStore((s) => s.decline);
  const remove = useExchangeStore((s) => s.remove);

  // 나에게 온 요청 (대기 중)
  const incoming = useMemo(
    () =>
      driver
        ? posts.filter((p) => p.targetId === driver.I && p.status === 'pending')
        : [],
    [posts, driver],
  );

  // 내가 보낸 요청
  const outgoing = useMemo(
    () => (driver ? posts.filter((p) => p.requesterId === driver.I) : []),
    [posts, driver],
  );

  // 전체 게시글 (나 제외, 대기 중만)
  const allPending = useMemo(
    () =>
      posts.filter(
        (p) =>
          p.status === 'pending' &&
          (!driver || (p.requesterId !== driver.I && p.targetId !== driver.I)),
      ),
    [posts, driver],
  );

  if (!driver) {
    return <p className={styles.hint}>기관사를 선택하면 게시판을 볼 수 있어요</p>;
  }

  const isEmpty = incoming.length === 0 && outgoing.length === 0 && allPending.length === 0;

  return (
    <div className={styles.boardContainer}>
      {isEmpty && (
        <div className={styles.emptyBoard}>
          <Bell size={32} className={styles.emptyIcon} />
          <p>아직 교체 요청이 없어요</p>
          <p className={styles.emptyHint}>매칭 검색에서 원하는 기관사에게 요청을 보내보세요</p>
        </div>
      )}

      {/* 나에게 온 요청 */}
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
                    onClick={() => accept(post.id)}
                    aria-label="수락"
                  >
                    <Check size={16} />
                    수락
                  </button>
                  <button
                    type="button"
                    className={styles.declineBtn}
                    onClick={() => decline(post.id)}
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

      {/* 내가 보낸 요청 */}
      {outgoing.length > 0 && (
        <section className={styles.boardSection}>
          <h3 className={styles.boardSectionTitle}>내가 보낸 요청</h3>
          <div className={styles.boardList}>
            {outgoing.map((post) => (
              <PostCard key={post.id} post={post} variant="outgoing">
                <div className={styles.postActions}>
                  <span className={`${styles.statusBadge} ${styles[`status_${post.status}`]}`}>
                    {post.status === 'pending' && '대기 중'}
                    {post.status === 'accepted' && '수락됨'}
                    {post.status === 'declined' && '거절됨'}
                  </span>
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
                </div>
              </PostCard>
            ))}
          </div>
        </section>
      )}

      {/* 전체 게시판 */}
      {allPending.length > 0 && (
        <section className={styles.boardSection}>
          <h3 className={styles.boardSectionTitle}>전체 교체 요청</h3>
          <div className={styles.boardList}>
            {allPending.map((post) => (
              <PostCard key={post.id} post={post} variant="public" />
            ))}
          </div>
        </section>
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
  return (
    <div className={`${styles.postCard} ${variant === 'incoming' ? styles.postCardIncoming : ''}`}>
      <div className={styles.postHeader}>
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
        <span className={styles.postTime}>{timeAgo(post.createdAt)}</span>
      </div>

      {/* 교번 비교 */}
      <div className={styles.postDias}>
        {post.dates.map((dateStr) => {
          const date = fromISODate(dateStr);
          const rDia = post.requesterDias[dateStr];
          const tDia = post.targetDias[dateStr];
          const rType = getType(rDia || '');
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
