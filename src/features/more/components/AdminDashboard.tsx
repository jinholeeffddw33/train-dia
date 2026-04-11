'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Users, Clock, UserX, Activity } from 'lucide-react';
import styles from '../styles/More.module.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ADMIN_PIN = '9110';

interface DashboardData {
  today: {
    date: string;
    uniqueCount: number;
    totalMembers: number;
    users: { userId: string; name: string; lastAt: string; action: string }[];
  };
  dailyStats: { date: string; count: number }[];
  inactive: { name: string; sabun: string }[];
  totalLogs: number;
}

interface AdminDashboardProps {
  onClose: () => void;
}

export default function AdminDashboard({ onClose }: AdminDashboardProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePinSubmit = useCallback(() => {
    if (pin === ADMIN_PIN) {
      setAuthenticated(true);
      setPinError('');
    } else {
      setPinError('비밀번호가 올바르지 않습니다');
      setPin('');
    }
  }, [pin]);

  useEffect(() => {
    if (!authenticated) return;
    setLoading(true);
    fetch('/api/admin/dashboard')
      .then(r => {
        if (!r.ok) throw new Error('권한이 없습니다');
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [authenticated]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const [, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  };

  // PIN 게이트
  if (!authenticated) {
    return (
      <div className={styles.fullOverlay}>
        <div className={styles.overlayHeader}>
          <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="닫기">
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.overlayTitle}>관리자 현황판</h2>
        </div>
        <div className={styles.adminPinGate}>
          <div className={styles.adminPinIcon}>
            <Activity size={40} />
          </div>
          <p className={styles.adminPinLabel}>관리자 비밀번호를 입력하세요</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            className={styles.adminPinInput}
            value={pin}
            onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setPinError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handlePinSubmit(); }}
            placeholder="****"
            autoFocus
          />
          {pinError && <p className={styles.adminPinError}>{pinError}</p>}
          <button
            type="button"
            className={styles.adminPinSubmit}
            onClick={handlePinSubmit}
            disabled={pin.length < 4}
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  // 로딩/에러
  if (loading) {
    return (
      <div className={styles.fullOverlay}>
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
      <div className={styles.fullOverlay}>
        <div className={styles.overlayHeader}>
          <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="닫기">
            <ArrowLeft size={20} />
          </button>
          <h2 className={styles.overlayTitle}>관리자 현황판</h2>
        </div>
        <div className={styles.adminEmpty}>{error || '데이터를 불러올 수 없습니다'}</div>
      </div>
    );
  }

  const maxDaily = Math.max(...data.dailyStats.map(d => d.count), 1);

  return (
    <div className={styles.fullOverlay}>
      <div className={styles.overlayHeader}>
        <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="닫기">
          <ArrowLeft size={20} />
        </button>
        <h2 className={styles.overlayTitle}>관리자 현황판</h2>
      </div>

      <div className={styles.adminContent}>
        {/* 오늘 접속 현황 */}
        <div className={styles.adminSummary}>
          <div className={styles.adminSummaryCard}>
            <Users size={20} className={styles.adminSummaryIcon} />
            <div className={styles.adminSummaryValue}>{data.today.uniqueCount}</div>
            <div className={styles.adminSummaryLabel}>오늘 접속</div>
          </div>
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

        {/* 오늘 접속자 목록 */}
        <div className={styles.adminSection}>
          <h3 className={styles.adminSectionTitle}>
            <Clock size={16} /> 오늘 접속자 ({data.today.uniqueCount}명)
          </h3>
          {data.today.users.length === 0 ? (
            <p className={styles.adminEmptyText}>오늘 접속자가 없습니다</p>
          ) : (
            <div className={styles.adminList}>
              {data.today.users.map((u, i) => (
                <div key={i} className={styles.adminListItem}>
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
