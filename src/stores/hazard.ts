import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase-lazy';

export type SafetyCategory = 'hazard' | 'action' | 'inspect';

export interface HazardReport {
  id: string;
  /** 대표 사진(첫 장) — 목록 썸네일이 쓴다 */
  photoUrl: string;
  /** 첨부한 사진 전부. 사진이 한 장뿐이면 photoUrl 과 같은 한 장이 들어 있다 */
  photoUrls: string[];
  attachmentUrl: string;
  attachmentName: string;
  description: string;
  location: string;
  /** 사고 유형 태그 — 출입문·승강장안전문·미개방·지적확인환호 등 */
  tags?: string[];
  createdBy: string;
  createdAt: string;
  category?: SafetyCategory;
  viewCount: number;
  commentCount: number;
  likeCount: number;
  likedByMe: boolean;
  readCount: number;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface ReadStatusResponse {
  readers: { sabun: string; name: string; readAt: string }[];
  nonReaders: { sabun: string; name: string }[];
  totalExpected: number;
  readCount: number;
}

export interface HazardComment {
  id: string;
  reportId: string;
  comment: string;
  createdBy: string;
  createdAt: string;
}

interface HazardState {
  reports: HazardReport[];
  comments: Record<string, HazardComment[]>;
  loadingReports: boolean;
  loadingComments: boolean;
  fetchReports: (currentSabun?: string, category?: SafetyCategory) => Promise<void>;
  createReport: (params: {
    /** 첨부할 사진들 — 고른 순서대로. 첫 장이 대표 사진이 된다 */
    photos: File[];
    attachment?: File | null;
    description: string;
    location: string;
    name: string;
    sabun: string;
    category?: SafetyCategory;
  }) => Promise<void>;
  fetchComments: (reportId: string) => Promise<void>;
  addComment: (reportId: string, comment: string, name: string, sabun: string) => Promise<void>;
  updateReport: (reportId: string, description: string, location: string, name: string, sabun: string, removeFile?: boolean) => Promise<void>;
  deleteReport: (reportId: string, name: string, sabun: string) => Promise<void>;
  toggleResolved: (reportId: string, resolved: boolean, name: string, sabun: string) => Promise<void>;
  updateComment: (reportId: string, commentId: string, comment: string, name: string, sabun: string) => Promise<void>;
  deleteComment: (reportId: string, commentId: string, name: string, sabun: string) => Promise<void>;
  recordRead: (reportId: string, sabun: string, name: string) => Promise<void>;
  fetchReaders: (reportId: string) => Promise<{ name: string; readAt: string }[]>;
  fetchReadStatus: (reportId: string) => Promise<ReadStatusResponse | null>;
  toggleLike: (reportId: string, name: string, sabun: string) => Promise<void>;
  incrementView: (reportId: string) => Promise<void>;
  /** 목록을 비우지 않고 조용히 갱신 — 실시간 반영용 (fetchReports 는 스피너용이라 목록을 비운다) */
  refreshReports: (currentSabun?: string, category?: SafetyCategory) => Promise<void>;
  /** 실시간 구독 — 정리 함수를 돌려준다. 화면 마운트 시 1회 호출. */
  subscribeRealtime: (opts?: { sabun?: string; category?: SafetyCategory }) => () => void;
}

export const useHazardStore = create<HazardState>()((set, get) => ({
  reports: [],
  comments: {},
  loadingReports: false,
  loadingComments: false,

  fetchReports: async (currentSabun?: string, category?: SafetyCategory) => {
    set({ loadingReports: true, reports: [] });
    try {
      const params = new URLSearchParams();
      if (currentSabun) params.set('sabun', currentSabun);
      if (category) params.set('category', category);
      const qs = params.toString();
      const url = `/api/safety/hazards${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        set({ loadingReports: false });
        return;
      }
      const json = await res.json() as { data: HazardReport[] };
      set({ reports: json.data ?? [] });
    } catch {
      // 네트워크 에러
    }
    set({ loadingReports: false });
  },

  createReport: async ({ photos, attachment, description, location, name, sabun, category }) => {
    const formData = new FormData();
    // 같은 이름으로 여러 번 담는다 — 서버가 getAll('photo') 로 순서대로 받는다
    for (const photo of photos) formData.append('photo', photo);
    if (attachment) formData.append('attachment', attachment, attachment.name);
    formData.append('description', description);
    formData.append('location', location);
    formData.append('name', name);
    formData.append('sabun', sabun);
    if (category) formData.append('category', category);

    const res = await fetch('/api/safety/hazards', { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const e = err as { message?: string; detail?: string; code?: string };
      throw new Error(`${e.message || '등록에 실패했습니다'}${e.detail ? ` (${e.detail})` : ''}${e.code ? ` [${e.code}]` : ''}`);
    }
    await get().fetchReports(undefined, category);
  },

  fetchComments: async (reportId: string) => {
    set({ loadingComments: true });
    try {
      const res = await fetch(`/api/safety/hazards/${reportId}/comments`);
      if (!res.ok) {
        set({ loadingComments: false });
        return;
      }
      const json = await res.json() as { data: HazardComment[] };
      set((state) => ({
        comments: {
          ...state.comments,
          [reportId]: json.data ?? [],
        },
      }));
    } catch {
      // 네트워크 에러
    }
    set({ loadingComments: false });
  },

  addComment: async (reportId, comment, name, sabun) => {
    const res = await fetch(`/api/safety/hazards/${reportId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment, name, sabun }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || '댓글 등록에 실패했습니다');
    }

    await get().fetchComments(reportId);
    set((state) => ({
      reports: state.reports.map((r) =>
        r.id === reportId ? { ...r, commentCount: r.commentCount + 1 } : r,
      ),
    }));
  },

  updateReport: async (reportId, description, location, name, sabun, removeFile) => {
    const res = await fetch(`/api/safety/hazards/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, location, name, sabun, removeFile }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || '수정에 실패했습니다');
    }

    set((state) => ({
      reports: state.reports.map((r) =>
        r.id === reportId
          ? { ...r, description, location, ...(removeFile ? { photoUrl: '' } : {}) }
          : r,
      ),
    }));
  },

  deleteReport: async (reportId, name, sabun) => {
    const res = await fetch(`/api/safety/hazards/${reportId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sabun }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || '삭제에 실패했습니다');
    }

    // 로컬 상태에서 제거
    set((state) => ({
      reports: state.reports.filter((r) => r.id !== reportId),
      comments: Object.fromEntries(
        Object.entries(state.comments).filter(([key]) => key !== reportId),
      ),
    }));
  },

  toggleResolved: async (reportId, resolved, name, sabun) => {
    const res = await fetch(`/api/safety/hazards/${reportId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved, name, sabun }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || '조치완료 처리에 실패했습니다');
    }
    const result = (await res.json()) as { resolved: boolean; resolvedAt: string | null; resolvedBy: string | null };

    set((state) => ({
      reports: state.reports.map((r) =>
        r.id === reportId
          ? { ...r, resolved: result.resolved, resolvedAt: result.resolvedAt, resolvedBy: result.resolvedBy }
          : r,
      ),
    }));
  },

  updateComment: async (reportId, commentId, comment, name, sabun) => {
    const res = await fetch(`/api/safety/hazards/${reportId}/comments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, comment, name, sabun }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || '댓글 수정에 실패했습니다');
    }

