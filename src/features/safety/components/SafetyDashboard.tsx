'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, AlertTriangle, TrainFront, Train, ShieldAlert,
  Megaphone, ChevronRight, Bell, Check, X,
} from 'lucide-react';
import styles from './SafetyDashboard.module.css';

/** 대시보드 샘플 확인(읽음) 상태 — 카드별 고유 ID로 localStorage 저장 */
const DASHBOARD_READ_KEY = 'safety-dashboard-read-ids';
function loadDashboardReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DASHBOARD_READ_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}
function saveDashboardReadIds(ids: Set<string>) {
  try { localStorage.setItem(DASHBOARD_READ_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}

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
  {
    station: '강동역',
    severity: '주의',
    desc: '승강장 곡선 구간',
    uploadedAt: '2026-05-26T10:00:00',
    spot: '하행 승강장 3-2 구간',
    detail: '하행선 승강장이 곡선 구간에 위치해 열차와 승강장 사이의 간격이 일부 위치에서 25cm 이상 벌어집니다. 승객 발빠짐 사고 발생 우려가 있어 정차 시 운전실에서 안내방송과 함께 출입문 개방 전 후사경 확인이 필수입니다.',
    tips: [
      '정차 후 출입문 개방 전 후사경으로 승강장 간격 확인',
      '안내방송 1회 추가 송출 (간격 주의)',
      '발차 직전 영상 모니터로 발빠짐 여부 재확인',
    ],
    registeredBy: '안성숙 소장',
  },
  {
    station: '군자역',
    severity: '주의',
    desc: '신호 취급 주의',
    uploadedAt: '2026-05-25T10:00:00',
    spot: '본선 → 군자 진입 직전',
    detail: '진입 신호기 식별이 곡선 구간으로 인해 늦어질 수 있습니다. 야간/우천 시 더욱 주의가 필요합니다.',
    tips: [
      '진입 신호기 50m 전부터 환호 지적 강화',
      'ATC 지시속도 강제 준수',
      '야간/우천 시 전조등 상시 점등 확인',
    ],
    registeredBy: '강병우 지도기관사',
  },
  {
    station: '개화산역',
    severity: '위험',
    desc: '출입문 끼임 주의',
    uploadedAt: '2026-05-27T10:00:00',
    spot: '상행 4호차 2번 출입문',
    detail: '상행 열차 정차 위치 특성상 4호차 2번 출입문 부근에서 승객 끼임 신고가 최근 3건 보고되었습니다. 닫힘 직전 추가 확인이 필요합니다.',
    tips: [
      '4호차 2번 도어 닫힘 전 영상 모니터 집중 확인',
      '재개폐(2회) 적극 활용',
      '이상 시 즉시 운전관제 보고',
    ],
    registeredBy: '이태원 부소장',
  },
  {
    station: '까치산역',
    severity: '주의',
    desc: '승강장 틈새 주의',
    uploadedAt: '2026-05-24T10:00:00',
    spot: '상행 승강장 전 구간',
    detail: '상행 승강장 전 구간에서 열차와 승강장 사이 틈이 평소보다 다소 넓습니다. 어린이/노약자 승하차 시 주의 안내가 필요합니다.',
    tips: [
      '시발/종착역에 가까운 차량(1·8호차) 우선 점검',
      '안내방송 "발빠짐 주의" 추가 송출',
      '하차 인원 다수일 때 출입문 추가 개방 시간 확보',
    ],
    registeredBy: '이현구 지도부장',
  },
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

type SampleDetail = {
  id: string;
  kind: 'incident' | 'driving' | 'train' | 'hazard';
  badge?: string;
  badgeTone?: string;
  title: string;
  meta?: string;
  body?: string;
  bullets?: string[];
  /** 위험개소 상세 — 위치 상세 */
  spot?: string;
  /** 위험개소 상세 — 주의사항 목록 */
  tips?: string[];
  /** 등록자 */
  registeredBy?: string;
};

export default function SafetyDashboard({
  onBack, onOpenCategory, onOpenNotice, unreadCount = 0, userName = '', userRole = '',
}: Props) {
  const userLabel = userName ? `${userName} ${userRole.replace(/님$/, '')}` : '';

  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  useEffect(() => { setReadIds(loadDashboardReadIds()); }, []);

  const [selected, setSelected] = useState<SampleDetail | null>(null);

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveDashboardReadIds(next);
      return next;
    });
  }, []);

  const openDetail = useCallback((detail: SampleDetail) => {
    markRead(detail.id);
    setSelected(detail);
  }, [markRead]);

  const closeDetail = () => setSelected(null);

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
                INCIDENT_SAMPLES.slice(0, 3).map((it, i) => {
                  const id = `incident-${i}-${it.uploadedAt}`;
                  const isRead = readIds.has(id);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={`${styles.incidentItem} ${styles.itemBtn} ${isRead ? styles.itemRead : styles.itemUnread}`}
                        onClick={() => openDetail({
                          id, kind: 'incident', badge: it.kind, badgeTone: it.kindColor,
                          title: it.title, meta: `${it.date} · ${it.time} · ${it.location}`, body: it.summary,
                        })}
                      >
                        <div className={styles.incidentHeadRow}>
                          <span className={`${styles.kindBadge} ${styles[`kind_${it.kindColor}`]}`}>{it.kind}</span>
                          <span className={styles.incidentTitle}>{it.title}</span>
                          <ConfirmBadge read={isRead} />
                        </div>
                        <div className={styles.incidentMeta}>
                          <span>{it.date}</span>
                          <span className={styles.metaDot}>·</span>
                          <span>{it.location}</span>
                        </div>
                        <p className={styles.incidentSummary}>{it.summary}</p>
                      </button>
                    </li>
                  );
                })
              ) : (
                DRIVING_SAMPLES.slice(0, 3).map((it, i) => {
                  const id = `driving-${i}-${it.uploadedAt}`;
                  const isRead = readIds.has(id);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={`${styles.incidentItem} ${styles.itemBtn} ${isRead ? styles.itemRead : styles.itemUnread}`}
                        onClick={() => openDetail({
                          id, kind: 'driving', badge: '운전', badgeTone: 'blue',
                          title: it.title, meta: `${it.date} · ${it.location}`, body: it.summary,
                        })}
                      >
                        <div className={styles.incidentHeadRow}>
                          <span className={`${styles.kindBadge} ${styles.kind_blue}`}>운전</span>
                          <span className={styles.incidentTitle}>{it.title}</span>
                          <ConfirmBadge read={isRead} />
                        </div>
                        <div className={styles.incidentMeta}>
                          <span>{it.date}</span>
                          <span className={styles.metaDot}>·</span>
                          <span>{it.location}</span>
                        </div>
                        <p className={styles.incidentSummary}>{it.summary}</p>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {/* 우측 — 열차정보 */}
          <div className={styles.colWrap}>
            <div className={styles.colHead}>
              <h2 className={styles.colTitle}>최근 변경된 열차 정보</h2>
            </div>
            <ul className={styles.itemList}>
              {TRAIN_UPDATE_SAMPLES.map((it, i) => {
                const id = `train-${i}-${it.applied}`;
                const isRead = readIds.has(id);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className={`${styles.trainItem} ${styles.itemBtn} ${isRead ? styles.itemRead : styles.itemUnread}`}
                      onClick={() => openDetail({
                        id, kind: 'train', badge: 'NEW',
                        title: it.title, meta: it.applied, bullets: it.items,
                      })}
                    >
                      <div className={styles.trainHeadRow}>
                        <span className={styles.newBadge}>NEW</span>
                        <span className={styles.trainTitle}>{it.title}</span>
                        <ConfirmBadge read={isRead} />
                      </div>
                      <ul className={styles.trainSubList}>
                        {it.items.map((sub, j) => (
                          <li key={j}>{sub}</li>
                        ))}
                      </ul>
                      <span className={styles.trainApplied}>{it.applied}</span>
                    </button>
                  </li>
                );
              })}
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
              const id = `hazard-${h.station}-${h.uploadedAt}`;
              const isRead = readIds.has(id);
              return (
                <button
                  key={i}
                  type="button"
                  className={`${styles.hazardCard} ${styles.itemBtn} ${severe ? styles.hazardCardSevere : ''} ${isRead ? styles.itemRead : styles.itemUnread}`}
                  onClick={() => openDetail({
                    id, kind: 'hazard',
                    badge: h.severity,
                    badgeTone: severe ? 'red' : 'amber',
                    title: h.station,
                    meta: `등록 ${h.uploadedAt.slice(0,10)}`,
                    body: h.detail,
                    spot: h.spot,
                    tips: h.tips,
                    registeredBy: h.registeredBy,
                  })}
                >
                  <div className={styles.hazardTopRow}>
                    <span className={styles.hazardStation}>{h.station}</span>
                    <span className={`${styles.severityBadge} ${severe ? styles.severityBadgeSevere : styles.severityBadgeWarn}`}>
                      {h.severity}
                    </span>
                    <ConfirmBadge read={isRead} />
                  </div>
                  <p className={styles.hazardDesc}>{h.desc}</p>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {selected && (
        <SampleDetailModal detail={selected} onClose={closeDetail} />
      )}
    </div>
  );
}

/** 확인(✓) 표시 — 읽기 전: 외곽선만, 읽음: 채워진 체크 */
function ConfirmBadge({ read }: { read: boolean }) {
  return (
    <span
      className={`${styles.confirmBadge} ${read ? styles.confirmBadgeRead : styles.confirmBadgeUnread}`}
      aria-label={read ? '확인 완료' : '확인 전'}
    >
      <Check size={12} strokeWidth={3} />
    </span>
  );
}

/** 샘플 상세 모달 */
function SampleDetailModal({ detail, onClose }: { detail: SampleDetail; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className={styles.sampleModalOverlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.sampleModalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sampleModalHead}>
          {detail.badge && (
            <span className={`${styles.kindBadge} ${detail.badgeTone ? styles[`kind_${detail.badgeTone}`] : ''}`}>
              {detail.badge}
            </span>
          )}
          <h3 className={styles.sampleModalTitle}>{detail.title}</h3>
          <button type="button" className={styles.sampleModalClose} onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        {detail.spot && (
          <div className={styles.sampleModalRow}>
            <span className={styles.sampleModalRowLabel}>위치</span>
            <span className={styles.sampleModalRowValue}>{detail.spot}</span>
          </div>
        )}
        {detail.meta && <p className={styles.sampleModalMeta}>{detail.meta}</p>}
        {detail.body && <p className={styles.sampleModalBody}>{detail.body}</p>}
        {detail.tips && detail.tips.length > 0 && (
          <div className={styles.sampleModalSection}>
            <h4 className={styles.sampleModalSubTitle}>주의사항</h4>
            <ul className={styles.sampleModalBullets}>
              {detail.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        )}
        {detail.bullets && detail.bullets.length > 0 && (
          <ul className={styles.sampleModalBullets}>
            {detail.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}
        {detail.registeredBy && (
          <p className={styles.sampleModalRegistered}>등록: {detail.registeredBy}</p>
        )}
        <div className={styles.sampleModalConfirmed}>
          <Check size={14} strokeWidth={3} />
          <span>확인 완료</span>
        </div>
      </div>
    </div>
  );
}
