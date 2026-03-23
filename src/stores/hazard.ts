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
  fetchReports: () => Promise<void>;
  createReport: (params: {
    photo: File;
    description: string;
    location: string;
    name: string;
    sabun: string;
  }) => Promise<void>;
  fetchComments: (reportId: string) => Promise<void>;
  addComment: (reportId: string, comment: string, name: string, sabun: string) => Promise<void>;
}

export const useHazardStore = create<HazardState>()((set, get) => ({
  reports: [],
  comments: {},
  loadingReports: false,
  loadingComments: false,

  fetchReports: async () => {
    if (!supabase) return;
    set({ loadingReports: true });
    const { data, error } = await supabase
      .from('hazard_reports')
      .select('id, photo_url, description, location, created_by, created_at, hazard_comments(count)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      set({
        reports: (data as DbReport[]).map((r) => ({
          id: r.id,
          photoUrl: r.photo_url,
          description: r.description,
          location: r.location || '',
          createdBy: r.created_by,
          createdAt: r.created_at,
          commentCount: r.hazard_comments?.[0]?.count ?? 0,
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
      throw new Error((err as { message?: string }).message || '등록에 실패했습니다');
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
}));