    // 로컬 상태 즉시 업데이트
    set((state) => ({
      comments: {
        ...state.comments,
        [reportId]: (state.comments[reportId] ?? []).map((c) =>
          c.id === commentId ? { ...c, comment } : c,
        ),
      },
    }));
  },

  deleteComment: async (reportId, commentId, name, sabun) => {
    const res = await fetch(`/api/safety/hazards/${reportId}/comments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, name, sabun }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || '댓글 삭제에 실패했습니다');
    }

    // 로컬 상태에서 제거
    set((state) => ({
      comments: {
        ...state.comments,
        [reportId]: (state.comments[reportId] ?? []).filter((c) => c.id !== commentId),
      },
      reports: state.reports.map((r) =>
        r.id === reportId ? { ...r, commentCount: Math.max(0, r.commentCount - 1) } : r,
      ),
    }));
  },

  recordRead: async (reportId, sabun, name) => {
    try {
      const res = await fetch(`/api/safety/hazards/${reportId}/reads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sabun, name }),
      });
      if (res.ok) {
        const { readCount } = await res.json() as { readCount: number };
        set((state) => ({
          reports: state.reports.map((r) =>
            r.id === reportId ? { ...r, readCount } : r,
          ),
        }));
      }
    } catch {
      // 무시
    }
  },

  fetchReaders: async (reportId) => {
    try {
      const res = await fetch(`/api/safety/hazards/${reportId}/reads`);
      if (!res.ok) return [];
      const json = await res.json() as { data: { name: string; readAt: string }[] };
      return json.data ?? [];
    } catch {
      return [];
    }
  },

  fetchReadStatus: async (reportId) => {
    try {
      const res = await fetch(`/api/safety/hazards/${reportId}/read-status`);
      if (!res.ok) return null;
      const json = await res.json() as ReadStatusResponse;
      return json;
    } catch {
      return null;
    }
  },

  incrementView: async (reportId) => {
    try {
      const res = await fetch(`/api/safety/hazards/${reportId}/views`, { method: 'POST' });
      if (!res.ok) return;
      const result = (await res.json()) as { viewCount: number };
      set((state) => ({
        reports: state.reports.map((r) =>
          r.id === reportId ? { ...r, viewCount: result.viewCount } : r,
        ),
      }));
    } catch {
      // 조회수 증가 실패는 무시 (핵심 기능 아님)
    }
  },

  toggleLike: async (reportId, name, sabun) => {
    const res = await fetch(`/api/safety/hazards/${reportId}/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sabun }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || '좋아요에 실패했습니다');
    }

    const result = (await res.json()) as { liked: boolean; likeCount: number };

    set((state) => ({
      reports: state.reports.map((r) =>
        r.id === reportId
          ? { ...r, likedByMe: result.liked, likeCount: result.likeCount }
          : r,
      ),
    }));
  },

  /**
   * 목록을 **비우지 않고** 갱신한다.
   * fetchReports 는 시작하자마자 `reports: []` 로 비우는데(스피너를 보여주려고),
   * 실시간 갱신에 그걸 쓰면 남이 글을 올릴 때마다 내 화면의 목록이 통째로 깜빡인다.
   * 읽던 자리를 잃지 않도록 조용히 갈아끼운다.
   */
  refreshReports: async (currentSabun?: string, category?: SafetyCategory) => {
    try {
      const params = new URLSearchParams();
      if (currentSabun) params.set('sabun', currentSabun);
      if (category) params.set('category', category);
      const qs = params.toString();
      const res = await fetch(`/api/safety/hazards${qs ? `?${qs}` : ''}`);
      if (!res.ok) return;
      const json = (await res.json()) as { data: HazardReport[] };
      set({ reports: json.data ?? [] });
    } catch {
      // 네트워크 에러 — 조용히 실패(다음 이벤트나 수동 새로고침에 따라잡는다)
    }
  },

  /**
   * 안전 게시판 실시간 구독 (2026-08-09 신설).
   *
   * 이전에는 hazard 만 실시간이 아니었다 — 공지(alerts)·교체요청(exchange)·대전게임은
   * 이미 postgres_changes 를 쓰고 있었는데, 안전 게시판은 수동 새로고침 전까지
   * 남이 올린 위험요인이 안 보였다. 안전 정보는 늦게 보는 것 자체가 위험이다.
   *
   * 구조는 stores/alert.ts 의 패턴을 그대로 따른다(supabase-js 지연 로드 → 채널 구독 → 정리).
   * · hazard_reports  : 새 글/수정/삭제/해결처리 → 목록 조용히 갱신
   * · hazard_comments : 댓글 변경 → **이미 열어 둔 글의 댓글만** 다시 읽는다
   *   (전체를 다시 읽으면 안 보고 있는 글까지 네트워크를 쓴다)
   *
   * ⚠️ 좋아요(hazard_likes)·읽음(hazard_reads)은 구독하지 않는다 —
   *   변경이 잦은데 화면에 미치는 영향은 카운트 숫자뿐이라, 트래픽 대비 이득이 없다.
   *   해당 카운트는 각자의 액션 응답으로 이미 갱신된다.
   */
  subscribeRealtime: (opts) => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    getSupabase().then((sb) => {
      if (!sb || cancelled) return;
      channel = sb
        .channel('hazard-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'hazard_reports' },
          () => { get().refreshReports(opts?.sabun, opts?.category); },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'hazard_comments' },
          (payload) => {
            const row = (payload.new ?? payload.old) as { report_id?: string } | null;
            const reportId = row?.report_id;
            // 열어 둔 글의 댓글만 갱신 — 그 외는 다음에 열 때 최신을 받는다
            if (reportId && get().comments[reportId]) get().fetchComments(reportId);
            // 댓글 수 배지는 목록에 있으므로 목록도 조용히 갱신
            get().refreshReports(opts?.sabun, opts?.category);
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) {
        const ch = channel;
        getSupabase().then((sb) => { sb?.removeChannel(ch); });
      }
    };
  },
}));
