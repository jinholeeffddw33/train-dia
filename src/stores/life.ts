import { create } from 'zustand';

export type LifeCategory = 'healing' | 'hobby' | 'growth' | 'lounge';

export interface LifePost {
  id: string;
  category: LifeCategory;
  title: string;
  content: string;
  createdBy: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface LifeComment {
  id: string;
  postId: string;
  comment: string;
  createdBy: string;
  createdAt: string;
}

interface LifeState {
  posts: LifePost[];
  comments: Record<string, LifeComment[]>;
  loading: boolean;

  fetchPosts: (category: LifeCategory) => Promise<void>;
  createPost: (params: { category: LifeCategory; title: string; content: string; name: string; sabun: string }) => Promise<void>;
  deletePost: (postId: string, name: string, sabun: string) => Promise<void>;
  fetchComments: (postId: string) => Promise<void>;
  addComment: (postId: string, comment: string, name: string, sabun: string) => Promise<void>;
  toggleLike: (postId: string, name: string, sabun: string) => Promise<void>;
}

export const useLifeStore = create<LifeState>()((set, get) => ({
  posts: [],
  comments: {},
  loading: false,

  fetchPosts: async (category) => {
    set({ loading: true, posts: [] });
    try {
      const res = await fetch(`/api/life/posts?category=${category}`);
      if (res.ok) {
        const json = await res.json();
        set({ posts: json.data ?? [] });
      }
    } catch { /* ignore */ }
    set({ loading: false });
  },

  createPost: async ({ category, title, content, name, sabun }) => {
    const res = await fetch('/api/life/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, title, content, name, sabun }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || '등록에 실패했습니다');
    }
    await get().fetchPosts(category);
  },

  deletePost: async (postId, name, sabun) => {
    const res = await fetch(`/api/life/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sabun }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || '삭제에 실패했습니다');
    }
    set((s) => ({ posts: s.posts.filter((p) => p.id !== postId) }));
  },

  fetchComments: async (postId) => {
    try {
      const res = await fetch(`/api/life/posts/${postId}/comments`);
      if (res.ok) {
        const json = await res.json();
        set((s) => ({ comments: { ...s.comments, [postId]: json.data ?? [] } }));
      }
    } catch { /* ignore */ }
  },

  addComment: async (postId, comment, name, sabun) => {
    const res = await fetch(`/api/life/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment, name, sabun }),
    });
    if (res.ok) {
      await get().fetchComments(postId);
      set((s) => ({
        posts: s.posts.map((p) => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p),
      }));
    }
  },

  toggleLike: async (postId, name, sabun) => {
    const res = await fetch(`/api/life/posts/${postId}/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sabun }),
    });
    if (res.ok) {
      const json = await res.json();
      set((s) => ({
        posts: s.posts.map((p) => p.id === postId ? { ...p, likeCount: json.likeCount, likedByMe: json.liked } : p),
      }));
    }
  },
}));
