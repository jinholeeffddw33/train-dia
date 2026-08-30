'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Clock, UserX, Activity, ArrowLeftRight } from 'lucide-react';
import { useEscapeClose } from '@/hooks/useEscapeClose';
import styles from '../styles/More.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface VisitUser { userId: string; name: string; lastAt: string; action: string }

interface DashboardData {
  today: {
    date: string;
    uniqueCount: number;
    totalMembers: number;
    users: VisitUser[];
  };
  /** 자정이 지나면 오늘 목록이 비워져 심야 접속자를 놓친다 → 어제도 함께 본다 */
  yesterday: {
    date: string;
    uniqueCount: number;
    users: VisitUser[];
  };
  dailyStats: { date: string; count: number }[];
  inactive: { name: string; sabun: string }[];
  totalLogs: number;
}

interface AdminDashboardProps {
  onClose: () => void;
}

export default function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** 접속자 목록에 보여 줄 날 — 요약 카드를 눌러 오늘↔어제 전환 */
  const [day, setDay] = useState<'today' | 'yesterday'>('today');

  // ESC 로 닫기
  useEscapeClose(true, onClose);

  // 비밀번호는 입구(AdminHub)에서 이미 확인했다
  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/dashboard')
      .then(r => {
        if (!r.ok) throw new Error('권한이 없어요');
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const [, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  };


  // 로딩/에러
  if (loading) {
    return (
      <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="관리자 현황판">
        <div className={styles.overlayHeader}>
          <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="닫기">
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.overlayTitle}>관리자 현황판</h2>
        </div>
        <div className={styles.adminEmpty}>불러오는 중...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="관리자 현황판">
        <div className={styles.overlayHeader}>
          <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="닫기">
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.overlayTitle}>관리자 현황판</h2>
        </div>
        <div className={styles.adminEmpty}>{error || '데이터를 불러올 수 없어요'}</div>
      </div>
    );
  }

  const maxDaily = Math.max(...data.dailyStats.map(d => d.count), 1);

  // 선택한 날 / 반대쪽 날 — 카드는 선택한 날을 보여주고, 아래 줄에 반대쪽을 미리 알려 준다
  const isToday = day === 'today';
  const sel = isToday ? data.today : data.yesterday;
  const other = isToday ? data.yesterday : data.today;
  const selLabel = isToday ? '오늘' : '어제';
  const otherLabel = isToday ? '어제' : '오늘';

  return (
    <div className={styles.fullOverlay} role="dialog" aria-modal="true" aria-label="관리자 현황판">
      <div className={styles.overlayHeader}>
        <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="닫기">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.overlayTitle}>관리자 현황판</h2>
      </div>

      <div className={styles.adminContent}>
        {/* 오늘 접속 현황 */}
        <div className={styles.adminSummary}>
          <button
            type="button"
            className={`${styles.adminSummaryCard} ${styles.adminSummaryCardBtn}`}
            onClick={() => setDay(isToday ? 'yesterday' : 'today')}
            aria-label={`${selLabel} 접속 ${sel.uniqueCount}명. 누르면 ${otherLabel} 접속으로 바꿉니다`}
          >
            <Users size={20} className={styles.adminSummaryIcon} />
            <div className={styles.adminSummaryValue}>{sel.uniqueCount}</div>
            <div className={styles.adminSummaryLabel}>
              {selLabel} 접속
              <ArrowLeftRight size={12} aria-hidden />
            </div>
            <div className={styles.adminSummarySub}>{otherLabel} {other.uniqueCount}명</div>
          </button>
          <div className={styles.adminSummaryCard}>
            <Activity size={20} className={styles.adminSummaryIcon} />
            <div className={styles.adminSummaryValue}>{data.today.totalMembers}</div>
            <div className={styles.adminSummaryLabel}>전체 인원</div>
          </div>
          <div className={styles.adminSummaryCard}>
            <UserX size={20} className={styles.adminSummaryIcon} />
            <div className={styles.adminSummaryValue}>{data.inactive.length}</div>
            <div className={styles.adminSummaryLabel}>7일 미접속</div>
          </div>
        </div>

        {/* 접속자 목록 — 위 요약 카드에서 고른 날 */}
        <div className={styles.adminSection}>
          <h3 className={styles.adminSectionTitle}>
            <Clock size={16} /> {selLabel} 접속자 ({sel.uniqueCount}명)
            <span className={styles.adminSectionDate}>{formatDate(sel.date)}</span>
          </h3>
          {sel.users.length === 0 ? (
            <p className={styles.adminEmptyText}>{selLabel} 접속자가 없어요</p>
          ) : (
            <div className={styles.adminList}>
              {sel.users.map((u) => (
                <div key={u.userId} className={styles.adminListItem}>
                  <span className={styles.adminListName}>{u.name}</span>
                  <span className={styles.adminListTime}>{formatTime(u.lastAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7일 일별 접속 추이 */}
        <div className={styles.adminSection}>
          <h3 className={styles.adminSectionTitle}>
            <Activity size={16} /> 최근 7일 접속 추이
          </h3>
          <div className={styles.adminChart}>
            {data.dailyStats.map((d, i) => (
              <div key={i} className={styles.adminChartRow}>
                <span className={styles.adminChartDate}>{formatDate(d.date)}</span>
                <div className={styles.adminChartBarWrap}>
                  {/* STYLE-EXCEPTION: 동적 퍼센트 바 — CSS만으로 표현 불가 */}
                  <div
                    className={styles.adminChartBar}
                    style={{ width: `${(d.count / maxDaily) * 100}%` }}
                  />
                </div>
                <span className={styles.adminChartCount}>{d.count}명</span>
              </div>
            ))}
          </div>
        </div>

        {/* 7일 미접속자 */}
        {data.inactive.length > 0 && (
          <div className={styles.adminSection}>
            <h3 className={styles.adminSectionTitle}>
              <UserX size={16} /> 7일 미접속자 ({data.inactive.length}명)
            </h3>
            <div className={styles.adminList}>
              {data.inactive.map((u, i) => (
                <div key={i} className={styles.adminListItem}>
                  <span className={styles.adminListName}>{u.name}</span>
                  <span className={styles.adminListSabun}>{u.sabun}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 총 로그 수 */}
        <div className={styles.adminFooter}>
          총 누적 로그: {data.totalLogs.toLocaleString()}건
        </div>
      </div>
    </div>
  );
}
