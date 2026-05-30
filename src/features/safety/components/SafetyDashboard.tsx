'use client';

import { useState } from 'react';
import {
  ArrowLeft, AlertTriangle, TrainFront, Train, ShieldAlert,
  Megaphone, ChevronRight, Bell,
} from 'lucide-react';
import styles from './SafetyDashboard.module.css';

interface Props {
  onBack: () => void;
  onOpenCategory: (id: 'incident' | 'driving' | 'train' | 'hazard') => void;
  onOpenNotice?: () => void;
  unreadCount?: number;
}

/* === 프로토타입 샘플 데이터 (실데이터 연동은 단계적 진행) === */

const NOTICE_SAMPLE = {
  title: '2026년 6월 1일부터 차내 방송 멘트가 변경됩니다.',
  date: '2026.05.30',
};

const INCIDENT_SAMPLES = [
  { kind: '시설물', kindColor: 'amber', title: '왕십리역 스크린도어 이상', date: '2026.05.28', time: '08:35', location: '왕십리역 승강장', summary: '스크린도어 2-3번 사이 이상 발생, 승객 안전 안내 후 조치' },
  { kind: '열차',   kindColor: 'blue',  title: '출입문 닫힘 불량',     date: '2026.05.27', time: '15:42', location: '천호역 → 강동역', summary: '3호차 2번 출입문 닫힘 불량, 수동 조치 후 정상 운행' },
  { kind: '신호',   kindColor: 'red',   title: '신호 취급 오류',       date: '2026.05.26', time: '22:11', location: '군자역',        summary: '열차 출발 신호 취급 오류로 지연 발생, 원인 분석 후 조치' },
];

const TRAIN_UPDATE_SAMPLES = [
  { title: '5호선 신조 전동차 (5100호대)', applied: '2026.05.28 적용', items: ['출입문 제어 방식 변경', '비상통화 장치 위치 변경', '운전대 조작 패널 일부 변경'] },
  { title: 'ATS 차상 시스템 업데이트',    applied: '2026.05.25 적용', items: ['ATS 표시 화면 개선', '경고음 및 안내 멘트 변경'] },
  { title: '비상 탈출 안내 스티커 변경',  applied: '2026.05.22 적용', items: ['위치 및 디자인 변경', '다국어 안내 추가'] },
];

const HAZARD_ZONE_SAMPLES = [
  { station: '까치산역',   severity: '주의', desc: '승강장 틈새 주의' },
  { station: '개화산역',   severity: '위험', desc: '출입문 끼임 주의' },
  { station: '군자역',     severity: '주의', desc: '신호 취급 주의' },
  { station: '강동역',     severity: '주의', desc: '승강장 곡선 구간' },
];

const CATEGORIES = [
  { id: 'incident' as const, label: '최근 사고 사례',   sub: '사례 확인·예방',     icon: AlertTriangle, tone: 'amber' as const },
  { id: 'driving'  as const, label: '운전 정보',        sub: '운전 주의사항',     icon: TrainFront,    tone: 'blue'  as const },
  { id: 'train'    as const, label: '열차 정보',        sub: '변경 사항 확인',     icon: Train,         tone: 'green' as const },
  { id: 'hazard'   as const, label: '위험개소 확인',    sub: '구간별 주의사항',   icon: ShieldAlert,   tone: 'red'   as const },
];

