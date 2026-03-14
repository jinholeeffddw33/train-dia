import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ExchangePost {
  id: string;
  /** 게시글 타입: direct=1:1 요청, open=전체 공지 */
  type: 'direct' | 'open';
  /** 요청자 ID (Person.I) */
  requesterId: string;
  /** 요청자 이름 */
  requesterName: string;
  /** 대상자 ID — direct일 때만 */
  targetId: string;
  /** 대상자 이름 — direct일 때만 */
  targetName: string;
  /** 교체 날짜들 (ISO date strings) */
  dates: string[];
  /** 요청자의 해당 날짜 교번 */
  requesterDias: Record<string, string>;
  /** 대상자의 해당 날짜 교번 — direct일 때만 */
  targetDias: Record<string, string>;
  /** 메모 */
  memo: string;
  /** 상태 */
  status: 'pending' | 'accepted' | 'declined';
  /** 거절 사유 (선택) */
  declineReason?: string;
  /** 생성 시간 */
  createdAt: string;
  /** open 공지에 응답한 사람들 */
  volunteers: Array<{ id: string; name: string }>;
  /** open 공지에서 최종 수락된 사람 */
  acceptedVolunteerId?: string;
}

interface ExchangeStore {
  posts: ExchangePost[];
  addPost: (post: Omit<ExchangePost, 'id' | 'status' | 'createdAt' | 'volunteers' | 'acceptedVolunteerId'>) => void;
  /** 1:1 수락 */
  accept: (id: string) => void;
  /** 1:1 거절 (사유 선택) */
  decline: (id: string, reason?: string) => void;
  /** 삭제 */
  remove: (id: string) => void;
  /** open 공지에 지원 */
  volunteer: (postId: string, personId: string, personName: string) => void;
  /** open 공지 지원자 수락 */
  acceptVolunteer: (postId: string, volunteerId: string) => void;
  /** 특정 기관사에게 온 대기 요청 수 (direct만) */
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
          volunteers: [],
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

      decline: (id, reason) => {
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === id ? { ...p, status: 'declined' as const, declineReason: reason } : p,
          ),
        }));
      },

      remove: (id) => {
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));
      },

      volunteer: (postId, personId, personName) => {
        set((s) => ({
          posts: s.posts.map((p) => {
            if (p.id !== postId) return p;
            if (p.volunteers.some((v) => v.id === personId)) return p;
            return { ...p, volunteers: [...p.volunteers, { id: personId, name: personName }] };
          }),
        }));
      },

      acceptVolunteer: (postId, volunteerId) => {
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId
              ? { ...p, status: 'accepted' as const, acceptedVolunteerId: volunteerId }
              : p,
          ),
        }));
      },

      pendingCountFor: (personId) => {
        return get().posts.filter(
          (p) => p.type === 'direct' && p.targetId === personId && p.status === 'pending',
        ).length;
      },
    }),
    {
      name: 'exchange-posts',
      partialize: (state) => ({ posts: state.posts }),
    },
  ),
);
