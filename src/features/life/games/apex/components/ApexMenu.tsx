'use client'

/**
 * APEX RUSH — 시작 메뉴 (반투명 오버레이 — 뒤에서 게임 씬이 orbit 중)
 * 진호 2026-07-05 재디자인: 내 최고 점수를 화면 히어로로 크게(제일 중요), 뜻 모호한 태그라인·데일리 칩 제거,
 *   랭킹은 풀스크린 리더보드(주간 기본)로. 로고 + 내 최고(대형) + 랭킹 버튼 + 컬러 + START.
 */

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { BIKE_COLORS, type ApexProgress, type BikeColorDef } from '../hooks/useApexProgress'
import styles from '../styles/apex.module.css'

interface ApexMenuProps {
  progress: ApexProgress
  selectedColor: BikeColorDef
  onSelectColor: (id: string) => void
  onStart: () => void
  muted: boolean
  onToggleMute: () => void
  isAuthenticated: boolean
  /** 랭킹(리더보드) 오버레이 렌더 — 호스트 주입(zinosb=풀스크린 Leaderboard). 없으면 랭킹 버튼 숨김 */
  renderLeaderboard?: (props: { onClose: () => void; embedded?: boolean }) => ReactNode
  /** 오버레이 마운트(프리시즌 등)에서 게임을 닫고 원래 화면으로 복귀 — 있으면 /game 링크 대신 이 콜백.
   *  라우트(/game/apex-rush)로 진입한 경우는 미전달 → 기존 게임 허브 링크 유지 (진호 2026-07-05). */
  onExit?: () => void
}

export function ApexMenu({
  progress, selectedColor,
  onSelectColor, onStart, muted, onToggleMute, isAuthenticated, renderLeaderboard, onExit,
}: ApexMenuProps) {
  const [showRank, setShowRank] = useState(false)

  return (
    <div className={styles.menuOverlay}>
      <div className={styles.menuTopBar}>
        {onExit ? (
          <button type="button" onClick={onExit} className={styles.menuBack} aria-label="게임 닫기">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <Link href="/game" className={styles.menuBack} aria-label="게임 허브로 돌아가기" data-ios-back="page">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
        )}
        <button
          type="button"
          className={styles.menuMute}
          onClick={onToggleMute}
          aria-label={muted ? '음악 켜기' : '음악 끄기'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* 쇼케이스 레이아웃 (진호 2026-07-07) — 텍스트는 상/하단으로 밀고 중앙은 자전거.
          중앙 스페이서는 pointer-events 통과 → 캔버스 드래그(회전)/핀치(줌)가 그대로 먹힌다. */}
      <div className={styles.menuBody}>
        <div className={styles.menuTopBlock}>
          <p className={styles.menuKicker}>ZINOSB ARCADE</p>
          <h1 className={styles.menuLogo}>APEX RUSH</h1>
          <p className={styles.menuScoreLine}>
            {progress.bestScore > 0 ? (
              <>내 최고 <b>{progress.bestScore.toLocaleString()}</b> · {Math.floor(progress.bestDistance).toLocaleString()}m</>
            ) : (
              '첫 기록에 도전'
            )}
          </p>
        </div>

        <div className={styles.menuSpacer} aria-hidden="true" />

        <div className={styles.menuBottomBlock}>
          <p className={styles.menuHint}>화면 좌우 드래그로 조종 · 아슬하게 스치면 부스트</p>

          {/* 액션 바 — 가로 화면(21:9~4:3) 어디서도 START 가 하단 고정으로 항상 보이게
              색칩과 START 를 한 줄로. 좁으면 flex-wrap 으로 자연 줄바꿈 (진호 2026-07-07 가로 전환). */}
          <div className={styles.menuControls}>
            {/* 바이크 컬러 — 클릭 즉시 3D 프레임 실시간 반영 */}
            <div className={styles.menuColors} role="radiogroup" aria-label="바이크 컬러 선택">
              {BIKE_COLORS.map((c) => {
                const selected = c.id === selectedColor.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={c.name}
                    className={`${styles.colorChip} ${selected ? styles.colorChipOn : ''}`}
                    onClick={() => onSelectColor(c.id)}
                    // STYLE-EXCEPTION: 컬러 팔레트 런타임 값 — CSS 변수 브릿지
                    style={{ '--chip-color': c.css } as React.CSSProperties}
                  >
                    <span className={styles.colorDot} aria-hidden="true" />
                  </button>
                )
              })}
            </div>

            <button type="button" className={styles.startBtn} onClick={onStart}>
              START
            </button>
          </div>

          <div className={styles.menuSubRow}>
            {renderLeaderboard && (
              <button type="button" className={styles.menuRankBtn} onClick={() => setShowRank(true)}>
                🏆 전체 랭킹
              </button>
            )}
            {!isAuthenticated && (
              <span className={styles.menuLoginHint}>로그인하면 기록이 랭킹에 올라가요</span>
            )}
          </div>
        </div>
      </div>

      {/* 프리시즌 오버레이(onExit 존재)에서만 embedded → 프로필/앱화면 유출 차단. 라우트 게임은 프로필 허용 (진호 2026-07-05) */}
      {showRank && renderLeaderboard?.({ onClose: () => setShowRank(false), embedded: !!onExit })}
    </div>
  )
}
