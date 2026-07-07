/**
 * APEX RUSH — WebAudio 절차 효과음 (에셋 0)
 * 유저 제스처(START)에서 ensure() 로 컨텍스트 생성. 뮤트는 localStorage.
 */

const LS_MUTED = 'zinosb-apex-muted'

class ApexSfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private windSrc: AudioBufferSourceNode | null = null
  private windFilter: BiquadFilterNode | null = null
  private windGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  muted = false

  constructor() {
    // 음소거 버튼은 이제 BGM(노래)만 끈다 — 효과음(SFX)은 항상 재생 (진호 2026-07-06). muted 미사용.
  }

  /** 유저 제스처 안에서 호출 (autoplay 정책) */
  ensure(): void {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
        this.master = this.ctx.createGain()
        this.master.gain.value = this.muted ? 0 : 0.5
        this.master.connect(this.ctx.destination)
        // 효과음 전용 버스 — BGM(노래) 대비 잘 들리게 부스트(진호 2026-07-06 "효과음이 배경음에 묻힘").
        // 바람(wind)은 이 버스를 거치지 않고 master 직속이라 커지지 않는다(진호 "바람은 키우지 말고").
        this.sfxGain = this.ctx.createGain()
        this.sfxGain.gain.value = 1.7
        this.sfxGain.connect(this.master)
        // iOS unlock — 제스처 안에서 무음 1샘플 버퍼를 즉시 재생해 WebAudio 를 확실히 깨운다.
        //   resume() 만으론 iOS Safari/WKWebView 가 첫 소리를 묵음 처리하는 사례가 있어 표준 unlock 트릭 병행.
        //   ⚠️ 이래도 안 나오면 아이폰 측면 '무음 스위치' 문제 — 그건 네이티브 AVAudioSession(.playback) 영역.
        try {
          const unlock = this.ctx.createBufferSource()
          unlock.buffer = this.ctx.createBuffer(1, 1, 22050)
          unlock.connect(this.ctx.destination)
          unlock.start(0)
        } catch { /* unlock 실패 무시 — resume 폴백 */ }
        // 화이트노이즈 버퍼 (1s)
        const len = this.ctx.sampleRate
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
        const data = this.noiseBuffer.getChannelData(0)
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      } catch {
        this.ctx = null
      }
    }
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.5
    try {
      localStorage.setItem(LS_MUTED, muted ? '1' : '0')
    } catch { /* quota — 무시 */ }
  }

  dispose(): void {
    this.stopWind()
    this.ctx?.close().catch(() => {})
    this.ctx = null
    this.master = null
    this.sfxGain = null
    this.noiseBuffer = null
  }

  /** 바람 루프 시작 (속도감 — setWindLevel 로 세기 조절) */
  startWind(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noiseBuffer || this.windSrc) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 300
    filter.Q.value = 0.6
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    src.start()
    this.windSrc = src
    this.windFilter = filter
    this.windGain = gain
  }

  /** 바람 세기 0~1 (속도 비례) — 매 프레임 호출 가능 (램프 스무딩) */
  setWindLevel(level: number): void {
    const ctx = this.ctx
    if (!ctx || !this.windGain || !this.windFilter) return
    const t = ctx.currentTime
    const clamped = Math.max(0, Math.min(1, level))
    this.windGain.gain.setTargetAtTime(clamped * 0.32, t, 0.15)
    this.windFilter.frequency.setTargetAtTime(220 + clamped * 1500, t, 0.2)
  }

  stopWind(): void {
    try {
      this.windSrc?.stop()
    } catch { /* 이미 정지 — 무시 */ }
    this.windSrc?.disconnect()
    this.windFilter?.disconnect()
    this.windGain?.disconnect()
    this.windSrc = null
    this.windFilter = null
    this.windGain = null
  }

  private tone(
    freqFrom: number, freqTo: number, duration: number,
    type: OscillatorType, gain: number, when = 0,
  ): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || this.muted) return
    const t0 = ctx.currentTime + when
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freqFrom, t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + duration)
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(g)
    g.connect(this.sfxGain ?? master)
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  }

  private noise(duration: number, filterFreq: number, gain: number, sweepTo?: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || !this.noiseBuffer || this.muted) return
    const t0 = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(filterFreq, t0)
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t0 + duration)
    filter.Q.value = 1.2
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.sfxGain ?? master)
    src.start(t0)
    src.stop(t0 + duration + 0.02)
  }

  /** 니어미스 — 바람 가르는 휙 */
  nearMiss(combo: number): void {
    this.noise(0.18, 1400 + combo * 250, 0.5, 400)
  }

  /** 칩 수집 — 코인 삥 */
  chip(): void {
    this.tone(880, 1320, 0.12, 'square', 0.12)
    this.tone(1320, 1760, 0.1, 'square', 0.08, 0.06)
  }

  /** 램프 점프 */
  jump(): void {
    this.tone(280, 620, 0.22, 'sine', 0.25)
    this.noise(0.2, 900, 0.14, 2200) // 발사 바람
  }

  /** 크레스트 자연 점프 — 램프보다 가볍고 부드러운 리프트 */
  crest(): void {
    this.tone(340, 540, 0.16, 'sine', 0.16)
    this.noise(0.16, 700, 0.1, 1600)
  }

  /** 급조향 회피 — 휙 스워시 (세기 0~1) */
  swish(intensity: number): void {
    const k = Math.max(0.2, Math.min(1, intensity))
    this.noise(0.14 + k * 0.08, 1800 + k * 900, 0.22 + k * 0.22, 500)
  }

  /** 급강하 진입 — 다이브 바람 러시 (내리막 체감) */
  dive(): void {
    this.noise(0.5, 500, 0.2, 1900)
  }

  /** ◎ 스피드 링 통과 — 밝은 2음 + 통과 바람 */
  ring(): void {
    this.tone(720, 1080, 0.14, 'triangle', 0.22)
    this.tone(1080, 1440, 0.16, 'triangle', 0.18, 0.07)
    this.noise(0.16, 1500, 0.2, 600)
  }

  /** 💧 물웅덩이/오일 — 스플래시 */
  splash(): void {
    this.noise(0.3, 700, 0.4, 220)
    this.tone(220, 130, 0.18, 'sine', 0.14)
  }

  /** 착지 */
  land(): void {
    this.tone(160, 80, 0.15, 'sine', 0.3)
    this.noise(0.1, 600, 0.15)
  }

  /** 충돌 크래시 */
  crash(): void {
    this.noise(0.55, 900, 0.7, 120)
    this.tone(120, 40, 0.5, 'sawtooth', 0.4)
  }

  /** 시작 GO */
  go(): void {
    this.tone(440, 440, 0.1, 'square', 0.15)
    this.tone(660, 660, 0.16, 'square', 0.18, 0.12)
  }

  /** 아이템 픽업 — 3음 상승 벨 */
  item(): void {
    this.tone(520, 520, 0.09, 'triangle', 0.2)
    this.tone(660, 660, 0.09, 'triangle', 0.2, 0.08)
    this.tone(880, 880, 0.14, 'triangle', 0.22, 0.16)
  }

  /** 실드 파괴 — 유리 깨짐 근사 */
  shieldBreak(): void {
    this.noise(0.3, 2400, 0.5, 600)
    this.tone(320, 140, 0.25, 'sawtooth', 0.2)
  }

  /** 피버 발동 — 팡파레 화음 */
  fever(): void {
    this.tone(523, 523, 0.3, 'square', 0.14)
    this.tone(659, 659, 0.3, 'square', 0.14, 0.02)
    this.tone(784, 784, 0.42, 'square', 0.16, 0.04)
    this.tone(1046, 1046, 0.5, 'triangle', 0.2, 0.1)
  }

  /** 마일스톤 — 2음 벨 */
  milestone(): void {
    this.tone(740, 740, 0.12, 'triangle', 0.18)
    this.tone(988, 988, 0.2, 'triangle', 0.2, 0.1)
  }

  /** 퍼펙트 랜딩 */
  perfect(): void {
    this.tone(392, 784, 0.18, 'sine', 0.25)
  }
}

/** 싱글턴 — 게임 세션 간 공유 (컨텍스트 재생성 비용 절약) */
export const apexSfx = new ApexSfx()
