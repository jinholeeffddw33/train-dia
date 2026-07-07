'use client'

/**
 * APEX RUSH — 인게임 HUD
 * 점수/거리/속도는 부모가 ref 로 DOM 직접 갱신 (매 프레임 리렌더 0).
 * 콤보/플로팅/아이템 상태는 저빈도 state.
 */

import type { RefObject } from 'react'
import styles from '../styles/apex.module.css'

export interface FloatMsg {
  id: number
  text: string
  tone: 'lime' | 'sky' | 'amber' | 'gold' | 'white' | 'goldBig' | 'super'
}

export interface ItemHudState {
  /** 0~1 잔여 비율 (0 = 비활성). shield 도 잔여율 — 10초 제한 (진호 2026-07-07) */
  turbo: number
  magnet: number
  shield: number
  fever: number
  /** 🌈 슈퍼부스트 잔여율 (무적 관통 — 진호 2026-07-07) */
  super: number
}

interface ApexHUDProps {
  scoreRef: RefObject<HTMLSpanElement | null>
  distRef: RefObject<HTMLSpanElement | null>
  speedRef: RefObject<HTMLSpanElement | null>
  stage: number
  combo: number
  boosting: boolean
  items: ItemHudState
  floats: FloatMsg[]
  onExit: () => void
  muted: boolean
  onToggleMute: () => void
}

export function ApexHUD({ scoreRef, distRef, speedRef, stage, combo, boosting, items, floats, onExit, muted, onToggleMute }: ApexHUDProps) {
  const feverOn = items.fever > 0
  const superOn = items.super > 0
  return (
    <div className={styles.hud} aria-hidden={false}>
      {/* 부스트/피버/슈퍼부스트 비네트 — 슈퍼부스트(무적)가 최우선 강렬 */}
      <div
        className={`${styles.boostVignette} ${superOn ? styles.superVignetteOn : feverOn ? styles.feverVignetteOn : boosting ? styles.boostVignetteOn : ''}`}
        aria-hidden="true"
      />

      <div className={styles.hudTop}>
        <div className={styles.hudScoreBlock}>
          <span ref={scoreRef} className={styles.hudScore}>0</span>
          <span className={styles.hudDist}>
            <span className={styles.hudStage} key={stage}>STAGE {stage}</span>
            {' · '}
            <span ref={distRef}>0</span>m
          </span>
          <span className={styles.hudSpeed}>
            <span ref={speedRef}>0</span>
            <span className={styles.hudSpeedUnit}>km/h</span>
          </span>
        </div>
        <div className={styles.hudRight}>
          <button type="button" className={styles.hudExit} onClick={onExit} aria-label="게임 종료">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button type="button" className={styles.hudMute} onClick={onToggleMute} aria-label={muted ? '음악 켜기' : '음악 끄기'}>
            {muted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5 6 9H2v6h4l5 4z" />
                <line x1="22" y1="9" x2="16" y2="15" />
                <line x1="16" y1="9" x2="22" y2="15" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5 6 9H2v6h4l5 4z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M19.5 5a9 9 0 0 1 0 14" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 아이템 게이지 스택 — 화면 중앙 살짝 위 가운데 정렬 (진호 2026-07-07 "잘 보여야, 60% 더 크게").
          실드/터보/마그넷 전부 아이콘 + 잔여 바 한 줄씩. */}
      {(items.shield > 0 || items.turbo > 0 || items.magnet > 0) && (
        <div className={styles.itemCenterDock} aria-hidden="true">
          {items.shield > 0 && (
            <div className={styles.itemGauge}>
              <span className={styles.itemGaugeIcon}>🛡</span>
              <div className={styles.itemGaugeBar}>
                {/* STYLE-EXCEPTION: 런타임 잔여율 — CSS 변수 브릿지 */}
                <div className={`${styles.itemGaugeFill} ${styles.itemGaugeFillShield}`} style={{ '--pct': `${Math.round(items.shield * 100)}%` } as React.CSSProperties} />
              </div>
            </div>
          )}
          {items.turbo > 0 && (
            <div className={styles.itemGauge}>
              <span className={styles.itemGaugeIcon}>⚡</span>
              <div className={styles.itemGaugeBar}>
                {/* STYLE-EXCEPTION: 런타임 잔여율 — CSS 변수 브릿지 */}
                <div className={`${styles.itemGaugeFill} ${styles.itemGaugeFillTurbo}`} style={{ '--pct': `${Math.round(items.turbo * 100)}%` } as React.CSSProperties} />
              </div>
            </div>
          )}
          {items.magnet > 0 && (
            <div className={styles.itemGauge}>
              <span className={styles.itemGaugeIcon}>🧲</span>
              <div className={styles.itemGaugeBar}>
                {/* STYLE-EXCEPTION: 런타임 잔여율 — CSS 변수 브릿지 */}
                <div className={`${styles.itemGaugeFill} ${styles.itemGaugeFillMagnet}`} style={{ '--pct': `${Math.round(items.magnet * 100)}%` } as React.CSSProperties} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🌈 슈퍼부스트 배너 — 무적 관통 (피버보다 우선) */}
      {superOn && (
        <div className={styles.superBanner} aria-hidden="true">
          <span className={styles.superText}>🌈 SUPER BOOST</span>
          <div className={styles.superBar}>
            {/* STYLE-EXCEPTION: 런타임 잔여율 — CSS 변수 브릿지 */}
            <div className={styles.superBarFill} style={{ '--pct': `${Math.round(items.super * 100)}%` } as React.CSSProperties} />
          </div>
        </div>
      )}

      {/* 피버 배너 — 슈퍼부스트 중엔 자리 양보 (겹침 방지) */}
      {feverOn && !superOn && (
        <div className={styles.feverBanner} aria-hidden="true">
          <span className={styles.feverText}>FEVER ×2</span>
          <div className={styles.feverBar}>
            {/* STYLE-EXCEPTION: 런타임 잔여율 — CSS 변수 브릿지 */}
            <div className={styles.feverBarFill} style={{ '--pct': `${Math.round(items.fever * 100)}%` } as React.CSSProperties} />
          </div>
        </div>
      )}

      {/* 콤보 배지 */}
      {combo >= 2 && !feverOn && (
        <div className={styles.comboBadge} key={combo}>
          <span className={styles.comboMult}>×{combo}</span>
          <span className={styles.comboLabel}>COMBO</span>
        </div>
      )}

      {/* 플로팅 메시지 (니어미스/에어/아이템/마일스톤) */}
      <div className={styles.floatLayer} aria-hidden="true">
        {floats.map((f) => (
          <span key={f.id} className={`${styles.floatMsg} ${styles[`floatTone_${f.tone}`]}`}>
            {f.text}
          </span>
        ))}
      </div>
    </div>
  )
}
