import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

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

/** DB row → ExchangePost 변환 */
function rowToPost(row: Record<string, unknown>, volunteers: Array<{ person_id: string; person_name: string }> = []): ExchangePost {
  return {
    id: row.id as string,
    type: row.type as 'direct' | 'open',
    requesterId: row.requester_id as string,
    requesterName: row.requester_name as string,
    targetId: (row.target_id as string) || '',
    targetName: (row.target_name as string) || '',
    dates: row.dates as string[],
    requesterDias: (row.requester_dias as Record<string, string>) || {},
    targetDias: (row.target_dias as Record<string, string>) || {},
    memo: (row.memo as string) || '',
    status: row.status as 'pending' | 'accepted' | 'declined',
    declineReason: (row.decline_reason as string) || undefined,
    createdAt: row.created_at as string,
    volunteers: volunteers.map((v) => ({ id: v.person_id, name: v.person_name })),
    acceptedVolunteerId: (row.accepted_volunteer_id as string) || undefined,
  };
}

interface ExchangeStore {
  posts: ExchangePost[];
  loading: boolean;
  /** DB에서 게시글 전체 로드 */
  fetchPosts: () => Promise<void>;
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
  /** 실시간 구독 시작 */
  subscribe: () => () => void;
}

let counter = Date.now();

export const useExchangeStore = create<ExchangeStore>()(
  persist(
    (set, get) => ({
      posts: [],
      loading: false,

      fetchPosts: async () => {
        if (!supabase) return;
        set({ loading: true });
        try {
          // 게시글 로드
          const { data: rows, error } = await supabase
            .from('exchange_posts')
            .select('*')
            .order('created_at', { ascending: false });

          if (error) throw error;
          if (!rows || rows.length === 0) {
            set({ posts: [], loading: false });
            return;
          }

          // 지원자 로드
          const postIds = rows.map((r) => r.id);
          const { data: volRows } = await supabase
            .from('exchange_volunteers')
            .select('*')
            .in('post_id', postIds);

          // postId별 지원자 그룹핑
          const volMap = new Map<string, Array<{ person_id: string; person_name: string }>>();
          (volRows || []).forEach((v: Record<string, unknown>) => {
            const pid = v.post_id as string;
            if (!volMap.has(pid)) volMap.set(pid, []);
            volMap.get(pid)!.push({ person_id: v.person_id as string, person_name: v.person_name as string });
          });

          const posts = rows.map((r) => rowToPost(r, volMap.get(r.id) || []));
          set({ posts, loading: false });
        } catch {
          set({ loading: false });
        }
      },

      addPost: async (data) => {
        if (!supabase) {
          // localStorage 폴백
          const post: ExchangePost = {
            ...data,
            id: String(counter++),
            status: 'pending',
            createdAt: new Date().toISOString(),
            volunteers: [],
          };
          set((s) => ({ posts: [post, ...s.posts] }));
          return;
        }

        const { data: row, error } = await supabase
          .from('exchange_posts')
          .insert({
            type: data.type,
            requester_id: data.requesterId,
            requester_name: data.requesterName,
            target_id: data.targetId || null,
            target_name: data.targetName || null,
            dates: data.dates,
            requester_dias: data.requesterDias,
            target_dias: data.targetDias,
            memo: data.memo,
          })
          .select()
          .single();

        if (error || !row) return;
        const post = rowToPost(row);
        set((s) => ({ posts: [post, ...s.posts] }));
      },

      accept: async (id) => {
        // 낙관적 업데이트
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === id ? { ...p, status: 'accepted' as const } : p,
          ),
        }));

        if (supabase) {
          await supabase
            .from('exchange_posts')
            .update({ status: 'accepted' })
            .eq('id', id);
        }
      },

      decline: async (id, reason) => {
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === id ? { ...p, status: 'declined' as const, declineReason: reason } : p,
          ),
        }));

        if (supabase) {
          await supabase
            .from('exchange_posts')
            .update({ status: 'declined', decline_reason: reason || null })
            .eq('id', id);
        }
      },

      remove: async (id) => {
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }));

        if (supabase) {
          await supabase.from('exchange_posts').delete().eq('id', id);
        }
      },

      volunteer: async (postId, personId, personName) => {
        // 낙관적 업데이트
        set((s) => ({
          posts: s.posts.map((p) => {
            if (p.id !== postId) return p;
            if (p.volunteers.some((v) => v.id === personId)) return p;
            return { ...p, volunteers: [...p.volunteers, { id: personId, name: personName }] };
          }),
        }));

        if (supabase) {
          await supabase
            .from('exchange_volunteers')
            .insert({
              post_id: postId,
              person_id: personId,
              person_name: personName,
            });
        }
      },

      acceptVolunteer: async (postId, volunteerId) => {
        set((s) => ({
          posts: s.posts.map((p) =>
            p.id === postId
              ? { ...p, status: 'accepted' as const, acceptedVolunteerId: volunteerId }
              : p,
          ),
        }));

        if (supabase) {
          await supabase
            .from('exchange_posts')
            .update({ status: 'accepted', accepted_volunteer_id: volunteerId })
            .eq('id', postId);
        }
      },

      pendingCountFor: (personId) => {
        return get().posts.filter(
          (p) => p.type === 'direct' && p.targetId === personId && p.status === 'pending',
        ).length;
      },

      subscribe: () => {
        if (!supabase) return () => {};

        // exchange_posts 변경 구독
        const channel = supabase
          .channel('exchange-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'exchange_posts' },
            () => {
              // 변경 시 전체 리페치 (단순하고 안전)
              get().fetchPosts();
            },
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'exchange_volunteers' },
            () => {
              get().fetchPosts();
            },
          )
          .subscribe();

        return () => {
          supabase!.removeChannel(channel);
        };
      },
    }),
    {
      name: 'exchange-posts',
      partialize: (state) => ({ posts: state.posts }),
    },
  ),
);
