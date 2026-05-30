'use client';

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
  userName?: string;
  userRole?: string;
}

/* === 프로토타입 샘플 데이터 (실데이터 연동은 후속) === */

const INCIDENT_SAMPLES = [
  { kind: '시설물', kindColor: 'amber', title: '왕십리역 스크린도어 이상', date: '2026.05.28', time: '08:35', location: '왕십리역 승강장', summary: '스크린도어 2-3번 사이 이상 발생, 승객 안전 안내 후 조치', uploadedAt: '2026-05-28T08:40:00' },
  { kind: '열차',   kindColor: 'blue',  title: '출입문 닫힘 불량',       date: '2026.05.27', time: '15:42', location: '천호역 → 강동역', summary: '3호차 2번 출입문 닫힘 불량, 수동 조치 후 정상 운행', uploadedAt: '2026-05-27T15:50:00' },
  { kind: '신호',   kindColor: 'red',   title: '신호 취급 오류',         date: '2026.05.26', time: '22:11', location: '군자역',          summary: '열차 출발 신호 취급 오류로 지연 발생, 원인 분석 후 조치', uploadedAt: '2026-05-26T22:20:00' },
];

const DRIVING_SAMPLES = [
  { title: '서행구간 추가 (마곡 → 발산)', date: '2026.05.25', location: '5호선 본선', summary: '레일 정비로 25km/h 서행, 통과 시 주의 운전', uploadedAt: '2026-05-25T09:00:00' },
  { title: '차내방송 멘트 변경 안내',     date: '2026.05.22', location: '전 구간',     summary: '6월 1일부터 환승역 안내 멘트 변경 적용',     uploadedAt: '2026-05-22T11:30:00' },
];

const TRAIN_UPDATE_SAMPLES = [
  { title: '5호선 신조 전동차 (5100호대)', applied: '2026.05.28 적용', items: ['출입문 제어 방식 변경', '비상통화 장치 위치 변경'] },
  { title: 'ATS 차상 시스템 업데이트',    applied: '2026.05.25 적용', items: ['ATS 표시 화면 개선', '경고음 멘트 변경'] },
];

/* === 5호선 역 순서 (방화 → 하남검단산/마천 분기) === */
const STATION_ORDER: Record<string, number> = {
  '방화': 0, '개화산': 1, '김포공항': 2, '송정': 3, '마곡': 4, '발산': 5, '우장산': 6, '화곡': 7,
  '까치산': 8, '신정': 9, '목동': 10, '오목교': 11, '양평': 12, '영등포구청': 13, '영등포시장': 14,
  '신길': 15, '여의도': 16, '여의나루': 17, '마포': 18, '공덕': 19, '애오개': 20, '충정로': 21,
  '서대문': 22, '광화문': 23, '종로3가': 24, '을지로4가': 25, '동대문역사문화공원': 26, '청구': 27,
  '신금호': 28, '행당': 29, '왕십리': 30, '마장': 31, '답십리': 32, '장한평': 33, '군자': 34,
  '아차산': 35, '광나루': 36, '천호': 37, '강동': 38,
  // 하남 방면
  '길동': 39, '굽은다리': 40, '명일': 41, '고덕': 42, '상일동': 43, '강일': 44, '미사': 45,
  '하남풍산': 46, '하남시청': 47, '하남검단산': 48,
  // 마천 방면
  '둔촌동': 49, '올림픽공원': 50, '방이': 51, '오금': 52, '개롱': 53, '거여': 54, '마천': 55,
};

function stationOrderKey(name: string): number {
  const base = name.replace(/역$/, '').trim();
  return STATION_ORDER[base] ?? 9999;
}

const HAZARD_ZONE_SAMPLES_RAW = [
  { station: '강동역',   severity: '주의', desc: '승강장 곡선 구간',  uploadedAt: '2026-05-26T10:00:00' },
  { station: '군자역',   severity: '주의', desc: '신호 취급 주의',    uploadedAt: '2026-05-25T10:00:00' },
  { station: '개화산역', severity: '위험', desc: '출입문 끼임 주의',  uploadedAt: '2026-05-27T10:00:00' },
  { station: '까치산역', severity: '주의', desc: '승강장 틈새 주의',  uploadedAt: '2026-05-24T10:00:00' },
];

// 최근 등록 4건 → 방화 기준 좌측부터 정렬
const HAZARD_ZONES_TOP4 = [...HAZARD_ZONE_SAMPLES_RAW]
  .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  .slice(0, 4)
  .sort((a, b) => stationOrderKey(a.station) - stationOrderKey(b.station));

const CATEGORIES = [
  { id: 'incident' as const, label: '사고 사례',  icon: AlertTriangle, tone: 'amber' as const },
  { id: 'driving'  as const, label: '운전 정보',  icon: TrainFront,    tone: 'blue'  as const },
  { id: 'train'    as const, label: '열차 정보',  icon: Train,         tone: 'green' as const },
  { id: 'hazard'   as const, label: '위험개소',   icon: ShieldAlert,   tone: 'red'   as const },
];

