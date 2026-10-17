'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowUp, ChevronRight, OctagonAlert, DoorOpen, Zap, LifeBuoy, GitCompareArrows, History,
  type LucideIcon,
} from 'lucide-react';
import {
  MASTERBOOK_GROUPS, MASTERBOOK_TOPICS, MASTERBOOK_IMG_BASE, type MasterBookGroupId,
} from '../../lib/masterbook';
import s from './MasterBook.module.css';

interface MasterBookViewProps {
  onBack: () => void;
  onTopic: (id: string) => void;
  /** 예전 «전동차 비교 조치»(핸드북 ch5) */
  onLegacy: () => void;
}

export const MASTERBOOK_GROUP_ICON: Record<MasterBookGroupId, LucideIcon> = {
  brake: OctagonAlert,
  door: DoorOpen,
  power: Zap,
  etc: LifeBuoy,
  diff: GitCompareArrows,
};

/** 항목을 보고 돌아왔을 때 보던 자리로 — 화면이 스택에서 빠지며 언마운트되므로 모듈에 둔다.
 *  항목을 열 때만 기억한다(뒤로 나갔다 다시 들어오면 맨 위부터). */
let restoreY: number | null = null;

const pad2 = (n: number) => String(n).padStart(2, '0');

export default function MasterBookView({ onBack, onTopic, onLegacy }: MasterBookViewProps) {
  const headRef = useRef<HTMLDivElement>(null);
  const chipRowRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<MasterBookGroupId, HTMLElement | null>>>({});
  const [active, setActive] = useState<MasterBookGroupId>('brake');
  const [showTop, setShowTop] = useState(false);

  useLayoutEffect(() => {
    const y = restoreY;
    if (y === null) return;
    window.scrollTo(0, y);
    // 뒤로가기(popstate) 때 브라우저가 스크롤을 한 번 더 되돌려 놓을 수 있어 잠깐 뒤 다시 맞춘다.
    // 기억은 마지막에 지운다 — 개발 모드(StrictMode)는 effect 를 두 번 돌려 첫 회에 지우면 둘째가 빈손이 된다
    const t1 = window.setTimeout(() => window.scrollTo(0, y), 60);
    const t2 = window.setTimeout(() => { window.scrollTo(0, y); restoreY = null; }, 250);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, []);

  // 지금 보고 있는 묶음 칩 밝히기 + «맨 위로»
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setShowTop(window.scrollY > 600);
        const line = (headRef.current?.getBoundingClientRect().bottom ?? 0) + 24;
        let cur: MasterBookGroupId = 'brake';
        for (const g of MASTERBOOK_GROUPS) {
          const el = sectionRefs.current[g.id];
          if (el && el.getBoundingClientRect().top <= line) cur = g.id;
        }
        // 맨 아래에 닿으면 마지막 묶음
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
          cur = MASTERBOOK_GROUPS[MASTERBOOK_GROUPS.length - 1].id;
        }
        setActive(cur);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // 밝힌 칩이 칩 줄 밖이면 보이게 굴린다
  useEffect(() => {
    const row = chipRowRef.current;
    const chip = row?.querySelector<HTMLElement>(`[data-group="${active}"]`);
    if (!row || !chip) return;
    const l = chip.offsetLeft - row.offsetLeft;
    if (l < row.scrollLeft || l + chip.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: l - 16, behavior: 'smooth' });
    }
  }, [active]);

  const jump = useCallback((id: MasterBookGroupId) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    const headH = headRef.current?.getBoundingClientRect().height ?? 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headH - 12, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  const toTop = useCallback(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  const openTopic = (id: string) => {
    restoreY = window.scrollY;
    onTopic(id);
  };

  let num = 0;

  return (
    <div className={s.mbScreen}>
      <div ref={headRef} className={s.mbHead}>
        <div className={s.mbBar}>
          <button type="button" className={s.mbBackBtn} onClick={onBack} aria-label="뒤로가기">
            <ArrowLeft size={20} />
          </button>
          <div className={s.mbBarText}>
            <h1 className={s.mbBarTitle}>전동차 비교</h1>
            <span className={s.mbBarSub}>5호선 전동차 MASTER BOOK</span>
          </div>
        </div>
        <nav ref={chipRowRef} className={s.mbChipRow} aria-label="목차 바로가기">
          {MASTERBOOK_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              data-group={g.id}
              className={`${s.mbChip} ${active === g.id ? s.mbChipOn : ''}`}
              aria-current={active === g.id ? 'true' : undefined}
              onClick={() => jump(g.id)}
            >
              {g.short}
            </button>
          ))}
        </nav>
      </div>

      <div className={s.mbBody}>
        <section className={s.mbIntro} aria-label="자료 소개">
          <span className={s.mbIntroPill}><span className={s.mbIntroDot} aria-hidden="true" />MASTER BOOK</span>
          <h2 className={s.mbIntroTitle}>고장 났을 때, 차종별로 한눈에</h2>
          <p className={s.mbIntroDesc}>
            고장마다 세 차종의 조치를 한 장에 나란히 놓았어요. 그림을 누르면 크게 볼 수 있어요.
          </p>
          <div className={s.mbIntroCars} aria-label="비교 차종">
            <span className={s.mbCarBadge}>ABB</span>
            <span className={s.mbCarBadge}>우진</span>
            <span className={s.mbCarBadge}>로템</span>
          </div>
          <span className={s.mbIntroMeta}>답십리승무사업소 · 2026. 9.</span>
        </section>

        {MASTERBOOK_GROUPS.map((g) => {
          const Icon = MASTERBOOK_GROUP_ICON[g.id];
          const topics = MASTERBOOK_TOPICS.filter((t) => t.group === g.id);
          return (
            <section
              key={g.id}
              ref={(el) => { sectionRefs.current[g.id] = el; }}
              className={s.mbGroup}
              aria-labelledby={`mb-g-${g.id}`}
            >
              <div className={s.mbGroupHead}>
                <span className={s.mbGroupIcon} aria-hidden="true"><Icon size={22} /></span>
                <h2 id={`mb-g-${g.id}`} className={s.mbGroupTitle}>{g.title}</h2>
                <span className={s.mbGroupCount}>{topics.length}개</span>
              </div>

              {g.id === 'diff' ? (
                <div className={s.mbDiffGrid}>
                  {topics.map((t, i) => (
                    <button key={t.id} type="button" className={s.mbDiffTile} onClick={() => openTopic(t.id)}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- 정적 원본 그림 */}
                      <img
                        className={s.mbDiffThumb}
                        src={MASTERBOOK_IMG_BASE + t.images[0].src}
                        alt=""
                        width={t.images[0].w}
                        height={t.images[0].h}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className={s.mbDiffLabel}>
                        <span className={s.mbDiffNum}>{i + 1}</span>
                        {t.title}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={s.mbListCard}>
                  {topics.map((t) => {
                    num += 1;
                    return (
                      <button key={t.id} type="button" className={s.mbRow} onClick={() => openTopic(t.id)}>
                        <span className={s.mbRowNum}>{pad2(num)}</span>
                        <span className={s.mbRowText}>
                          <span className={s.mbRowTitle}>{t.title}</span>
                          <span className={s.mbRowMeta}>
                            {t.images.map((im) => im.label).join(' · ')}
                          </span>
                        </span>
                        <ChevronRight size={20} className={s.mbRowChevron} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        <button type="button" className={s.mbLegacy} onClick={onLegacy}>
          <History size={22} className={s.mbLegacyIcon} aria-hidden="true" />
          <span className={s.mbRowText}>
            <span className={s.mbRowTitle}>이전 비교 자료 보기</span>
            <span className={s.mbRowMeta}>차종별 주요 비교 · 출입문 · 역행·제동 · 구원운전 · TC</span>
          </span>
          <ChevronRight size={20} className={s.mbRowChevron} aria-hidden="true" />
        </button>

        <p className={s.mbSource}>
          출처: 5호선 전동차 MASTER BOOK (답십리승무사업소, 2026. 9. 10.)
          <br />
          주공기관 파열 조치는 «주공기관 파열 훈련»에서 익혀 주세요.
        </p>
      </div>

      {showTop && (
        <button type="button" className={s.mbTopBtn} onClick={toTop} aria-label="맨 위로">
          <ArrowUp size={22} />
        </button>
      )}
    </div>
  );
}
