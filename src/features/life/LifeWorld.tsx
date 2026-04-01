'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Target, BookOpen, MessageCircle, Plus, ChevronRight, ArrowUp } from 'lucide-react';
import { useDriverStore } from '@/stores/driver';
import { useAuthStore } from '@/stores/auth';
import { useLifeStore, type LifeCategory, type LifePost } from '@/stores/life';
import styles from './styles/Life.module.css';

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

type View = 'home' | { type: 'list'; category: LifeCategory } | { type: 'detail'; category: LifeCategory; postId: string } | { type: 'write'; category: LifeCategory };

export default function LifeWorld({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>('home');
  const driverName = useDriverStore((s) => s.myDriver?.n ?? '');
  const authName = useAuthStore((s) => s.user?.name ?? '');
  const driverSabun = useDriverStore((s) => s.myDriver?.s ?? '');
  const authSabun = useAuthStore((s) => s.user?.sabun ?? '');
  const name = authName || driverName;
  const sabun = authSabun || driverSabun;

  // ── 홈 화면 ──
  if (view === 'home') {
    return (
      <div className={styles.wrap}>
        <div className={styles.heroBanner}>
          <button type="button" className={styles.heroBackBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} strokeWidth={2} />
          </button>
          <div className={styles.heroHaze} />
          <h1 className={styles.heroTitle}>Life</h1>
          <p className={styles.heroSub}>SEOUL METRO · LINE 5</p>
          <p className={styles.heroDesc}>기관사를 위한 라이프 공간</p>

          <div className={styles.heroVisual}>
            <svg viewBox="0 0 200 200" className={styles.lifeSvg} fill="none">
              <circle cx="100" cy="100" r="90" stroke="url(#lifeRing)" strokeWidth="1" opacity="0.15" />
              <circle cx="100" cy="100" r="60" stroke="url(#lifeRing)" strokeWidth="1" opacity="0.1" />
              {/* 4개 카테고리 노드 */}
              <circle cx="100" cy="20" r="6" fill="#f43f5e" opacity="0.7" className={styles.lifeNode1} />
              <circle cx="180" cy="100" r="6" fill="#22c55e" opacity="0.7" className={styles.lifeNode2} />
              <circle cx="100" cy="180" r="6" fill="#3b82f6" opacity="0.7" className={styles.lifeNode3} />
              <circle cx="20" cy="100" r="6" fill="#8b5cf6" opacity="0.7" className={styles.lifeNode4} />
              {/* 연결선 */}
              <line x1="100" y1="26" x2="100" y2="94" stroke="#f43f5e" strokeWidth="0.8" opacity="0.15" />
              <line x1="174" y1="100" x2="106" y2="100" stroke="#22c55e" strokeWidth="0.8" opacity="0.15" />
              <line x1="100" y1="174" x2="100" y2="106" stroke="#3b82f6" strokeWidth="0.8" opacity="0.15" />
              <line x1="26" y1="100" x2="94" y2="100" stroke="#8b5cf6" strokeWidth="0.8" opacity="0.15" />
              {/* 중앙 */}
              <circle cx="100" cy="100" r="16" fill="url(#lifeCenter)" />
              <text x="100" y="105" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">L</text>
              <defs>
                <linearGradient id="lifeRing" x1="0" y1="0" x2="200" y2="200">
                  <stop stopColor="#f43f5e" />
                  <stop offset="0.5" stopColor="#8b5cf6" />
                  <stop offset="1" stopColor="#22c55e" />
                </linearGradient>
                <radialGradient id="lifeCenter" cx="0.5" cy="0.5" r="0.5">
                  <stop stopColor="#f43f5e" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </radialGradient>
              </defs>
            </svg>
          </div>
          <div className={styles.heroFade} />
        </div>

        <div className={styles.menuContent}>
          <div className={styles.menuGrid}>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => setView({ type: 'list', category: cat.id })}
                >
                  <div className={`${styles.menuIcon} ${ICON_BG[cat.color]}`}>
                    <Icon size={26} className={ICON_COLOR[cat.color]} />
                  </div>
                  <span className={styles.menuLabel}>{cat.label}</span>
                  <span className={styles.menuDesc}>{cat.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
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
      <DetailView
        postId={view.postId}
        name={name}
        sabun={sabun}
        onBack={() => setView({ type: 'list', category: view.category })}
      />
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
                className={`${styles.postCard} ${post.isSample ? styles.postCardSample : ''}`}
                onClick={() => onSelect(post.id)}
              >
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" className={styles.postImage} loading="lazy" />
                )}
                <div className={styles.postContent}>
                  <div className={styles.postTop}>
                    <span className={styles.postAuthor}>{post.createdBy}</span>
                    {post.isSample && <span className={styles.sampleBadge}>샘플</span>}
                    <span className={styles.postDate}>{formatDate(post.createdAt)}</span>
                  </div>
                  <div className={styles.postTitle}>{post.title}</div>
                  <div className={styles.postBody}>{post.content.substring(0, 80)}{post.content.length > 80 ? '...' : ''}</div>
                  <div className={styles.postMeta}>
                    <span>❤️ {post.likeCount}</span>
                    <span>💬 {post.commentCount}</span>
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

// ── 상세 뷰 ──
function DetailView({ postId, name, sabun, onBack }: {
  postId: string; name: string; sabun: string; onBack: () => void;
}) {
  const posts = useLifeStore((s) => s.posts);
  const post = posts.find((p) => p.id === postId);
  const comments = useLifeStore((s) => s.comments[postId] ?? []);
  const fetchComments = useLifeStore((s) => s.fetchComments);
  const addComment = useLifeStore((s) => s.addComment);
  const toggleLike = useLifeStore((s) => s.toggleLike);
  const deletePost = useLifeStore((s) => s.deletePost);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSample = postId.startsWith('sample-');
  useEffect(() => {
    if (!isSample) {
      try { fetchComments(postId); } catch { /* ignore */ }
    }
  }, [fetchComments, postId, isSample]);

  if (!post) return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack}><ArrowLeft size={20} /></button>
        <h1 className={styles.headerTitle}>상세보기</h1>
      </header>
      <div className={styles.emptyWrap}><span className={styles.emptyText}>글을 찾을 수 없어요</span></div>
    </div>
  );

  const isMyPost = !isSample && post.createdBy === name;

  const handleComment = async () => {
    if (isSample || !commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addComment(postId, commentText.trim(), name, sabun);
      setCommentText('');
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (isSample) return;
    try {
      await deletePost(postId, name, sabun);
      onBack();
    } catch { /* ignore */ }
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack}><ArrowLeft size={20} strokeWidth={2} /></button>
        <h1 className={styles.headerTitle}>상세보기</h1>
        {isMyPost && (
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
          {post.imageUrl && (
            <img src={post.imageUrl} alt="" className={styles.detailImage} loading="lazy" />
          )}
          <div className={styles.detailContent}>{post.content}</div>
          <button type="button" className={`${styles.likeBtn} ${post.likedByMe ? styles.likeBtnActive : ''}`} onClick={() => { if (!isSample) toggleLike(postId, name, sabun).catch(() => {}); }}>
            ❤️ {post.likeCount}
          </button>
        </div>

        {/* 댓글 */}
        <div className={styles.commentSection}>
          <h3 className={styles.commentTitle}>댓글 {comments.length}</h3>
          {comments.map((c) => (
            <div key={c.id} className={styles.commentItem}>
              <div className={styles.commentTop}>
                <span className={styles.commentAuthor}>{c.createdBy}</span>
                <span className={styles.commentDate}>{formatDate(c.createdAt)}</span>
              </div>
              <div className={styles.commentText}>{c.comment}</div>
            </div>
          ))}
        </div>

        {/* 댓글 입력 */}
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요'); return; }
    if (!content.trim()) { setError('내용을 입력해주세요'); return; }
    setSubmitting(true);
    setError('');
    try {
      await createPost({ category, title: title.trim(), content: content.trim(), name, sabun });
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
            rows={12}
            maxLength={5000}
          />
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
