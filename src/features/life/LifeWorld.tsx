'use client';

import { useState, useEffect, useRef, useCallback, Component, lazy, Suspense, type ReactNode } from 'react';
import { ArrowLeft, Heart, Target, BookOpen, MessageCircle, Plus, ChevronRight, ArrowUp, ImagePlus, Link2, X, Gamepad2, Zap, Bug } from 'lucide-react';

const ReactionTest = lazy(() => import('./games/ReactionTest'));
const SnakeGame = lazy(() => import('./games/SnakeGame'));
import { useHistoryBack } from '@/hooks/useHistoryBack';
import { useDriverStore } from '@/stores/driver';
import { useLifeStore, type LifeCategory, type LifePost } from '@/stores/life';
import styles from './styles/Life.module.css';

class LifeErrorBoundary extends Component<{ children: ReactNode; onBack: () => void }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; onBack: () => void }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.wrap}>
          <div className={styles.emptyWrap}>
            <span className={styles.emptyIcon}>⚠️</span>
            <span className={styles.emptyText}>화면을 불러올 수 없어요</span>
            <button type="button" className={styles.addBtn} onClick={this.props.onBack}>돌아가기</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const CATEGORIES: { id: LifeCategory; label: string; icon: typeof Heart; color: string; desc: string; longDesc: string }[] = [
  { id: 'healing', label: '힐링', icon: Heart, color: 'rose', desc: '마음과 몸의 쉼표', longDesc: '산책, 명상, 좋은 음악 — 하루의 긴장을 풀어주는 공간' },
  { id: 'hobby', label: '취미', icon: Target, color: 'green', desc: '오늘 뭐 하지?', longDesc: '라이딩, 사진, 운동, 여행 — 취미를 공유하고 동호회를 만들어보세요' },
  { id: 'growth', label: '성장', icon: BookOpen, color: 'blue', desc: '내일의 나를 위한 투자', longDesc: '자격증, 공부법, 업무 노하우 — 함께 성장하는 기관사 커뮤니티' },
  { id: 'lounge', label: '라운지', icon: MessageCircle, color: 'purple', desc: '우리끼리 편하게', longDesc: '잡담, 맛집, 웃긴 이야기 — 편하게 소통하는 우리만의 공간' },
];

const ICON_BG: Record<string, string> = {
  rose: styles.iconBgRose,
  green: styles.iconBgGreen,
  blue: styles.iconBgBlue,
  purple: styles.iconBgPurple,
};

const ICON_COLOR: Record<string, string> = {
  rose: styles.iconRose,
  green: styles.iconGreen,
  blue: styles.iconBlue,
  purple: styles.iconPurple,
};

type GameId = 'reaction' | 'snake';
type View = 'home' | 'games' | { type: 'game'; gameId: GameId } | { type: 'list'; category: LifeCategory } | { type: 'detail'; category: LifeCategory; postId: string } | { type: 'write'; category: LifeCategory };

const GAMES: { id: GameId; label: string; icon: typeof Zap; color: string; desc: string }[] = [
  { id: 'reaction', label: '반응속도 테스트', icon: Zap, color: 'amber', desc: '초록색이 되면 터치! 얼마나 빠른지 측정' },
  { id: 'snake', label: '사과 먹기', icon: Bug, color: 'green', desc: '사과를 먹고 장애물을 피하세요!' },
];

/** localStorage에서 카테고리별 마지막 방문 시간 가져오기 */
function getLastVisit(cat: LifeCategory): string {
  try { return localStorage.getItem(`life-last-visit-${cat}`) ?? ''; } catch { return ''; }
}
/** 카테고리 방문 시 현재 시간 저장 */
function markVisited(cat: LifeCategory) {
  try { localStorage.setItem(`life-last-visit-${cat}`, new Date().toISOString()); } catch { /* ignore */ }
}

