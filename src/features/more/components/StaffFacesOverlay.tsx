'use client';

/**
 * 직원 얼굴 찾기 — 설정 › «직원 얼굴». 이름(또는 초성)을 넣으면 얼굴이 나온다.
 * 기관사 나침반 «선배 찾기»를 옮겨 온 것. 사진·명단 범위는 src/features/more/lib/staffFaces.ts.
 * 닫기: X · ESC · 뒤로가기(설정이 하위 화면 닫기로 처리한다).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Search, Lock, UserRound, Users, RotateCw } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { matchFace, type StaffFace, type StaffFacesResponse } from '../lib/staffFaces';
import styles from './StaffFacesOverlay.module.css';

export default function StaffFacesOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const modalRef = useModalA11y<HTMLDivElement>(open, onClose, { closeOnEscape: false });
  const [data, setData] = useState<StaffFacesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [big, setBig] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/staff-faces', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { message?: string }).message || '직원 얼굴을 불러올 수 없어요');
      setData(json as StaffFacesResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : '직원 얼굴을 불러올 수 없어요');
    } finally {
      setLoading(false);
    }
  }, []);

  // 사진 주소는 1시간짜리라 열 때마다 새로 받는다
  useEffect(() => {
    if (!open) return;
    setQ('');
    setShowAll(false);
    setBig(null);
    void load();
  }, [open, load]);

  const query = q.replace(/\s/g, '');
  const found = useMemo(() => {
    const people = data?.people ?? [];
    if (query) return people.filter((p) => matchFace(p.name, query));
    return showAll ? people : [];
  }, [data, query, showAll]);

  if (!open) return null;

  return (
    <div ref={modalRef} className={styles.overlay} role="dialog" aria-modal="true" aria-label="직원 얼굴 찾기">
      <div className={styles.header}>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
          <X size={22} />
        </button>
        <h2 className={styles.title}>직원 얼굴 찾기</h2>
        <span className={styles.lockChip}><Lock size={14} aria-hidden /> 직원만</span>
      </div>

      <div className={styles.body}>
        <div className={styles.searchBox}>
          <Search size={20} aria-hidden className={styles.searchIcon} />
          <label htmlFor="staff-face-q" className="srOnly">이름</label>
          <input
            id="staff-face-q"
            className={styles.searchInput}
            value={q}
            onChange={(e) => { setQ(e.target.value); setBig(null); }}
            placeholder="이름을 넣어요 (초성도 돼요 · ㄱㅅㅈ)"
            autoComplete="off"
            enterKeyHint="search"
          />
          {q && (
            <button type="button" className={styles.clearBtn} onClick={() => setQ('')} aria-label="지우기">
              <X size={18} />
            </button>
          )}
        </div>

        {data && (
          <p className={styles.countLine}>
            지금 명단 <strong>{data.people.length}</strong>명 · 사진 {data.withPhoto}명
          </p>
        )}

        {loading && !data ? (
          <div className={styles.state} role="status">
            <span className={styles.spinner} aria-hidden />
            <p>직원 얼굴을 불러오는 중…</p>
          </div>
        ) : error ? (
          <div className={styles.state}>
            <p>{error}</p>
            <button type="button" className={styles.retryBtn} onClick={() => void load()}>
              <RotateCw size={16} aria-hidden /> 다시 불러오기
            </button>
          </div>
        ) : !query && !showAll ? (
          <div className={styles.state}>
            <span className={styles.stateIcon}><Search size={28} aria-hidden /></span>
            <p className={styles.stateTitle}>이름을 넣으면 얼굴이 나와요</p>
            <p className={styles.stateSub}>오늘 함께 탈 직원, 처음 보는 직원의 이름을 넣어 보세요.</p>
            <button type="button" className={styles.allBtn} onClick={() => setShowAll(true)} disabled={!data}>
              <Users size={18} aria-hidden /> 전체 직원 보기 (가나다순)
            </button>
          </div>
        ) : found.length === 0 ? (
          <div className={styles.state}>
            <span className={styles.stateIcon}><Search size={28} aria-hidden /></span>
            <p className={styles.stateTitle}>찾는 이름이 없어요</p>
            <p className={styles.stateSub}>이름을 다시 확인하거나 초성으로 찾아봐요.</p>
          </div>
        ) : (
          <>
            {query && <p className={styles.countLine}><strong>{found.length}</strong>명</p>}
            <ul className={`${styles.faceGrid} ${found.length === 1 ? styles.faceGridOne : ''}`}>
              {found.map((p) => (
                <FaceCard
                  key={p.key}
                  p={p}
                  large={found.length === 1 || big === p.key}
                  wide={found.length > 1 && big === p.key}
                  onToggle={() => setBig(big === p.key ? null : p.key)}
                />
              ))}
            </ul>
          </>
        )}

        <p className={styles.footnote}>
          사업소 «직원현황사진»에서 사진과 이름만 옮겼어요(그 뒤 입사한 직원은 사업소 환영 사진). 지금 명단에 있는 직원만 보이고,
          사진은 로그인한 직원에게만 잠깐 보이는 주소로 나와요. 밖으로 돌리지 말아 주세요.
        </p>
      </div>
    </div>
  );
}

function FaceCard({ p, large, wide, onToggle }: { p: StaffFace; large: boolean; wide: boolean; onToggle: () => void }) {
  return (
    <li className={wide ? styles.faceWide : undefined}>
      <button
        type="button"
        className={`${styles.faceCard} ${large ? styles.faceCardLarge : ''}`}
        onClick={onToggle}
        aria-label={`${p.name} ${p.role} 얼굴 ${large ? '작게' : '크게'} 보기`}
      >
        {p.photos.length === 0 ? (
          <span className={styles.noPhoto}>
            <UserRound size={large ? 56 : 36} aria-hidden />
            <span>사진 없음</span>
          </span>
        ) : (
          <span className={p.photos.length > 1 ? styles.photoPair : undefined}>
            {p.photos.map((url, i) => (
              // 비공개 보관함의 서명 주소(1시간)라 Next 그림 다듬기를 거치지 않는다
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`${p.name} 얼굴${p.photos.length > 1 ? ` ${i + 1}` : ''}`}
                width={480} height={480} loading="lazy" decoding="async" className={styles.photo} />
            ))}
          </span>
        )}
        <span className={styles.faceText}>
          <span className={styles.faceName}>{p.name}</span>
          <span className={styles.faceRole}>{p.role}</span>
        </span>
        {p.same > 1 && <span className={styles.sameNote}>같은 이름 {p.same}명 — 사진이 누구인지 확인해 주세요</span>}
      </button>
    </li>
  );
}
