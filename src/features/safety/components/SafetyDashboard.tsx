'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, AlertTriangle, TrainFront, Gauge, GraduationCap,
  Megaphone, ChevronRight, Bell, Check, X, Lightbulb, TrendingUp, ShieldCheck,
} from 'lucide-react';
import { useRollCallStore } from '@/stores/rollcall';
import styles from './SafetyDashboard.module.css';
import { acquireScrollLock, releaseScrollLock } from '@/lib/overlay/scrollLockManager';
import { LINE5_PROFILE_ID } from '../constants';

/** DB report 형태 (필요한 필드만) */
interface ReportItem {
  id: string;
  description: string;
  location: string;
  createdAt: string;
  createdBy: string;
  resolved?: boolean;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

/** description prefix 파싱: `[tag] title\nbody` (CRLF·LF 모두 대응) */
function parseDescription(desc: string): { tag: string; title: string; body: string } {
  const normalized = (desc || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const firstLine = (lines[0] || '').trim();
  const body = lines.slice(1).join('\n').trim();
  const m = firstLine.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!m) return { tag: '', title: firstLine, body };
  return { tag: m[1].trim(), title: m[2].trim(), body };
}

/** 편성 태그 — `503편성` (특정 편성) 또는 `전편성` (전체 편성 공지) */
const TRAIN_TAG_RE = /^(?:\d+|전)편성$/;
const DRIVING_TAGS = new Set(['시설물', '열차', '신호']);
const DRIVING_TONE: Record<string, string> = { 시설물: 'amber', 열차: 'blue', 신호: 'red' };

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${mm}.${dd} ${hh}:${mi}`;
}

/** «10월 16일» — 목록 보조 줄용 짧은 날짜 */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

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
  onOpenCategory: (id: 'incident' | 'driving' | 'train' | 'hazard' | 'tips') => void;
  onOpenNotice?: () => void;
  /** 카드 클릭 시 해당 리포트 상세보기로 직접 진입 (요약 모달 대신) */
  onOpenReport?: (reportId: string, cardKey: 'incident' | 'driving' | 'train' | 'hazard') => void;
  /** 종 버튼 클릭 — 가장 우선순위 높은 미확인 정보로 즉시 이동 */
  onBellClick?: () => void;
  unreadCount?: number;
  /** 서버 기준 미확인 게시물 id(위험개소·사례교육·운전/열차정보) — 종 숫자와 같은 출처 */
  unreadIds?: ReadonlySet<string>;
  userName?: string;
  userRole?: string;
  /** 사용자 사번 — DB fetch에 사용 */
  sabun?: string;
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
  // 차량기지 2곳은 등록 화면과 같이 맨 앞
  '방화기지': -2, '고덕기지': -1, '방화': 0, '개화산': 1, '김포공항': 2, '송정': 3, '마곡': 4, '발산': 5, '우장산': 6, '화곡': 7,
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

// 최근 등록 3건 → 방화 기준 좌측부터 정렬
const HAZARD_ZONES_TOP3 = [...HAZARD_ZONE_SAMPLES_RAW]
  .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  .slice(0, 3)
  .sort((a, b) => stationOrderKey(a.station) - stationOrderKey(b.station));

const CATEGORIES = [
  { id: 'driving'  as const, label: '운전정보',  icon: Gauge,         tone: 'blue'  as const },
  { id: 'incident' as const, label: '사례교육',  icon: GraduationCap, tone: 'amber' as const },
  { id: 'train'    as const, label: '열차정보',  icon: TrainFront,    tone: 'green' as const },
  { id: 'hazard'   as const, label: '위험개소',   icon: AlertTriangle, tone: 'red'   as const },
  { id: 'tips'     as const, label: '안전상식',   icon: Lightbulb,     tone: 'purple' as const },
];

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
  onBack, onOpenCategory, onOpenNotice, onOpenReport, onBellClick, unreadCount = 0, unreadIds, userName = '', userRole = '', sabun = '',
}: Props) {
  // 머리를 교육 영역 꼴로 바꾸며 사용자 이름 칩은 뺐다(2026-10-17) — 값은 다른 화면 호환용으로만 받는다
  void userName; void userRole;

  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  useEffect(() => { setReadIds(loadDashboardReadIds()); }, []);

  /* === 실데이터 fetch — action + inspect + hazard ===
     캐시 전략: 직전 fetch 결과를 localStorage 에 저장해두고, 재진입 시
     초기 state 를 캐시에서 즉시 채워 깜빡임 제거. 그 후 백그라운드 refetch. */
  const CACHE_KEY = 'safety-dashboard-cache-v1';
  type TipItem = { id: string; title: string; createdAt: string };
  type Cache = { action: ReportItem[]; inspect: ReportItem[]; hazard: ReportItem[]; tips?: TipItem[]; cachedAt: number };
  const loadCache = (): Cache | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw) as Cache;
      if (!c || !Array.isArray(c.action) || !Array.isArray(c.inspect) || !Array.isArray(c.hazard)) return null;
      return c;
    } catch { return null; }
  };
  const [actionReports, setActionReports] = useState<ReportItem[]>(() => loadCache()?.action ?? []);
  const [inspectReports, setInspectReports] = useState<ReportItem[]>(() => loadCache()?.inspect ?? []);
  const [hazardReports, setHazardReports] = useState<ReportItem[]>(() => loadCache()?.hazard ?? []);
  const [tips, setTips] = useState<TipItem[]>(() => loadCache()?.tips ?? []);
  // 캐시가 있으면 dataLoaded=true 로 시작 → 진입 즉시 실데이터 노출
  const [dataLoaded, setDataLoaded] = useState(() => loadCache() !== null);
  useEffect(() => {
    let cancelled = false;
    const qs = sabun ? `?sabun=${encodeURIComponent(sabun)}` : '';
    let nextAction: ReportItem[] = [];
    let nextInspect: ReportItem[] = [];
    let nextHazard: ReportItem[] = [];
    let nextTips: TipItem[] = [];
    const fetchAction = fetch(`/api/safety/hazards${qs}${qs ? '&' : '?'}category=action`)
      .then(r => r.json())
      .then(j => { nextAction = j.data ?? []; if (!cancelled) setActionReports(nextAction); })
      .catch(() => {});
    const fetchInspect = fetch(`/api/safety/hazards${qs}${qs ? '&' : '?'}category=inspect`)
      .then(r => r.json())
      .then(j => { nextInspect = j.data ?? []; if (!cancelled) setInspectReports(nextInspect); })
      .catch(() => {});
    const fetchHazard = fetch(`/api/safety/hazards${qs}${qs ? '&' : '?'}category=hazard`)
      .then(r => r.json())
      .then(j => { nextHazard = j.data ?? []; if (!cancelled) setHazardReports(nextHazard); })
      .catch(() => {});
    // 안전상식 — 오른쪽 «최근 업로드된 안전 소식» 에 섞어 보이려고 제목·시각만 쓴다
    const fetchTips = fetch('/api/safety/tips')
      .then(r => r.json())
      .then((j: { data?: TipItem[] }) => {
        nextTips = (j.data ?? []).map((t) => ({ id: t.id, title: t.title, createdAt: t.createdAt }));
        if (!cancelled) setTips(nextTips);
      })
      .catch(() => {});
    Promise.all([fetchAction, fetchInspect, fetchHazard, fetchTips]).then(() => {
      if (cancelled) return;
      setDataLoaded(true);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          action: nextAction, inspect: nextInspect, hazard: nextHazard, tips: nextTips, cachedAt: Date.now(),
        } satisfies Cache));
      } catch { /* ignore */ }
    });
    return () => { cancelled = true; };
  }, [sabun]);

  /* === hazard 데이터 파싱: description prefix가 `[강동역·위험] 제목` 형식 === */
  const parsedHazards = useMemo(() => {
    return hazardReports.map((r) => {
      const p = parseDescription(r.description);
      // tag 형태: "강동역·위험" 또는 "강동역" (역만)
      const parts = p.tag.split('·');
      const station = (parts[0] || '').trim();
      const severity = (parts[1] || '주의').trim();
      return {
        item: r,
        station,
        severity,
        title: p.title,
        desc: p.body || p.title,
      };
    }).filter((h) => h.station);
  }, [hazardReports]);

  const realHazardTop = useMemo(() => {
    if (parsedHazards.length === 0) return [];
    return [...parsedHazards]
      .sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt))
      .slice(0, 3)
      .sort((a, b) => stationOrderKey(a.station) - stationOrderKey(b.station));
  }, [parsedHazards]);

  /* === inspect 데이터를 prefix 태그로 분류 (열차 편성 vs 운전 vs 공지) === */
  const { trainReports, drivingReports, noticeReports } = useMemo(() => {
    const train: { item: ReportItem; tag: string; title: string; body: string }[] = [];
    const drive: { item: ReportItem; tag: string; title: string; body: string }[] = [];
    const notice: { item: ReportItem; tag: string; title: string; body: string }[] = [];
    for (const r of inspectReports) {
      const p = parseDescription(r.description);
      if (TRAIN_TAG_RE.test(p.tag)) train.push({ item: r, ...p });
      else if (DRIVING_TAGS.has(p.tag)) drive.push({ item: r, ...p });
      else notice.push({ item: r, ...p });
    }
    return { trainReports: train, drivingReports: drive, noticeReports: notice };
  }, [inspectReports]);

  /* === 공지(점호)사항 — 안전 게시판이 아니라 점호 게시판(줄 하나)을 읽는다 === */
  const rollCallItems = useRollCallStore((st) => st.items);
  const loadRollCall = useRollCallStore((st) => st.load);
  useEffect(() => { loadRollCall(); }, [loadRollCall]);

  /* === 좌측 섹션 결정 — 액션(사고사례)과 운전정보 중 더 최근 === */
  const parsedActions = useMemo(() => actionReports.map(r => ({ item: r, ...parseDescription(r.description) })), [actionReports]);
  const hasRealLeft = parsedActions.length > 0 || drivingReports.length > 0;
  const hasRealTrain = trainReports.length > 0;
  const hasRealNotice = rollCallItems.length > 0;
  const hasRealHazard = parsedHazards.length > 0;
  // 캐시 적용으로 재진입 시 dataLoaded=true 로 시작 → 실데이터 즉시 표시.
  // 첫 진입(캐시 없음)은 빈 상태로 fetch 대기 (샘플 깜빡임 없음).
  const useRealData = dataLoaded && (hasRealLeft || hasRealTrain || hasRealNotice || hasRealHazard);
  const showSamples = dataLoaded && !useRealData;
  const showProtoBanner = showSamples;


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

  /* === 최근 게시물 — 한 칸 목록 + 탭(전체/운전정보/안전소식) (진호 2026-10-16 시안) ===
     두 칸(160px)에 나눠 담으면 제목이 잘려서 한 칸 전체 폭으로 바꿨다.
     미확인 표시는 서버 기록(unreadIds) — 맨 위 요약·종 숫자와 같은 출처. 안전상식은 읽음 기록이 없다. */
  type FeedTone = 'driving' | 'incident' | 'hazard' | 'train' | 'tips';
  type FeedItem = { key: string; reportId?: string; tone: FeedTone; chip: string; title: string; sub: string; at: string; open: () => void };
  const [feedTab, setFeedTab] = useState<'all' | 'driving' | 'others'>('all');
  const feedAll = useMemo<FeedItem[]>(() => {
    const out: FeedItem[] = [];
    for (const p of drivingReports) {
      const ho = (p.item.location || '').trim();
      out.push({ key: `driving-${p.item.id}`, reportId: p.item.id, tone: 'driving', chip: ho ? `운전정보 ${ho}` : '운전정보', title: p.title, sub: shortDate(p.item.createdAt), at: p.item.createdAt, open: () => onOpenReport?.(p.item.id, 'driving') });
    }
    for (const p of parsedActions) {
      const ho = (p.item.location || '').trim();
      out.push({ key: `incident-${p.item.id}`, reportId: p.item.id, tone: 'incident', chip: ho ? `사례교육 ${ho}` : '사례교육', title: p.title, sub: shortDate(p.item.createdAt), at: p.item.createdAt, open: () => onOpenReport?.(p.item.id, 'incident') });
    }
    for (const h of parsedHazards) {
      out.push({ key: `hazard-${h.item.id}`, reportId: h.item.id, tone: 'hazard', chip: `위험개소 ${h.station}`, title: h.title, sub: `${h.severity} · ${shortDate(h.item.createdAt)}`, at: h.item.createdAt, open: () => onOpenReport?.(h.item.id, 'hazard') });
    }
    for (const t of trainReports) {
      out.push({ key: `train-${t.item.id}`, reportId: t.item.id, tone: 'train', chip: t.tag ? `열차정보 ${t.tag}` : '열차정보', title: t.title, sub: shortDate(t.item.createdAt), at: t.item.createdAt, open: () => onOpenReport?.(t.item.id, 'train') });
    }
    for (const t of tips) {
      out.push({ key: `tips-${t.id}`, tone: 'tips', chip: '안전상식', title: t.title, sub: shortDate(t.createdAt), at: t.createdAt, open: () => onOpenCategory('tips') });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [drivingReports, parsedActions, parsedHazards, trainReports, tips, onOpenReport, onOpenCategory]);

  /* 데이터가 하나도 없을 때(목업) — 샘플을 같은 꼴로 */
  const feedSamples = useMemo<FeedItem[]>(() => [
    ...DRIVING_SAMPLES.map((it, i) => ({
      key: `driving-sample-${i}`, tone: 'driving' as const, chip: '운전정보', title: it.title, sub: it.date, at: it.uploadedAt,
      open: () => openDetail({ id: `driving-sample-${i}-${it.uploadedAt}`, kind: 'driving', badge: '운전', badgeTone: 'blue', title: it.title, meta: `${it.date} · ${it.location}`, body: it.summary }),
    })),
    ...INCIDENT_SAMPLES.map((it, i) => ({
      key: `incident-sample-${i}`, tone: 'incident' as const, chip: '사례교육', title: it.title, sub: it.date, at: it.uploadedAt,
      open: () => openDetail({ id: `incident-sample-${i}-${it.uploadedAt}`, kind: 'incident', badge: it.kind, badgeTone: it.kindColor, title: it.title, meta: `${it.date} · ${it.time} · ${it.location}`, body: it.summary }),
    })),
    ...TRAIN_UPDATE_SAMPLES.map((it, i) => ({
      key: `train-sample-${i}`, tone: 'train' as const, chip: '열차정보', title: it.title, sub: it.applied, at: '',
      open: () => openDetail({ id: `train-sample-${i}-${it.applied}`, kind: 'train', badge: 'NEW', title: it.title, meta: it.applied, bullets: it.items }),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)), [openDetail]);

  const feedSource = useRealData ? feedAll : showSamples ? feedSamples : [];
  const feedFiltered = feedSource
    .filter((f) => feedTab === 'all' || (feedTab === 'driving' ? f.tone === 'driving' : f.tone !== 'driving'));
  // 최신순만 쓰면 위험개소만 줄줄이 나와 아래 «주요 위험개소» 와 겹친다 →
  // 분류마다 가장 최근 1건씩 먼저 고르고, 자리가 남으면 다음 최신글로 채운다(보여줄 때는 시간순).
  const feedShown = (() => {
    const picked: FeedItem[] = [];
    const seen = new Set<FeedTone>();
    for (const f of feedFiltered) {
      if (picked.length >= 5) break;
      if (!seen.has(f.tone)) { seen.add(f.tone); picked.push(f); }
    }
    for (const f of feedFiltered) {
      if (picked.length >= 5) break;
      if (!picked.includes(f)) picked.push(f);
    }
    return picked.sort((a, b) => b.at.localeCompare(a.at));
  })();
  const isUnread = (f: FeedItem) => !!(f.reportId && unreadIds?.has(f.reportId));
  const feedUnreadCount = feedSource.filter(isUnread).length;

  /* 공지(점호) 꼬리표 — 관리자가 고른 글자색을 뜻으로 보여 준다(빨강=필독, 파랑=중요) */
  const noticeTag = (color: string | undefined) =>
    color === 'red' ? { label: '필독', cls: styles.tagMust }
      : color === 'blue' ? { label: '중요', cls: styles.tagImportant }
        : null;
  const mustCount = rollCallItems.filter((it) => it.color === 'red').length;

  return (
    <div className={styles.wrap}>
      {/* 머리 — 교육 영역(EduHome heroV3)과 같은 꼴로 맞춘다: 영역끼리 따로 놀지 않게 (진호 2026-10-16) */}
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <button type="button" className={styles.heroBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={styles.heroBtn}
            onClick={onBellClick}
            disabled={!onBellClick || unreadCount === 0}
            aria-label={unreadCount > 0 ? `미확인 ${unreadCount}건 — 첫 항목으로 이동` : '미확인 정보 없음'}
            title={unreadCount > 0 ? `미확인 ${unreadCount}건` : '모두 확인 완료'}
          >
            <Bell size={20} strokeWidth={2} />
            {unreadCount > 0 && (
              <span className={styles.heroBellBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>
        </div>
        <span className={styles.heroPill} aria-hidden="true"><span className={styles.heroPillDot} />LINE 5</span>
        <div className={styles.heroTitleRow}>
          <span className={styles.heroIconTile} aria-hidden="true"><ShieldCheck size={26} strokeWidth={2.2} /></span>
          <h1 className={styles.heroTitle}>안전</h1>
        </div>
        <p className={styles.heroDesc}>승무 전 꼭 확인할 공지와 안전 정보를 모았어요</p>
      </header>

      {showProtoBanner && (
        <div className={styles.prototypeNotice}>
          <span>목업 — 샘플 데이터입니다</span>
        </div>
      )}

      <main className={styles.content}>
        {/* 공지·점호사항 — 제목줄까지 카드 하나. 첫 건은 안쪽 옅은 바탕 상자로 크게, 나머지는 구분선 줄 (진호 참고안 2026-10-16) */}
        <section className={styles.noticePanel}>
          <div className={styles.noticePanelHead}>
            <h2 className={styles.blockTitle}>
              <Megaphone size={18} className={styles.blockTitleIcon} aria-hidden />
              공지·점호사항
            </h2>
            {rollCallItems.length > 0 && (
              <span className={styles.countPill}>{mustCount > 0 ? `필독 ${mustCount}건` : `${rollCallItems.length}건`}</span>
            )}
          </div>
          {rollCallItems.length > 0 ? (
            <>
              {(() => {
                const first = rollCallItems[0];
                const tag = noticeTag(first.color);
                const must = first.color === 'red';
                return (
                  <button
                    type="button"
                    className={`${styles.noticeFeatured} ${must ? styles.noticeFeaturedMust : ''}`}
                    onClick={() => onOpenNotice?.()}
                  >
                    {tag && <span className={`${styles.noticeTag} ${styles.noticeTagOnTint} ${tag.cls}`}>{tag.label}</span>}
                    <span className={styles.noticeFeaturedText}>{first.text}</span>
                    <span className={styles.noticeFeaturedCta}>내용 확인하기 <ChevronRight size={16} aria-hidden /></span>
                  </button>
                );
              })()}
              {rollCallItems.slice(1, 4).map((it) => {
                const tag = noticeTag(it.color);
                return (
                  <button key={it.id} type="button" className={`${styles.listRow} ${styles.noticePanelRow}`} onClick={() => onOpenNotice?.()}>
                    {tag && <span className={`${styles.noticeTag} ${tag.cls}`}>{tag.label}</span>}
                    <span className={styles.listRowText}>{it.text}</span>
                    <ChevronRight size={18} className={styles.listRowChevron} aria-hidden />
                  </button>
                );
              })}
              {rollCallItems.length > 4 && (
                <button type="button" className={`${styles.listRow} ${styles.noticePanelRow} ${styles.listRowMore}`} onClick={() => onOpenNotice?.()}>
                  외 {rollCallItems.length - 4}건 더 보기 <ChevronRight size={16} aria-hidden />
                </button>
              )}
            </>
          ) : (
            <button type="button" className={styles.noticeEmpty} onClick={onOpenNotice}>
              <p className={styles.noticeEmptyText}>오늘 전달할 점호 사항이 없어요</p>
              <p className={styles.noticeEmptyHint}>관리자가 적은 점호 사항이 여기에 표시돼요</p>
            </button>
          )}
        </section>

        {/* 분류 바로가기 — 주인공이 아니라 길잡이: 빛·색 테두리 없이 아이콘과 이름만 */}
        <nav className={styles.catLiteRow} aria-label="안전 분류">
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            return (
              <button key={c.id} type="button" className={styles.catLite} onClick={() => onOpenCategory(c.id)}>
                <span className={styles.catLiteIcon}>
                  <Icon size={28} strokeWidth={2} />
                </span>
                <span className={styles.catLiteLabel}>{c.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 최근 게시물 — 한 칸 전체 폭 + 탭 */}
        <section className={styles.homeBlock}>
          <div className={styles.blockHead}>
            <h2 className={styles.blockTitle}>최근 게시물</h2>
            {feedUnreadCount > 0 && <span className={styles.blockHeadMeta}>미확인 <strong>{feedUnreadCount}</strong>건</span>}
          </div>
          <div className={styles.feedTabs} role="tablist" aria-label="게시물 종류">
            {([['all', '전체'], ['driving', '운전정보'], ['others', '안전소식']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={feedTab === k}
                tabIndex={feedTab === k ? 0 : -1}
                className={`${styles.feedTab} ${feedTab === k ? styles.feedTabActive : ''}`}
                onClick={() => setFeedTab(k)}
              >
                {label}
              </button>
            ))}
          </div>
          {feedShown.length > 0 ? (
            <div className={styles.listCard}>
              {feedShown.map((f) => {
                const unread = isUnread(f);
                return (
                  <button key={f.key} type="button" className={styles.feedRow} onClick={() => { markRead(f.key); f.open(); }}>
                    <span className={styles.feedMeta}>
                      <span className={styles.feedChip}>{f.chip}</span>
                      {unread && <span className={styles.feedStatus}>미확인</span>}
                    </span>
                    <span className={styles.feedTitle}>{f.title}</span>
                    <span className={styles.feedSub}>
                      {f.sub}
                      <ChevronRight size={18} className={styles.listRowChevron} aria-hidden />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : dataLoaded ? (
            <p className={styles.feedEmpty}>아직 올라온 게시물이 없어요</p>
          ) : null}
        </section>

        {/* 주요 위험개소 — 위 목록과 같은 꼴(카드 하나 + 구분선). 색은 «위험» 등급만 빨강 */}
        <section className={styles.homeBlock}>
          <div className={styles.blockHead}>
            <h2 className={styles.blockTitle}>주요 위험개소</h2>
            <button type="button" className={styles.blockMore} onClick={() => onOpenCategory('hazard')}>
              전체보기 <ChevronRight size={16} aria-hidden />
            </button>
          </div>
          <div className={styles.listCard}>
            <button type="button" className={`${styles.listRow} ${styles.profileRow}`} onClick={() => onOpenReport?.(LINE5_PROFILE_ID, 'hazard')}>
              <span className={styles.profileIcon} aria-hidden="true"><TrendingUp size={20} strokeWidth={2.2} /></span>
              <span className={styles.profileText}>
                <span className={styles.profileTitle}>5호선 상구배 단면도</span>
                <span className={styles.profileDesc}>20‰ 초과 오르막 · 가로/세로 보기</span>
              </span>
              <ChevronRight size={18} className={styles.listRowChevron} aria-hidden />
            </button>
            {(realHazardTop.length > 0
              ? realHazardTop.map((h) => ({
                  key: h.item.id, station: h.station, level: h.item.resolved ? '조치완료' : h.severity, text: h.title || h.desc,
                  unread: !!unreadIds?.has(h.item.id),
                  open: () => { markRead(`hazard-${h.item.id}`); onOpenReport?.(h.item.id, 'hazard'); },
                }))
              : showSamples
                ? HAZARD_ZONES_TOP3.map((h, i) => ({
                    key: `sample-${i}`, station: h.station, level: h.severity, text: h.desc, unread: false,
                    open: () => openDetail({
                      id: `hazard-${h.station}-${h.uploadedAt}`, kind: 'hazard', badge: h.severity, badgeTone: h.severity === '위험' ? 'red' : 'amber',
                      title: h.station, meta: `등록 ${h.uploadedAt.slice(0, 10)}`, body: h.detail, spot: h.spot, tips: h.tips, registeredBy: h.registeredBy,
                    }),
                  }))
                : []
            ).map((h) => (
              <button key={h.key} type="button" className={styles.feedRow} onClick={h.open}>
                <span className={styles.feedMeta}>
                  <span className={styles.hazardMetaLeft}>
                    <span className={styles.feedChip}>{h.station}</span>
                    <span className={`${styles.noticeTag} ${h.level === '위험' ? styles.tagMust : styles.tagImportant}`}>{h.level}</span>
                  </span>
                  {h.unread && <span className={styles.feedStatus}>미확인</span>}
                </span>
                <span className={styles.feedTitle}>{h.text}</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {selected && (
        <SampleDetailModal detail={selected} onClose={closeDetail} />
      )}
    </div>
  );
}


/** 샘플 상세 모달 */
function SampleDetailModal({ detail, onClose }: { detail: SampleDetail; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    acquireScrollLock();
    return () => {
      window.removeEventListener('keydown', onKey);
      releaseScrollLock();
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