export default function LifeWorld({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>('home');
  const name = useDriverStore((s) => s.myDriver?.n ?? '');
  const sabun = useDriverStore((s) => s.myDriver?.s ?? '');
  const [newCounts, setNewCounts] = useState<Record<string, number>>({});

  // 카테고리별 새 글 수 가져오기
  const fetchNewCounts = useCallback(() => {
    const params = new URLSearchParams();
    for (const cat of CATEGORIES) {
      const lv = getLastVisit(cat.id);
      if (lv) params.set(cat.id, lv);
    }
    const qs = params.toString();
    fetch(`/api/life/posts/counts${qs ? `?${qs}` : ''}`)
      .then((r) => r.ok ? r.json() : { data: {} })
      .then((json) => setNewCounts(json.data || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (view === 'home') fetchNewCounts();
  }, [view, fetchNewCounts]);

  // 뒤로가기: Level 1 — 비-홈 뷰에서 홈으로
  const goLifeHome = useCallback(() => setView('home'), []);
  useHistoryBack('life-l1', goLifeHome, view !== 'home');

  // 뒤로가기: Level 2 — game→games, detail/write→list
  const isDepth2 = typeof view === 'object' && (view.type === 'game' || view.type === 'detail' || view.type === 'write');
  const goToParent2 = useCallback(() => {
    if (typeof view === 'object' && view.type === 'game') setView('games');
    else if (typeof view === 'object' && (view.type === 'detail' || view.type === 'write')) {
      setView({ type: 'list', category: view.category });
    }
  }, [view]);
  useHistoryBack('life-l2', goToParent2, isDepth2);

  // 카테고리 진입 시 방문 기록 + 배지 초기화
  const handleCategoryClick = useCallback((catId: LifeCategory) => {
    markVisited(catId);
    setNewCounts((prev) => ({ ...prev, [catId]: 0 }));
    setView({ type: 'list', category: catId });
  }, []);

  // ── 홈 화면 ──
  if (view === 'home') {
    return (
      <div className={styles.wrap}>
        <div className={styles.heroBanner}>
          <button type="button" className={styles.heroBackBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <div className={styles.heroHaze} />

          {/* 타이틀 — 자연스러운 힐링 느낌 */}
          <p className={styles.heroDesc}>기관사를 위한</p>
          <h1 className={styles.heroTitle}>라이프 공간</h1>
          <p className={styles.heroSub}>건강 · 힐링 · 즐거움</p>

          {/* 새싹 심볼 */}
          <div className={styles.heroVisual}>
            <svg viewBox="0 0 120 100" className={styles.lifeSvg} fill="none">
              {/* 잎사귀 좌 */}
              <path d="M60 45C52 32 36 26 30 32c-4 4 2 14 14 16 5 1 12-1 16-3" fill="url(#lfL)" stroke="#22c55e" strokeWidth="1.2" />
              {/* 잎사귀 우 */}
              <path d="M60 40C68 27 84 21 90 27c4 4-2 14-14 16-5 1-12-1-16-3" fill="url(#lfR)" stroke="#16a34a" strokeWidth="1.2" />
              {/* 줄기 */}
              <path d="M60 42V78" stroke="url(#lfS)" strokeWidth="2.5" strokeLinecap="round" />
              {/* 흙 */}
              <ellipse cx="60" cy="82" rx="20" ry="4" fill="#92400e" opacity="0.12" />
              {/* 반짝임 */}
              <circle cx="42" cy="28" r="2" fill="#fbbf24" opacity="0.6" />
              <circle cx="82" cy="22" r="1.5" fill="#fde68a" opacity="0.5" />
              <circle cx="72" cy="16" r="1.8" fill="#fbbf24" opacity="0.4" />
              <defs>
                <linearGradient id="lfL" x1="30" y1="26" x2="60" y2="50" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#4ade80" /><stop offset="1" stopColor="#22c55e" />
                </linearGradient>
                <linearGradient id="lfR" x1="90" y1="21" x2="60" y2="45" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#86efac" /><stop offset="1" stopColor="#16a34a" />
                </linearGradient>
                <linearGradient id="lfS" x1="60" y1="42" x2="60" y2="78" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#22c55e" /><stop offset="1" stopColor="#86efac" stopOpacity="0.4" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className={styles.heroFade} />
        </div>

        <div className={styles.menuContent}>
          <div className={styles.menuGrid}>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const badgeCount = newCounts[cat.id] ?? 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => handleCategoryClick(cat.id)}
                >
                  <div className={`${styles.menuIcon} ${ICON_BG[cat.color]}`}>
                    <Icon size={26} className={ICON_COLOR[cat.color]} />
                    {badgeCount > 0 && (
                      <span className={styles.menuBadge}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <span className={styles.menuLabel}>{cat.label}</span>
                  <span className={styles.menuDesc}>{cat.desc}</span>
                </button>
              );
            })}
          </div>

          {/* 게임 진입 버튼 */}
          <button
            type="button"
            className={styles.gameEntryBtn}
            onClick={() => setView('games')}
          >
            <div className={styles.gameEntryIcon}>
              <Gamepad2 size={22} />
            </div>
            <div className={styles.gameEntryText}>
              <span className={styles.gameEntryLabel}>미니 게임</span>
              <span className={styles.gameEntryDesc}>쉬는 시간에 가볍게 한 판</span>
            </div>
            <ChevronRight size={18} className={styles.gameEntryArrow} />
          </button>
        </div>
      </div>
    );
  }

  // ── 게임 목록 ──
  if (view === 'games') {
    return (
      <div className={styles.wrap}>
        <div className={styles.lifeHeader}>
          <button type="button" className={styles.backBtn} onClick={() => setView('home')} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <h2 className={styles.headerTitle}>미니 게임</h2>
        </div>
        <div className={styles.menuContent}>
          {GAMES.map((g) => {
            const Icon = g.icon;
            return (
              <button
                key={g.id}
                type="button"
                className={styles.gameCard}
                onClick={() => setView({ type: 'game', gameId: g.id })}
              >
                <div className={`${styles.gameCardIcon} ${g.color === 'amber' ? styles.iconBgAmber : styles.iconBgGreen}`}>
                  <Icon size={24} />
                </div>
                <div className={styles.gameCardText}>
                  <span className={styles.gameCardLabel}>{g.label}</span>
                  <span className={styles.gameCardDesc}>{g.desc}</span>
                </div>
                <ChevronRight size={18} className={styles.gameEntryArrow} />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── 게임 플레이 ──
  if (typeof view === 'object' && view.type === 'game') {
    const goBack = () => setView('games');
    return (
      <Suspense fallback={<div className={styles.wrap}><div className={styles.emptyWrap}><span className={styles.emptyText}>로딩 중...</span></div></div>}>
        {view.gameId === 'reaction' && <ReactionTest onBack={goBack} />}
        {view.gameId === 'snake' && <SnakeGame onBack={goBack} />}
      </Suspense>
    );
  }

  // ── 글쓰기 화면 ──
  if (typeof view === 'object' && view.type === 'write') {
    return (
      <WriteView
        category={view.category}
        name={name}
        sabun={sabun}
        onBack={() => setView({ type: 'list', category: view.category })}
      />
    );
  }

  // ── 상세 화면 ──
  if (typeof view === 'object' && view.type === 'detail') {
    return (
      <LifeErrorBoundary onBack={() => setView({ type: 'list', category: view.category })}>
        <DetailView
          postId={view.postId}
          name={name}
          sabun={sabun}
          onBack={() => setView({ type: 'list', category: view.category })}
        />
      </LifeErrorBoundary>
    );
  }

  // ── 리스트 화면 ──
  if (typeof view === 'object' && view.type === 'list') {
    const cat = CATEGORIES.find((c) => c.id === view.category)!;
    return (
      <ListView
        category={view.category}
        label={cat.label}
        name={name}
        sabun={sabun}
        onBack={() => setView('home')}
        onSelect={(id) => setView({ type: 'detail', category: view.category, postId: id })}
        onWrite={() => setView({ type: 'write', category: view.category })}
      />
    );
  }

  return null;
}

// ── 리스트 뷰 ──
function ListView({ category, label, name, sabun, onBack, onSelect, onWrite }: {
  category: LifeCategory; label: string; name: string; sabun: string;
  onBack: () => void; onSelect: (id: string) => void; onWrite: () => void;
}) {
  const posts = useLifeStore((s) => s.posts);
  const loading = useLifeStore((s) => s.loading);
  const fetchPosts = useLifeStore((s) => s.fetchPosts);
  const cat = CATEGORIES.find((c) => c.id === category);

  useEffect(() => { fetchPosts(category); }, [fetchPosts, category]);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="뒤로">
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className={styles.headerTitle}>{label}</h1>
        <button type="button" className={styles.addBtn} onClick={onWrite}>
          + 글쓰기
        </button>
      </header>
      {/* 카테고리 설명 */}
      {cat && (
        <div className={styles.catDesc}>
          <span>{cat.longDesc}</span>
        </div>
      )}
      <main className={styles.content}>
        {loading ? (
          <div className={styles.emptyWrap}>
            <span className={styles.emptyText}>불러오는 중...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className={styles.emptyWrap}>
            <span className={styles.emptyIcon}>✏️</span>
            <span className={styles.emptyText}>아직 글이 없어요</span>
            <span className={styles.emptyHint}>첫 글을 작성해보세요</span>
          </div>
        ) : (
          <div className={styles.postList}>
            {posts.map((post) => (
              <button
                key={post.id}
                type="button"
                className={`${styles.postCard} ${''}`}
                onClick={() => onSelect(post.id)}
              >
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" className={styles.postImage} loading="lazy" />
                )}
                <div className={styles.postContent}>
                  <div className={styles.postTop}>
                    <span className={styles.postAuthor}>{post.createdBy}</span>

                    <span className={styles.postDate}>{formatDate(post.createdAt)}</span>
                  </div>
                  <div className={styles.postTitle}>{post.title}</div>
                  <div className={styles.postBody}>{post.content.substring(0, 80)}{post.content.length > 80 ? '...' : ''}</div>
                  <div className={styles.postMeta}>
                    <span>❤️ {post.likeCount}</span>
                    <span>💬 {post.commentCount}</span>
                    <span>📖 {post.readCount ?? 0}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── 상세 뷰 (fetch 직접 호출 — 스토어 의존 최소) ──
function DetailView({ postId, name, sabun, onBack }: {
  postId: string; name: string; sabun: string; onBack: () => void;
}) {
  const post = useLifeStore((s) => s.posts.find((p) => p.id === postId) || null);
  const recordRead = useLifeStore((s) => s.recordRead);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cmts, setCmts] = useState<Array<{ id: string; comment: string; createdBy: string; createdAt: string }>>([]);
  const [likeCount, setLikeCount] = useState(post?.likeCount ?? 0);
  const [liked, setLiked] = useState(post?.likedByMe ?? false);

  // 조회수 증가
  useEffect(() => {
    recordRead(postId, sabun, name);
  }, [postId, sabun, name, recordRead]);

  // 댓글 로드
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/life/posts/${postId}/comments`)
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => { if (!cancelled) setCmts(json.data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [postId]);

  if (!post) {
    return (
      <div className={styles.wrap}>
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onBack}><ArrowLeft size={20} /></button>
          <h1 className={styles.headerTitle}>상세보기</h1>
        </header>
        <div className={styles.emptyWrap}><span className={styles.emptyText}>글을 찾을 수 없어요</span></div>
      </div>
    );
  }

  const hasImage = post.imageUrl && post.imageUrl.length > 1;
  const hasLink = post.linkUrl && post.linkUrl.length > 1;

  const handleLike = () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => nextLiked ? c + 1 : Math.max(0, c - 1));
    fetch(`/api/life/posts/${postId}/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sabun }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json) { setLikeCount(json.likeCount); setLiked(json.liked); } })
      .catch(() => {});
  };

  const handleComment = () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    fetch(`/api/life/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: commentText.trim(), name, sabun }),
    })
      .then((r) => r.ok ? fetch(`/api/life/posts/${postId}/comments`).then((r2) => r2.json()) : null)
      .then((json) => { if (json) setCmts(json.data || []); setCommentText(''); })
      .catch(() => {})
      .finally(() => setSubmitting(false));
  };

  const handleDelete = () => {
    fetch(`/api/life/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, sabun }),
    }).then(() => onBack()).catch(() => onBack());
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack}><ArrowLeft size={20} strokeWidth={2} /></button>
        <h1 className={styles.headerTitle}>상세보기</h1>
        {post.createdBy === name && (
          <button type="button" className={styles.deleteBtn} onClick={handleDelete}>삭제</button>
        )}
      </header>
      <main className={styles.content}>
        <div className={styles.detailCard}>
          <div className={styles.detailTop}>
            <span className={styles.postAuthor}>{post.createdBy}</span>
            <span className={styles.postDate}>{formatDate(post.createdAt)}</span>
          </div>
          <h2 className={styles.detailTitle}>{post.title}</h2>
          {hasImage && (
            <img src={post.imageUrl} alt="" className={styles.detailImage} loading="lazy" />
          )}
          <div className={styles.detailContent}>{post.content}</div>
          {hasLink && (
            <a href={post.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.detailLink}>
              🔗 {post.linkUrl}
            </a>
          )}
          <div className={styles.detailActions}>
            <button type="button" className={`${styles.likeBtn} ${liked ? styles.likeBtnActive : ''}`} onClick={handleLike}>
              {liked ? '❤️' : '🤍'} {likeCount}
            </button>
            <span className={styles.detailMeta}>💬 {cmts.length}</span>
            <span className={styles.detailMeta}>📖 {post.readCount ?? 0}명 읽음</span>
          </div>
        </div>

        <div className={styles.commentSection}>
          <h3 className={styles.commentTitle}>댓글 {cmts.length}</h3>
          {cmts.map((c) => (
            <div key={c.id} className={styles.commentItem}>
              <div className={styles.commentTop}>
                <span className={styles.commentAuthor}>{c.createdBy}</span>
                <span className={styles.commentDate}>{formatDate(c.createdAt)}</span>
              </div>
              <div className={styles.commentText}>{c.comment}</div>
            </div>
          ))}
        </div>

        <div className={styles.commentInput}>
          <input
            type="text"
            className={styles.commentField}
            placeholder="댓글을 입력하세요"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleComment(); }}
            maxLength={500}
          />
          <button type="button" className={styles.commentSendBtn} onClick={handleComment} disabled={!commentText.trim() || submitting}>
            <ArrowUp size={18} />
          </button>
        </div>
      </main>
    </div>
  );
}

