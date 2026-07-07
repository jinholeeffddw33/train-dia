/**
 * APEX RUSH — 배경 음악 (BGM)
 * 진호 게임음악 폴더(Pixabay 계열 phonk/synthwave/EDM). 매 판 랜덤 곡으로 시작하고,
 * 한 곡이 끝나면 바로 다음 곡을 이어 트는 무한 플레이리스트(진호 2026-07-06 "곡 끝나면 바로 다음").
 *
 * - SFX(apexSfx)와 음소거 상태 공유: 같은 localStorage 키('zinosb-apex-muted')를 읽어
 *   메뉴/게임 HUD 🔇 토글 하나로 SFX·BGM 이 함께 on/off. (기록은 apexSfx.setMuted 가 담당)
 * - HTMLAudioElement 스트리밍 — 3~6MB mp3 를 전부 받고 기다리지 않고 바로 재생.
 * - autoplay 정책: play() 는 START/RETRY 버튼(유저 제스처) 안에서만 호출 → 차단 안 됨.
 * - 백그라운드 정지: 앱/탭이 숨겨지면(홈버튼·앱전환·탭이동) 즉시 pause, 복귀 시 켜져있던 경우만 재개
 *   (진호 2026-07-06 "앱 닫으면 음악 계속 들림"). HTMLAudio 는 기본적으로 백그라운드에서도 계속 울린다.
 *   ⚠️ iOS 에서 소리 안 나면 측면 '무음 스위치' — 네이티브 AVAudioSession(.playback) 영역.
 */

const LS_MUTED = 'zinosb-apex-music-muted' // BGM(노래) 전용 음소거 — 효과음(SFX)은 별개, 항상 재생

const BASE = '/game/apex/music/'

// 다운힐 스피드 무드 우선(phonk/synthwave/EDM). 뒤쪽은 취향 곡 —
// 로컬에서 빼고 싶은 곡은 이 배열에서 줄만 지우면 된다 (파일은 그대로 둬도 무방).
const TRACKS = [
  'neon-synthwave-drive.mp3',
  'neon-night-phonk.mp3',
  'phonk-mountain.mp3',
  'phonk-drive.mp3',
  'future-bass.mp3',
  'progressive-house.mp3',
  'trance-euphoria.mp3',
  'melody.mp3',
  'cinematic-trailer.mp3',
  'get-out-of-my-head.mp3',
  'freak-emotional.mp3',
  'rise-from-nothing.mp3',
  'chohee.mp3',
]

class ApexBgm {
  private el: HTMLAudioElement | null = null
  private lastIndex = -1
  /** BGM 이 켜져 있어야 하는 상태 (stop 하면 false) — 백그라운드 복귀 시 재개 여부 판단 */
  private active = false
  muted = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.muted = localStorage.getItem(LS_MUTED) === '1'
    }
  }

  /** 앱/탭 백그라운드 → 즉시 멈춤, 복귀 → 켜져있던 경우에만 이어 재생 */
  private onVisibility = (): void => {
    if (!this.el) return
    if (document.hidden) this.el.pause()
    else if (this.active) this.el.play().catch(() => {})
  }

  /** 유저 제스처(START/RETRY) 안에서 호출 — 랜덤 곡으로 시작, 이후 곡 끝날 때마다 자동 다음 곡(무한) */
  play(): void {
    if (typeof window === 'undefined' || TRACKS.length === 0) return
    if (!this.el) {
      this.el = new Audio()
      this.el.volume = 0.35 // 배경 — 절차 SFX(master 0.5)보다 낮게 깔아 효과음이 묻히지 않게
      this.el.preload = 'auto'
      // loop 대신 ended → 다음 곡: 같은 곡 반복이 아니라 플레이리스트가 계속 흐른다.
      this.el.addEventListener('ended', () => this.playRandom())
      document.addEventListener('visibilitychange', this.onVisibility)
    }
    this.active = true
    this.playRandom()
  }

  /** 직전과 다른 랜덤 곡을 즉시 재생 (연속 같은 곡 방지) */
  private playRandom(): void {
    if (!this.el || TRACKS.length === 0) return
    let i = Math.floor(Math.random() * TRACKS.length)
    if (TRACKS.length > 1 && i === this.lastIndex) i = (i + 1) % TRACKS.length
    this.lastIndex = i
    this.el.src = BASE + TRACKS[i]
    this.el.muted = this.muted
    this.el.currentTime = 0
    this.el.play().catch(() => { /* autoplay 차단/네트워크 — 조용히 무시 */ })
  }

  stop(): void {
    this.active = false
    this.el?.pause()
  }

  /** 노래(BGM) 음소거 토글 — 효과음(SFX)은 안 건드린다(항상 재생). localStorage 에 기록. */
  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.el) this.el.muted = muted
    try { localStorage.setItem(LS_MUTED, muted ? '1' : '0') } catch { /* quota 무시 */ }
  }

  dispose(): void {
    this.active = false
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility)
    }
    if (this.el) {
      this.el.pause()
      this.el.src = '' // 리스너는 el 참조 소멸로 함께 GC
      this.el = null
    }
    this.lastIndex = -1
  }
}

/** 싱글턴 — 게임 세션 간 공유 (apexSfx 와 동형) */
export const apexBgm = new ApexBgm()
