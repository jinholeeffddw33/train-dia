'use client';

import { useState } from 'react';
import {
  ArrowLeft, AlertTriangle, TrainFront, Train, ShieldAlert,
  Megaphone, ChevronRight, Bell, Plus,
} from 'lucide-react';
import styles from './SafetyDashboard.module.css';

interface Props {
  onBack: () => void;
  onOpenCategory: (id: 'incident' | 'driving' | 'train' | 'hazard') => void;
  onOpenNotice?: () => void;
  onAddNotice?: () => void;
  onAddIncident?: () => void;
  onAddHazardZone?: () => void;
  isAdmin?: boolean;
  unreadCount?: number;
}

/* === 프로토타입 샘플 데이터 (실데이터 연동은 후속) === */

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
  { id: 'incident' as const, label: '사고 사례',  icon: AlertTriangle, tone: 'amber' as const },
  { id: 'driving'  as const, label: '운전 정보',  icon: TrainFront,    tone: 'blue'  as const },
  { id: 'train'    as const, label: '열차 정보',  icon: Train,         tone: 'green' as const },
  { id: 'hazard'   as const, label: '위험개소',   icon: ShieldAlert,   tone: 'red'   as const },
];

export default function SafetyDashboard({
  onBack, onOpenCategory, onOpenNotice, onAddNotice, onAddIncident, onAddHazardZone,
  isAdmin = false, unreadCount = 0,
}: Props) {
  const [listTab, setListTab] = useState<'incident' | 'train'>('incident');

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className={styles.headerTitle}>안전관리</h1>
        <button type="button" className={styles.bellBtn} aria-label={`알림 ${unreadCount}건`}>
          <Bell size={18} strokeWidth={2} />
          {unreadCount > 0 && (
            <span className={styles.bellBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      </header>

      <div className={styles.prototypeNotice}>
        <span>목업 — 샘플 데이터입니다</span>
      </div>

      <main className={styles.content}>
        {/* 공지사항 카드 (최상단) */}
        <section className={styles.noticeSection}>
          <div className={styles.noticeHead}>
            <div className={styles.noticeHeadLeft}>
              <Megaphone size={14} className={styles.noticeHeadIcon} />
              <span className={styles.noticeHeadLabel}>공지사항</span>
            </div>
            <div className={styles.sectionHeadActions}>
              {isAdmin && (
                <button type="button" className={styles.addBtn} onClick={onAddNotice} aria-label="공지사항 등록">
                  <Plus size={12} strokeWidth={2.4} /> 등록
                </button>
              )}
              <button type="button" className={styles.sectionMore} onClick={onOpenNotice}>
                전체보기 <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <button type="button" className={styles.noticeEmpty} onClick={onOpenNotice}>
            <p className={styles.noticeEmptyText}>등록된 공지사항이 없습니다</p>
            <p className={styles.noticeEmptyHint}>{isAdmin ? '+ 등록 버튼으로 새 공지를 작성해주세요' : '관리자가 등록한 공지가 여기에 표시됩니다'}</p>
          </button>
        </section>

        {/* 4 카테고리 가로 1줄 (compact) */}
        <nav className={styles.categoryRow} aria-label="안전 카테고리">
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                type="button"
                className={`${styles.catBtn} ${styles[`catTone_${c.tone}`]}`}
                onClick={() => onOpenCategory(c.id)}
              >
                <span className={styles.catIconWrap}>
                  <Icon size={20} strokeWidth={2.2} />
                </span>
                <span className={styles.catLabel}>{c.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 최근 업로드 — 탭 전환 */}
        <section className={styles.section}>
          <div className={styles.listTabsRow}>
            <div className={styles.listTabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={listTab === 'incident'}
                className={`${styles.listTab} ${listTab === 'incident' ? styles.listTabActive : ''}`}
                onClick={() => setListTab('incident')}
              >
                사고 사례
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={listTab === 'train'}
                className={`${styles.listTab} ${listTab === 'train' ? styles.listTabActive : ''}`}
                onClick={() => setListTab('train')}
              >
                열차 정보
              </button>
            </div>
            {listTab === 'incident' && (
              <button type="button" className={styles.addBtn} onClick={onAddIncident} aria-label="사고 사례 등록">
                <Plus size={14} strokeWidth={2.4} /> 등록
              </button>
            )}
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

        {/* 주요 위험개소 — 가로 스크롤 + 관리자 등록 */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>주요 위험개소</h2>
            <div className={styles.sectionHeadActions}>
              {isAdmin && (
                <button type="button" className={styles.addBtn} onClick={onAddHazardZone} aria-label="위험개소 등록">
                  <Plus size={14} strokeWidth={2.4} /> 등록
                </button>
              )}
              <button
                type="button"
                className={styles.sectionMore}
                onClick={() => onOpenCategory('hazard')}
              >
                전체보기 <ChevronRight size={12} />
              </button>
            </div>
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