// 사고사례 vs 운전정보 — 가장 최근 업로드 비교
const latestIncidentAt = INCIDENT_SAMPLES[0]?.uploadedAt ?? '';
const latestDrivingAt = DRIVING_SAMPLES[0]?.uploadedAt ?? '';
const leftIsIncident = latestIncidentAt >= latestDrivingAt;
const LEFT_TITLE = leftIsIncident ? '최근 업로드된 사고 사례' : '최근 업로드된 운전 정보';

export default function SafetyDashboard({
  onBack, onOpenCategory, onOpenNotice, unreadCount = 0, userName = '', userRole = '',
}: Props) {
  const userLabel = userName ? `${userName} ${userRole.replace(/님$/, '')}` : '';
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로가기">
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <span className={styles.lineBadge} aria-hidden="true">5</span>
        <h1 className={styles.headerTitle}>5호선 안전관리시스템</h1>
        <button type="button" className={styles.bellBtn} aria-label={`알림 ${unreadCount}건`}>
          <Bell size={18} strokeWidth={2} />
          {unreadCount > 0 && (
            <span className={styles.bellBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
        {userLabel && (
          <span className={styles.userChip} aria-label="사용자">
            <span className={styles.userAvatar}>{userName.slice(0, 1) || '·'}</span>
            <span className={styles.userText}>{userLabel}</span>
          </span>
        )}
      </header>

      <div className={styles.prototypeNotice}>
        <span>목업 — 샘플 데이터입니다</span>
      </div>

      <main className={styles.content}>
        {/* 공지사항 */}
        <section className={styles.noticeSection}>
          <div className={styles.noticeHead}>
            <div className={styles.noticeHeadLeft}>
              <Megaphone size={14} className={styles.noticeHeadIcon} />
              <span className={styles.noticeHeadLabel}>공지사항</span>
            </div>
            <div className={styles.sectionHeadActions}>
              <button type="button" className={styles.sectionMore} onClick={onOpenNotice}>
                전체보기 <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <button type="button" className={styles.noticeEmpty} onClick={onOpenNotice}>
            <p className={styles.noticeEmptyText}>등록된 공지사항이 없습니다</p>
            <p className={styles.noticeEmptyHint}>관리자가 등록한 공지가 여기에 표시됩니다</p>
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

        {/* 좌(사고/운전 동적) + 우(열차정보) 2단 */}
        <section className={styles.dualSection}>
          {/* 좌측 */}
          <div className={styles.colWrap}>
            <div className={styles.colHead}>
              <h2 className={styles.colTitle}>{LEFT_TITLE}</h2>
            </div>
            <ul className={styles.itemList}>
              {leftIsIncident ? (
                INCIDENT_SAMPLES.slice(0, 3).map((it, i) => (
                  <li key={i} className={styles.incidentItem}>
                    <div className={styles.incidentHeadRow}>
                      <span className={`${styles.kindBadge} ${styles[`kind_${it.kindColor}`]}`}>{it.kind}</span>
                      <span className={styles.incidentTitle}>{it.title}</span>
                    </div>
                    <div className={styles.incidentMeta}>
                      <span>{it.date}</span>
                      <span className={styles.metaDot}>·</span>
                      <span>{it.location}</span>
                    </div>
                    <p className={styles.incidentSummary}>{it.summary}</p>
                  </li>
                ))
              ) : (
                DRIVING_SAMPLES.slice(0, 3).map((it, i) => (
                  <li key={i} className={styles.incidentItem}>
                    <div className={styles.incidentHeadRow}>
                      <span className={`${styles.kindBadge} ${styles.kind_blue}`}>운전</span>
                      <span className={styles.incidentTitle}>{it.title}</span>
                    </div>
                    <div className={styles.incidentMeta}>
                      <span>{it.date}</span>
                      <span className={styles.metaDot}>·</span>
                      <span>{it.location}</span>
                    </div>
                    <p className={styles.incidentSummary}>{it.summary}</p>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* 우측 — 열차정보 */}
          <div className={styles.colWrap}>
            <div className={styles.colHead}>
              <h2 className={styles.colTitle}>최근 변경된 열차 정보</h2>
            </div>
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
          </div>
        </section>

        {/* 주요 위험개소 — 4 카드 (방화 기준 좌→우) */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>주요 위험개소</h2>
            <div className={styles.sectionHeadActions}>
              <button
                type="button"
                className={styles.sectionMore}
                onClick={() => onOpenCategory('hazard')}
              >
                전체보기 <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <div className={styles.hazardGrid}>
            {HAZARD_ZONES_TOP4.map((h, i) => {
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