// ── 글쓰기 뷰 ──
function WriteView({ category, name, sabun, onBack }: {
  category: LifeCategory; name: string; sabun: string; onBack: () => void;
}) {
  const createPost = useLifeStore((s) => s.createPost);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('사진 크기는 5MB 이하만 가능합니다');
      return;
    }
    setError('');
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return; }
    if (!content.trim()) { setError('내용을 입력해주세요'); return; }
    setSubmitting(true);
    setError('');
    try {
      let uploadedImageUrl = '';

      // 사진 있으면 먼저 업로드
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('name', name);
        formData.append('sabun', sabun);
        const uploadRes = await fetch('/api/life/upload', { method: 'POST', body: formData });
        if (uploadRes.ok) {
          const uploadJson = await uploadRes.json();
          uploadedImageUrl = uploadJson.url;
        } else {
          const errJson = await uploadRes.json().catch(() => ({}));
          throw new Error((errJson as { message?: string }).message || '사진 업로드에 실패했습니다');
        }
      }

      await createPost({
        category, title: title.trim(), content: content.trim(), name, sabun,
        imageUrl: uploadedImageUrl || undefined,
        linkUrl: linkUrl.trim() || undefined,
      });
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack}><ArrowLeft size={20} strokeWidth={2} /></button>
        <h1 className={styles.headerTitle}>글쓰기</h1>
        <button type="button" className={styles.addBtn} onClick={handleSubmit} disabled={submitting}>
          {submitting ? '등록 중...' : '등록'}
        </button>
      </header>
      <main className={styles.content}>
        <div className={styles.writeForm}>
          <input
            type="text"
            className={styles.writeTitle}
            placeholder="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            autoFocus
          />
          <textarea
            className={styles.writeContent}
            placeholder="내용을 작성하세요"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            maxLength={5000}
          />

          {/* 사진 미리보기 */}
          {imagePreview && (
            <div className={styles.imagePreviewWrap}>
              <img src={imagePreview} alt="미리보기" className={styles.imagePreview} />
              <button type="button" className={styles.imageRemoveBtn} onClick={() => { setImageFile(null); setImageUrl(''); if (imagePreview) URL.revokeObjectURL(imagePreview); setImagePreview(''); }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* 링크 입력 */}
          {showLinkInput && (
            <div className={styles.linkInputWrap}>
              <Link2 size={16} className={styles.linkIcon} />
              <input
                type="url"
                className={styles.linkInput}
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <button type="button" className={styles.linkRemoveBtn} onClick={() => { setLinkUrl(''); setShowLinkInput(false); }}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* 하단 도구 */}
          <div className={styles.writeToolbar}>
            <button type="button" className={styles.toolbarBtn} onClick={() => fileRef.current?.click()}>
              <ImagePlus size={20} /> <span>사진</span>
            </button>
            <button type="button" className={styles.toolbarBtn} onClick={() => setShowLinkInput(true)}>
              <Link2 size={20} /> <span>링크</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={handleImageSelect} />

          {error && <p className={styles.errorText}>{error}</p>}
          <p className={styles.writeInfo}>✏️ <strong>{name}</strong> 이름으로 등록됩니다</p>
        </div>
      </main>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T').replace(/\+00$/, '+00:00'));
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '방금';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