export default function SafetyDashboard({
  onBack, onOpenCategory, onOpenNotice, unreadCount = 0,
}: Props) {
  const [listTab, setListTab] = useState<'incident' | 'train'>('incident');

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.headerTitle}>안전관리</h1>
        <button type="button" className={styles.bellBtn} aria-label={`알림 ${unreadCount}건`}>
          <Bell size={20} strokeWidth={2} />
          {unreadCount > 0 && (
            <span className={styles.bellBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      </header>

      <div className={styles.prototypeNotice}>
        <span>목업 — 샘플 데이터입니다</span>
      </div>

      <main className={styles.content}>
        {/* 공지사항 카드 */}
        <button type="button" className={styles.noticeCard} onClick={onOpenNotice}>
          <div className={styles.noticeIcon}>
            <Megaphone size={20} strokeWidth={2} />
          </div>
          <div className={styles.noticeBody}>
            <div className={styles.noticeTopRow}>
              <span className={styles.noticeLabel}>공지사항</span>
              <span className={styles.noticeMore}>전체보기 <ChevronRight size={14} /></span>
            </div>
            <p className={styles.noticeTitle}>{NOTICE_SAMPLE.title}</p>
            <span className={styles.noticeDate}>{NOTICE_SAMPLE.date}</span>
          </div>
        </button>

        {/* 2×2 카테고리 그리드 */}
        <section className={styles.section}>
          <div className={styles.categoryGrid}>
            {CATEGORIES.map(c => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.categoryCard} ${styles[`cat_${c.tone}`]}`}
                  onClick={() => onOpenCategory(c.id)}
                >
                  <div className={styles.categoryIconWrap}>
                    <Icon size={26} strokeWidth={2.2} />
                  </div>
                  <span className={styles.categoryLabel}>{c.label}</span>
                  <span className={styles.categorySub}>{c.sub}</span>
                  <span className={styles.categoryGo}>바로가기 <ChevronRight size={14} /></span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 최근 업로드 — 탭 전환 */}
        <section className={styles.section}>
          <div className={styles.listTabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={listTab === 'incident'}
              className={`${styles.listTab} ${listTab === 'incident' ? styles.listTabActive : ''}`}
              onClick={() => setListTab('incident')}
            >
              최근 사고 사례
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={listTab === 'train'}
              className={`${styles.listTab} ${listTab === 'train' ? styles.listTabActive : ''}`}
              onClick={() => setListTab('train')}
            >
              최근 변경된 열차 정보
            </button>
          </div>

          {listTab === 'incident' ? (
            <ul className={styles.itemList}>
              {INCIDENT_SAMPLES.map((it, i) => (
                <li key={i} className={styles.incidentItem}>
                  <div className={styles.incidentHeadRow}>
                    <span className={`${styles.kindBadge} ${styles[`kind_${it.kindColor}`]}`}>{it.kind}</span>
                    <span className={styles.incidentTitle}>{it.title}</span>
                  </div>
                  <div className={styles.incidentMeta}>
                    <span>{it.date}</span>
                    <span className={styles.metaDot}>·</span>
                    <span>{it.time}</span>
                    <span className={styles.metaDot}>·</span>
                    <span>{it.location}</span>
                  </div>
                  <p className={styles.incidentSummary}>{it.summary}</p>
                </li>
              ))}
            </ul>
          ) : (
            <ul className={styles.itemList}>
              {TRAIN_UPDATE_SAMPLES.map((it, i) => (
                <li key={i} className={styles.trainItem}>
                  <div className={styles.trainHeadRow}>
                    <span className={styles.newBadge}>NEW</span>
                    <span className={styles.trainTitle}>{it.title}</span>
                  </div>
                  <ul className={styles.trainSubList}>
                    {it.items.map((sub, j) => (
                      <li key={j}>{sub}</li>
                    ))}
                  </ul>
                  <span className={styles.trainApplied}>{it.applied}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 주요 위험개소 — 가로 스크롤 */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>주요 위험개소</h2>
            <button
              type="button"
              className={styles.sectionMore}
              onClick={() => onOpenCategory('hazard')}
            >
              전체보기 <ChevronRight size={14} />
            </button>
          </div>
          <div className={styles.hazardScroll}>
            {HAZARD_ZONE_SAMPLES.map((h, i) => {
              const severe = h.severity === '위험';
              return (
                <div key={i} className={`${styles.hazardCard} ${severe ? styles.hazardCardSevere : ''}`}>
                  <div className={styles.hazardTopRow}>
                    <span className={styles.hazardStation}>{h.station}</span>
                    <span className={`${styles.severityBadge} ${severe ? styles.severityBadgeSevere : styles.severityBadgeWarn}`}>
                      {h.severity}
                    </span>
                  </div>
                  <p className={styles.hazardDesc}>{h.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
