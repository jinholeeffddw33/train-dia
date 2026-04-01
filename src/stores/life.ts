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

/** 카테고리별 샘플 게시글 */
const SAMPLE_POSTS: Record<LifeCategory, LifePost[]> = {
  healing: [
    { id: 'sample-h1', category: 'healing', title: '🌿 퇴근 후 한강 산책 코스 추천', content: '답십리역에서 왕십리역 방향으로 중랑천 따라 걸으면 30분 힐링 코스!\n\n추천 코스:\n1. 답십리역 → 중랑천 산책로 → 살곶이다리\n2. 소요시간: 약 30~40분\n3. 야경이 특히 좋아요\n\n야간근무 전 가볍게 걷고 오면 컨디션이 달라집니다.', createdBy: '관리자', createdAt: '2026-04-01T09:00:00+09:00', likeCount: 5, commentCount: 2, likedByMe: false },
    { id: 'sample-h2', category: 'healing', title: '☕ 사업소 근처 카페 BEST 3', content: '출퇴근길에 들르기 좋은 카페를 소개합니다.\n\n1. ○○커피 (답십리역 2번 출구) - 아메리카노 맛집\n2. △△카페 (도보 5분) - 디저트가 맛있음\n3. □□베이커리 (역 앞) - 빵이 갓 나옴\n\n여러분의 숨은 맛집도 공유해주세요!', createdBy: '관리자', createdAt: '2026-04-01T08:00:00+09:00', likeCount: 8, commentCount: 3, likedByMe: false },
  ],
  hobby: [
    { id: 'sample-b1', category: 'hobby', title: '🏍️ 주말 라이딩 동호회 모집', content: '5호선 기관사 라이딩 동호회를 만들어봅니다!\n\n활동 계획:\n- 격주 일요일 오전 반나절 투어\n- 수도권 근교 코스 (양평, 가평, 춘천 등)\n- 초보자도 환영\n\n관심 있으신 분은 댓글 남겨주세요.\n안전장비 필수!', createdBy: '관리자', createdAt: '2026-04-01T09:00:00+09:00', likeCount: 12, commentCount: 5, likedByMe: false },
    { id: 'sample-b2', category: 'hobby', title: '📸 출퇴근길 사진 공유해요', content: '매일 같은 길이지만 계절마다 다른 풍경이 있잖아요.\n\n오늘 출근길 일출이 너무 예뻐서 한 장 찍었습니다.\n여러분도 출퇴근길 사진 공유해주세요!\n\n#출퇴근 #일상 #풍경', createdBy: '관리자', createdAt: '2026-04-01T08:00:00+09:00', likeCount: 6, commentCount: 1, likedByMe: false },
  ],
  growth: [
    { id: 'sample-g1', category: 'growth', title: '📚 기관사 자격증 취득 후기', content: '작년에 철도안전법 관련 자격증을 취득했습니다.\n\n공부 방법:\n1. 기출문제 3회독 (가장 중요!)\n2. 오답노트 작성\n3. 스마트승무원 앱 퀴즈 활용\n4. 동료와 스터디 (야간 대기시간 활용)\n\n소요 기간: 약 2개월\n합격률: 80% 이상 (성실히 하면 충분)', createdBy: '관리자', createdAt: '2026-04-01T09:00:00+09:00', likeCount: 15, commentCount: 7, likedByMe: false },
    { id: 'sample-g2', category: 'growth', title: '💡 업무 효율 높이는 나만의 팁', content: '10년차 기관사의 업무 팁을 공유합니다.\n\n1. 교번표는 항상 사진 찍어두기\n2. 행로 약어 외우기 (DIA 앱 활용)\n3. 이례상황 대응 매뉴얼 수시 복습\n4. 체력 관리가 곧 안전 관리\n\n여러분의 노하우도 공유해주세요!', createdBy: '관리자', createdAt: '2026-04-01T08:00:00+09:00', likeCount: 10, commentCount: 4, likedByMe: false },
  ],
  lounge: [
    { id: 'sample-l1', category: 'lounge', title: '🍖 점심 메뉴 추천 받습니다', content: '오늘 뭐 먹을지 고민이네요...\n\n후보:\n1. 제육볶음 (안전지수 200% 상승)\n2. 김치찌개 (영혼의 음식)\n3. 돈까스 (기분 전환)\n\n여러분의 오늘 점심은 뭔가요? 🤔', createdBy: '관리자', createdAt: '2026-04-01T09:00:00+09:00', likeCount: 20, commentCount: 12, likedByMe: false },
    { id: 'sample-l2', category: 'lounge', title: '😂 오늘의 웃긴 에피소드', content: '오늘 교대하러 가는데 동료가 인사를...\n\n"수고하셨습니다" 대신 "사랑합니다" 라고 함 ㅋㅋㅋ\n\n피곤하면 이런 일도 생기죠?\n여러분의 웃긴 에피소드도 공유해주세요!', createdBy: '관리자', createdAt: '2026-04-01T08:00:00+09:00', likeCount: 25, commentCount: 8, likedByMe: false },
  ],
};

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
        const data = json.data ?? [];
        // API 데이터가 있으면 사용, 없으면 샘플 표시
        set({ posts: data.length > 0 ? data : SAMPLE_POSTS[category] ?? [] });
      } else {
        // API 실패 시 샘플 표시
        set({ posts: SAMPLE_POSTS[category] ?? [] });
      }
    } catch {
      set({ posts: SAMPLE_POSTS[category] ?? [] });
    }
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
