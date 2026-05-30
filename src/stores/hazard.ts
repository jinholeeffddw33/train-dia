import { create } from 'zustand';

export type SafetyCategory = 'hazard' | 'action' | 'inspect';

export interface HazardReport {
  id: string;
  photoUrl: string;
  description: string;
  location: string;
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
    photo: File;
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
  toggleLike: (reportId: string, name: string, sabun: string) => Promise<void>;
  incrementView: (reportId: string) => Promise<void>;
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

  createReport: async ({ photo, description, location, name, sabun, category }) => {
    const formData = new FormData();
    if (photo) formData.append('photo', photo);
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
}));
