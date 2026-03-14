import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ExchangePost {
  id: string;
  /** 요청자 ID (Person.I) */
  requesterId: string;
  /** 요청자 이름 */
  requesterName: string;
  /** 대상자 ID (Person.I) */
  targetId: string;
  /** 대상자 이름 */
  targetName: string;
  /** 교체 날짜들 (ISO date strings) */
  dates: string[];
  /** 요청자의 해당 날짜 교번 */
  requesterDias: Record<string, string>;
  /** 대상자의 해당 날짜 교번 */
  targetDias: Record<string, string>;
  /** 메모 */
  memo: string;
  /** 상태 */
  status: 'pending' | 'accepted' | 'declined';
  /** 생성 시간 */
  createdAt: string;
}

interface ExchangeStore {
  posts: ExchangePost[];
  /** 게시글 추가 */
  addPost: (post: Omit<ExchangePost, 'id' | 'status' | 'createdAt'>) => void;
  /** 수락 */
  accept: (id: string) => void;
  /** 거절 */
  decline: (id: string) => void;
  /** 삭제 (본인 게시글만) */
  remove: (id: string) => void;
  /** 특정 기관사에게 온 대기 요청 수 */
  pendingCountFor: (personId: string) => number;
}

let counter = Date.now();

export const useExchangeStore = create<ExchangeStore>()(
  persist(
    (set, get) => ({
      posts: [],

      addPost: (data) => {
        const post: ExchangePost = {
          ...data,
          id: String(counter++),
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ posts: [post, ...s.posts] }));
      },

      accept: (id) => {
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === id ? { ...p, status: 'accepted' as const } : p,
          ),
        }));
      },

      decline: (id) => {
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === id ? { ...p, status: 'declined' as const } : p,
          ),
        }));
      },

      remove: (id) => {
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
      },

      pendingCountFor: (personId) => {
        return get().posts.filter(
          (p) => p.targetId === personId && p.status === 'pending',
        ).length;
      },
    }),
    {
      name: 'exchange-posts',
      partialize: (state) => ({ posts: state.posts }),
    },
  ),
);
