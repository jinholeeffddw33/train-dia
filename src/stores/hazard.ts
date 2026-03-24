import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface HazardReport {
  id: string;
  photoUrl: string;
  description: string;
  location: string;
  createdBy: string;
  createdAt: string;
  commentCount: number;
  likeCount: number;
  likedByMe: boolean;
}

export interface HazardComment {
  id: string;
  reportId: string;
  comment: string;
  createdBy: string;
  createdAt: string;
}

interface DbReport {
  id: string;
  photo_url: string;
  description: string;
  location: string;
  created_by: string;
  created_at: string;
  hazard_comments: { count: number }[];
  hazard_likes: { count: number }[];
}

interface DbComment {
  id: string;
  report_id: string;
  comment: string;
  created_by: string;
  created_at: string;
}

interface HazardState {
  reports: HazardReport[];
  comments: Record<string, HazardComment[]>;
  loadingReports: boolean;
  loadingComments: boolean;
  fetchReports: (currentSabun?: string) => Promise<void>;
  createReport: (params: {
    photo: File;
    description: string;
    location: string;
    name: string;
    sabun: string;
  }) => Promise<void>;
  fetchComments: (reportId: string) => Promise<void>;
  addComment: (reportId: string, comment: string, name: string, sabun: string) => Promise<void>;
  updateReport: (reportId: string, description: string, location: string, name: string, sabun: string) => Promise<void>;
  deleteReport: (reportId: string, name: string, sabun: string) => Promise<void>;
  updateComment: (reportId: string, commentId: string, comment: string, name: string, sabun: string) => Promise<void>;
  deleteComment: (reportId: string, commentId: string, name: string, sabun: string) => Promise<void>;
  toggleLike: (reportId: string, name: string, sabun: string) => Promise<void>;
}

export const useHazardStore = create<HazardState>()((set, get) => ({
  reports: [],
  comments: {},
  loadingReports: false,
  loadingComments: false,

  fetchReports: async (currentSabun?: string) => {
    if (!supabase) return;
    set({ loadingReports: true });
    const { data, error } = await supabase
      .from('hazard_reports')
      .select('id, photo_url, description, location, created_by, created_at, hazard_comments(count), hazard_likes(count)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // 현재 사용자의 좋아요 목록 조회
      let likedReportIds: Set<string> = new Set();
      if (currentSabun) {
        const { data: likes } = await supabase
          .from('hazard_likes')
          .select('report_id')
          .eq('user_sabun', currentSabun);
        if (likes) {
          likedReportIds = new Set(likes.map((l: { report_id: string }) => l.report_id));
        }
      }

      set({
        reports: (data as DbReport[]).map((r) => ({
          id: r.id,
          photoUrl: r.photo_url,
          description: r.description,
          location: r.location || '',
          createdBy: r.created_by,
          createdAt: r.created_at,
          commentCount: r.hazard_comments?.[0]?.count ?? 0,
          likeCount: r.hazard_likes?.[0]?.count ?? 0,
          likedByMe: likedReportIds.has(r.id),
        })),
      });
    }
    set({ loadingReports: false });
  },

  createReport: async ({ photo, description, location, name, sabun }) => {
    const formData = new FormData();
    formData.append('photo', photo);
    formData.append('description', description);
    formData.append('location', location);
    formData.append('name', name);
    formData.append('sabun', sabun);

    const res = await fetch('/api/safety/hazards', { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const e = err as { message?: string; detail?: string; code?: string };
      throw new Error(`${e.message || '등록에 실패했습니다'}${e.detail ? ` (${e.detail})` : ''}${e.code ? ` [${e.code}]` : ''}`);
    }
    await get().fetchReports();
  },

  fetchComments: async (reportId: string) => {
    if (!supabase) return;
    set({ loadingComments: true });
    const { data, error } = await supabase
      .from('hazard_comments')
      .select('id, report_id, comment, created_by, created_at')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      set((state) => ({
        comments: {
          ...state.comments,
          [reportId]: (data as DbComment[]).map((c) => ({
            id: c.id,
            reportId: c.report_id,
            comment: c.comment,
            createdBy: c.created_by,
            createdAt: c.created_at,
          })),
        },
      }));
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

  updateReport: async (reportId, description, location, name, sabun) => {
    const res = await fetch(`/api/safety/hazards/${reportId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, location, name, sabun }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || '수정에 실패했습니다');
    }

    // 로컬 상태 즉시 업데이트
    set((state) => ({
      reports: state.reports.map((r) =>
        r.id === reportId ? { ...r, description, location } : r,
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
