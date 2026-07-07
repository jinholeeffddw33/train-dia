/**
 * APEX RUSH — 호스트 어댑터 계약 (진호 2026-07-07)
 *
 * 게임 코어(engine/three/components)는 이 인터페이스만 알고, 인증·랭킹 DB·오버레이·햅틱·로깅
 * 같은 "바깥 세계"는 각 프로젝트가 host 구현으로 주입한다. 덕분에 코어 한 벌을 zinosb-marketplace 와
 * train-dia(별도 랭킹 DB)가 공유한다 — "여기서 UI 고치면 sync 로 양쪽 반영"(두 번 수정 방지).
 *
 * - zinosb host   = useAuthStore + lib/supabase/game + overlay-back-stack + logger + haptic + <Leaderboard>
 * - train-dia host = /api/games/scores + <GameRanking> + (자체 auth/haptic)
 *
 * ★ 이 파일과 ApexGame(코어)에는 프로젝트 전용 import(@/app/... 등)가 하나도 없어야 한다(sync 대상).
 */

import type { ReactNode } from 'react'

/** 한 판 결과 — 호스트 독립. 각 host 가 자기 DB payload 로 변환해 제출한다. */
export interface ApexScorePayload {
  score: number
  distance: number
  maxSpeedKmh: number
  /** 에어(플립) 점수 */
  airScore: number
  seed: number
  deathReason?: string
  stage: number
  maxCombo: number
  nearMisses: number
  chips: number
}

/** 점수 제출 결과 (순위 미산출 시 rank=null) */
export interface ApexSubmitResult {
  rank: number | null
  personalBest?: boolean
}

export interface ApexHost {
  /** 로그인 여부 — 미로그인 시 게스트(랭킹 미제출) 안내 */
  isAuthenticated: boolean
  /** 게임 세션 토큰 요청(안티치트) — 세션 개념 없는 호스트는 미구현(토큰 null 로 진행) */
  requestSession?: () => Promise<string | null>
  /**
   * 점수 제출 → 순위. 세션 토큰이 필요한 호스트를 위해 sessionToken 을 함께 전달(없으면 null).
   * 실패 시 throw 하면 코어가 'error' 상태로 안내한다.
   */
  submitScore: (payload: ApexScorePayload, sessionToken: string | null) => Promise<ApexSubmitResult>
  /** 가벼운 햅틱(진동) */
  haptic: () => void
  /** 에러 로깅 */
  logError: (err: unknown, ctx?: Record<string, unknown>) => void
  /**
   * 시스템 뒤로가기(오버레이 백스택) 등록. 열려있는 동안 close 가 시스템 백에 연결되고,
   * 반환된 해제 함수로 등록을 푼다. 미구현 호스트는 생략(시스템 백 위임 없음).
   */
  registerBack?: (close: () => void) => () => void
  /**
   * 랭킹(리더보드) 오버레이 렌더 — 각 프로젝트 자기 컴포넌트(zinosb=Leaderboard / train-dia=GameRanking).
   * 미구현이면 게임 내 '전체 랭킹' 버튼을 숨긴다.
   */
  renderLeaderboard?: (props: { onClose: () => void; embedded?: boolean }) => ReactNode
}
