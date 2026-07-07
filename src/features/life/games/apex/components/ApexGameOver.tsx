'use client'

/**
 * APEX RUSH — 게임오버 카드 (V13 초심플)
 * 근소차 재도전 심리: 신기록이면 축하, 아니면 "최고 기록까지 -N점" 을 크게.
 */

import { useState, type ReactNode } from 'react'
import styles from '../styles/apex.module.css'

export interface RunResult {
  score: number
  distance: number
  maxSpeedKmh: number
  nearMisses: number
  maxCombo: number
  airScore: number
  chips: number
  deathReason: string
  /** 도달 스테이지 */
  stage: number
}

export type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error' | 'guest'

interface ApexGameOverProps {
  result: RunResult
  /** 이번 판 전의 로컬 최고 점수 (근소차/신기록 표시용) */
  prevBest: number
  submitStatus: SubmitStatus
  serverRank: number | null
  onRetry: () => void
  onMenu: () => void
  /** 랭킹(리더보드) 오버레이 렌더 — 호스트 주입(zinosb=풀스크린 Leaderboard). 없으면 랭킹 버튼 숨김 */
  renderLeaderboard?: (props: { onClose: () => void; embedded?: boolean }) => ReactNode
  /** 프리시즌 오버레이 여부 — 랭킹에서 프로필/앱화면 유출 차단 (진호 2026-07-05) */
  embedded?: boolean
}

export function ApexGameOver({
  result, prevBest, submitStatus, serverRank, onRetry, onMenu, renderLeaderboard, embedded = false,
}: ApexGameOverProps) {
  const isNewBest = result.score > prevBest
  const gap = prevBest > 0 ? prevBest - result.score : 0
  const [showRank, setShowRank] = useState(false)

  return (
    <div className={styles.overOverlay}>
      <div className={styles.overCard}>
        <p className={styles.overStageBadge}>STAGE {result.stage} 도달</p>
        <p className={styles.overReason}>{result.deathReason || '런 종료'}</p>

        <p className={styles.overScore}>{result.score.toLocaleString()}</p>

        {isNewBest ? (
          <p className={styles.overNewBest}>🏆 신기록!</p>
        ) : gap > 0 ? (
          <p className={styles.overGap}>최고 기록까지 <strong>{gap.toLocaleString()}점</strong></p>
        ) : null}

        {serverRank !== null && submitStatus === 'success' && (
          <p className={styles.overRank}>전체 랭킹 #{serverRank}</p>
        )}
        {submitStatus === 'guest' && (
          <p className={styles.overGuest}>로그인하면 랭킹에 기록돼요</p>
        )}
        {submitStatus === 'error' && (
          <p className={styles.overError}>기록 저장에 실패했어요 · 다시 달리면 재시도돼요</p>
        )}

        <div className={styles.overStats}>
          <div className={styles.overStat}>
            <span className={styles.overStatValue}>{Math.floor(result.distance).toLocaleString()}m</span>
            <span className={styles.overStatLabel}>거리</span>
          </div>
          <div className={styles.overStat}>
            <span className={styles.overStatValue}>{Math.round(result.maxSpeedKmh)}</span>
            <span className={styles.overStatLabel}>최고 km/h</span>
          </div>
          <div className={styles.overStat}>
            <span className={styles.overStatValue}>×{result.maxCombo}</span>
            <span className={styles.overStatLabel}>맥스 콤보</span>
          </div>
        </div>

        <button type="button" className={styles.startBtn} onClick={onRetry}>
          다시 달리기
        </button>
        <div className={styles.overSubRow}>
          <button type="button" className={`${styles.overSubBtn} z-3d-sky`} onClick={onMenu}>
            메뉴로
          </button>
          {/* 게임 후 전체 랭킹 → 풀스크린 리더보드(주간) 오버레이 (진호 2026-07-05) */}
          {renderLeaderboard && (
            <button type="button" className={`${styles.overSubBtn} z-3d-violet`} onClick={() => setShowRank(true)}>
              전체 랭킹
            </button>
          )}
        </div>
      </div>
      {showRank && renderLeaderboard?.({ onClose: () => setShowRank(false), embedded })}
    </div>
  )
}
