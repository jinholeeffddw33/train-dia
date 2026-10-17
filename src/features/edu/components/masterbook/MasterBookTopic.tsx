'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, Hand } from 'lucide-react';
import {
  MASTERBOOK_GROUPS, MASTERBOOK_TOPICS, MASTERBOOK_IMG_BASE, findMasterBookTopic, type MasterBookImage,
} from '../../lib/masterbook';
import ImageZoomViewer from './ImageZoomViewer';
import s from './MasterBook.module.css';

interface MasterBookTopicProps {
  topicId: string;
  onBack: () => void;
  /** 앞·뒤 항목으로 (스택을 쌓지 않고 바꿔 끼운다) */
  onNavigate: (id: string) => void;
}

/** 단계 칩은 360px 한 줄에 세 개가 들어가게 줄여 부른다 */
const chipLabel = (label: string) => label.replace('확인 및 보고', '확인·보고').replace('조합별 조치', '조합표');

function Figure({ img, title, eager, onZoom }: {
  img: MasterBookImage; title: string; eager: boolean; onZoom: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  return (
    <figure className={s.mbFig}>
      {failed ? (
        <div className={s.mbImgError} role="alert">
          그림을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.
          <button
            type="button"
            className={s.mbRetryBtn}
            onClick={() => { setFailed(false); setRetry((n) => n + 1); }}
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <button type="button" className={s.mbFigImgBtn} onClick={onZoom} aria-label={`${img.label} 크게 보기`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 정적 원본 그림(선명도 위해 원본 webp 그대로) */}
          <img
            key={retry}
            className={s.mbFigImg}
            src={MASTERBOOK_IMG_BASE + img.src}
            alt={`${title} — ${img.label}`}
            width={img.w}
            height={img.h}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailed(true)}
          />
          <span className={s.mbFigZoomBar} aria-hidden="true">
            <ZoomIn size={18} />
            크게 보기
          </span>
        </button>
      )}
    </figure>
  );
}

export default function MasterBookTopic({ topicId, onBack, onNavigate }: MasterBookTopicProps) {
  const topic = findMasterBookTopic(topicId) ?? MASTERBOOK_TOPICS[0];
  const group = MASTERBOOK_GROUPS.find((g) => g.id === topic.group)!;
  const order = MASTERBOOK_TOPICS.findIndex((t) => t.id === topic.id);
  const prev = order > 0 ? MASTERBOOK_TOPICS[order - 1] : null;
  const next = order < MASTERBOOK_TOPICS.length - 1 ? MASTERBOOK_TOPICS[order + 1] : null;
  const isDiff = topic.group === 'diff';

  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const figRefs = useRef<(HTMLDivElement | null)[]>([]);

  /** 단계 칩 — 해당 그림이 고정 머리 바로 아래 오게 */
  const jumpTo = useCallback((i: number) => {
    const el = figRefs.current[i];
    if (!el) return;
    const headH = headRef.current?.getBoundingClientRect().height ?? 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headH - 12, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

  // 항목마다 key 로 새로 그려진다(EduTab) — 목차에서 굴려 둔 자리 말고 맨 위부터
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={s.mbScreen}>
      <div ref={headRef} className={s.mbHead}>
        <div className={s.mbBar}>
          <button type="button" className={s.mbBackBtn} onClick={onBack} aria-label="목차로 돌아가기">
            <ArrowLeft size={20} />
          </button>
          <div className={s.mbBarText}>
            <h1 className={s.mbBarTitle}>{topic.title}</h1>
            <span className={s.mbBarSub}>
              {group.title} · 원본 {topic.bookPages.join('·')}쪽
            </span>
          </div>
        </div>
        {!isDiff && (
          <nav className={s.mbChipRow} aria-label="단계 바로가기">
            {topic.images.map((img, i) => (
              <button key={img.src} type="button" className={s.mbStepChip} onClick={() => jumpTo(i)}>
                <span className={s.mbStepChipNum} aria-hidden="true">{i + 1}</span>
                {chipLabel(img.label)}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className={s.mbBody}>
        <div className={s.mbFigList}>
          {topic.images.map((img, i) => (
            <div key={img.src} ref={(el) => { figRefs.current[i] = el; }}>
              <Figure img={img} title={topic.title} eager={i === 0} onZoom={() => setZoomIdx(i)} />
            </div>
          ))}
        </div>

        <p className={s.mbHint}>
          <Hand size={16} aria-hidden="true" />
          그림을 누르면 크게 보여요. 두 손가락으로 늘리거나 두 번 톡 누르세요.
        </p>

        {topic.link && (
          <button
            type="button"
            className={s.mbLinkBtn}
            onClick={() => window.open(topic.link, '_blank', 'noopener,noreferrer')}
          >
            관련 자료 열기
          </button>
        )}

        <nav className={s.mbPager} aria-label="앞뒤 항목">
          <button
            type="button"
            className={`${s.mbPagerBtn} ${s.mbPagerPrev}`}
            disabled={!prev}
            onClick={() => prev && onNavigate(prev.id)}
          >
            <span className={s.mbPagerDir}><ChevronLeft size={16} aria-hidden="true" />이전</span>
            <span className={s.mbPagerTitle}>{prev?.title ?? ''}</span>
          </button>
          <button
            type="button"
            className={`${s.mbPagerBtn} ${s.mbPagerNext}`}
            disabled={!next}
            onClick={() => next && onNavigate(next.id)}
          >
            <span className={s.mbPagerDir}>다음<ChevronRight size={16} aria-hidden="true" /></span>
            <span className={s.mbPagerTitle}>{next?.title ?? ''}</span>
          </button>
        </nav>
      </div>

      {zoomIdx !== null && (
        <ImageZoomViewer
          title={topic.title}
          images={topic.images}
          index={zoomIdx}
          onIndex={setZoomIdx}
          onClose={() => setZoomIdx(null)}
        />
      )}
    </div>
  );
}
