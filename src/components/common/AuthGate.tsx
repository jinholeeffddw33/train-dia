'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore, type SabunStatus } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import { getDuplicateNameGroup } from '@/lib/auth';
import { syncRosterChanges } from '@/lib/rosterSync';
import { isGuest } from '@/lib/guestAccount';
import { guestPerson } from '@/lib/guestView';
import { KeyRound, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import styles from './AuthGate.module.css';

type Screen =
  | 'loading'
  | 'sabun'
  | 'notice'         // 관리자 첫 방문(또는 PIN 초기화 뒤): 새 PIN 설정 안내
  | 'name-pick'      // 동명이인(김성준A/B): 사번 확인 후 본인 이름 선택
  | 'login'          // 일반: 이름 입력 / 관리자: PIN 입력
  | 'pin-setup'      // 관리자 PIN 최초 설정
  | 'done';          // PIN 설정을 마쳤다 — 바로 앱으로 들어간다

/** 사번은 8자리 숫자 — 다 치면 «다음» 을 따로 누르지 않아도 넘어간다 */
const SABUN_LEN = 8;
/** 관리자 PIN — 숫자 4~10자리 */
const PIN_MIN = 4;
const PIN_MAX = 10;

/** 사번에 섞여 들어온 공백·하이픈은 지운다(«217-12345», 붙여넣기 공백) */
const cleanSabun = (v: string) => v.replace(/[\s-]/g, '');
/** 이름 가운데 띄어쓰기는 무시한다(«홍 길동» → «홍길동») */
const cleanName = (v: string) => v.replace(/\s+/g, '');
/** PIN 은 숫자만 */
const digitsOnly = (v: string) => v.replace(/\D/g, '');

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const lastSabun = useAuthStore((s) => s.lastSabun);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const checkSabun = useAuthStore((s) => s.checkSabun);
  const loginWithPin = useAuthStore((s) => s.loginWithPin);
  const loginWithName = useAuthStore((s) => s.loginWithName);
  const checkSession = useAuthStore((s) => s.checkSession);
  const clearError = useAuthStore((s) => s.clearError);

  const [screen, setScreen] = useState<Screen>('loading');
  const [sessionChecked, setSessionChecked] = useState(false);
  /** 명부 변경 예약(관리자 모드)까지 받아왔는가 — 이게 끝나야 맞는 이름으로 화면을 그린다 */
  const [rosterReady, setRosterReady] = useState(false);

  // 사번 입력
  const [sabun, setSabun] = useState('');
  const [sabunStatus, setSabunStatus] = useState<SabunStatus | null>(null);

  // 이름 입력 (일반 기관사)
  const [name, setName] = useState('');

  // PIN 로그인 (관리자)
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // PIN 설정 (관리자 최초)
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const confirmRef = useRef<HTMLInputElement>(null);

  /**
   * 화면의 주 버튼 — 입력칸을 누르면 키보드가 올라온 뒤 이 버튼이 보이도록 끌어올린다.
   * (키보드가 버튼을 가려 «다음/완료» 를 찾기 어려웠다 — 2026-09-30 진호)
   */
  const actionRef = useRef<HTMLButtonElement>(null);
  const revealAction = () => {
    // 키보드가 다 올라온 뒤(약 0.3초) — 그 전에 굴리면 키보드가 다시 덮는다
    window.setTimeout(() => {
      actionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 320);
  };

  // ── 앱 시작 시 세션 확인 + 온라인 복귀 시 재검증(오프라인 그레이스 해제) ──
  useEffect(() => {
    checkSession().then(() => setSessionChecked(true));
    const handleOnline = () => { checkSession(); syncRosterChanges(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [checkSession]);

  // ── 로그인되면 명부 변경 예약을 받아 심는다 (화면을 그리기 전에) ──
  //    실패해도 rosterReady 는 true 로 둔다 — 명부를 못 받았다고 앱을 못 쓰면 더 나쁘다
  useEffect(() => {
    if (!user) return;
    let alive = true;
    syncRosterChanges().finally(() => { if (alive) setRosterReady(true); });
    return () => { alive = false; };
  }, [user]);

  // ── 로그인 성공 시 driver store 연동 ──
  //    명부를 받은 뒤에 해야 한다 — 먼저 하면 발령 전 이름으로 «내 교번»이 잡힌다
  useEffect(() => {
    if (!rosterReady) return;
    if (user?.sabun && isGuest(user.sabun)) {
      // 체험 계정 — 그날 5다이아 기관사의 자리로 보여준다. setMyDriver 는 사번·순번으로
      // 실제 기관사를 다시 찾아 체험 계정 사번을 지우므로 스토어에 바로 넣는다.
      const me = guestPerson(user.sabun, user.name);
      useDriverStore.setState({ myDriver: me, current: me, isViewMode: false });
      return;
    }
    if (user?.sabun) {
      // 저장돼 있던 «나»는 명부를 받기 전에 복원된 것이다 — 사번이 같아도 자리(I)가 바뀌었을 수 있다
      useDriverStore.getState().refreshFromRoster();
      const { myDriver, setMyDriverById, setMyDriverBySabun, setMyDriver } = useDriverStore.getState();
      if (!myDriver || myDriver.s !== user.sabun || myDriver.n !== user.name) {
        if (user.personId && user.personId !== '0') {
          setMyDriverById(user.personId);
        } else {
          setMyDriverBySabun(user.sabun);
        }
        const updated = useDriverStore.getState().myDriver;
        if (!updated || updated.s !== user.sabun) {
          setMyDriver({ I: user.personId || '0', d: '', n: user.name, s: user.sabun });
        } else if (updated.n !== user.name) {
          setMyDriver({ ...updated, n: user.name });
        }
      }
    }
  }, [user, rosterReady]);

  // ── 세션 확인 후 화면 결정 ──
  useEffect(() => {
    if (!sessionChecked) return;
    if (user) {
      if (user.mustChangePin) {
        setScreen('pin-setup');
      }
      // 그외 → children 렌더
    } else {
      setScreen('sabun');
      if (lastSabun) setSabun(lastSabun);
    }
  }, [sessionChecked, user, lastSabun]);

  // ── 인증 완료 → 앱 렌더 (명부까지 받은 뒤) ──
  if (user && !user.mustChangePin && screen !== 'pin-setup' && rosterReady) {
    return <>{children}</>;
  }

  // ── 로딩 ──
  if (screen === 'loading' || screen === 'done' || !sessionChecked || (user && !rosterReady)) {
    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.loadingWrap}>
            <Loader2 size={32} className={styles.spinner} />
          </div>
        </div>
      </div>
    );
  }

  // ── 1단계: 사번 입력 ──
  if (screen === 'sabun') {
    const handleNext = async (value: string = sabun) => {
      if (loading) return; // Enter 연타·자동 넘김 중복 요청 가드
      const s = cleanSabun(value).trim();
      if (!s) return;
      const status = await checkSabun(s);
      if (!status) return;
      setSabunStatus(status);
      if (status.isAdmin && status.mustChangePin) {
        setScreen('notice');
      } else if (!status.isAdmin && getDuplicateNameGroup(s)) {
        // 동명이인 — 이름을 직접 받으면 A/B 중 뭘 쓸지 몰라 로그인 실패 → 선택지로 확인
        setScreen('name-pick');
      } else {
        setScreen('login');
      }
    };

    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.icon}>🚇</div>
          <h1 className={styles.title}>기관사 DIA</h1>
          <p className={styles.subtitle}>답십리 승무사업소 · 5호선</p>

          <div className={styles.inputGroup}>
            <label htmlFor="auth-sabun" className={styles.label}>사번 (숫자 8자리)</label>
            <input
              id="auth-sabun"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="next"
              maxLength={SABUN_LEN + 2}
              className={styles.input}
              placeholder="21700000"
              value={sabun}
              onChange={(e) => {
                const v = cleanSabun(e.target.value);
                setSabun(v);
                clearError();
                // 8자리를 다 쳤으면 바로 넘어간다 — 키보드에 가린 «다음» 을 찾지 않아도 된다
                if (v.length === SABUN_LEN && /^\d+$/.test(v)) handleNext(v);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNext(); }}
              onFocus={revealAction}
              autoComplete="off"
              autoFocus
            />
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button
            ref={actionRef}
            type="button"
            className={`z-cta ${styles.btn}`}
            data-press
            onClick={() => handleNext()}
            disabled={loading || !sabun.trim()}
          >
            {loading ? <Loader2 size={18} className={styles.spinnerInline} /> : null}
            <span>{loading ? '확인 중...' : '다음'}</span>
          </button>

          <div className={styles.hint}>
            본인 <span className={styles.hintStrong}>사번 8자리</span>를 숫자만 입력하세요.
            <span className={styles.hintLine}>예) 21712345 — 8자리를 다 치면 저절로 다음으로 넘어가요</span>
          </div>
        </div>
      </div>
    );
  }

  // ── 관리자 첫 방문 안내 (PIN 초기화 뒤에도 여기로 온다) ──
  if (screen === 'notice') {
    const handleStart = async () => {
      if (loading) return;
      const ok = await loginWithPin(sabun, '');
      if (ok) setScreen('pin-setup');
    };

    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <ShieldCheck size={40} className={styles.iconBlue} />
          </div>
          <h1 className={styles.title}>관리자 PIN 만들기</h1>
          <p className={styles.subtitle}>
            관리자 계정은 PIN으로 보호합니다.<br />
            지금은 PIN 없이 들어가 새 PIN을 정하면 돼요.
          </p>

          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <span className={styles.stepText}>아래 버튼을 누르세요</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <span className={styles.stepText}>본인만 아는 <b>숫자 {PIN_MIN}~{PIN_MAX}자리</b> PIN을 두 번 입력</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <span className={styles.stepText}>다음부터는 사번 + 그 PIN으로 로그인</span>
            </div>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button
            ref={actionRef}
            type="button"
            className={`z-cta ${styles.btn}`}
            data-press
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className={styles.spinnerInline} /> : null}
            <span>{loading ? '잠시만요...' : 'PIN 만들기 시작 →'}</span>
          </button>

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => { clearError(); setSabunStatus(null); setScreen('sabun'); }}
          >
            ← 사번 다시 입력
          </button>
        </div>
      </div>
    );
  }

  // ── 2단계(동명이인): 사번 확인 + 본인 이름 선택 ──
  if (screen === 'name-pick') {
    const group = getDuplicateNameGroup(sabun.trim());
    if (!group) {
      setScreen('login');
      return null;
    }

    const handlePick = async (pickedName: string) => {
      if (loading) return;
      await loginWithName(sabun.trim(), pickedName);
    };

    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.icon}>🚇</div>
          <h1 className={styles.title}>기관사 DIA</h1>
          <p className={styles.subtitle}>사번 {sabun}</p>

          <div className={styles.inputGroup}>
            <span className={styles.label}>이름 선택</span>
            <div className={styles.pickList}>
              {group.members.map((m) => (
                <button
                  key={m.sabun}
                  type="button"
                  className={`z-glass-surface ${styles.pickBtn}`}
                  data-press
                  onClick={() => handlePick(m.name)}
                  disabled={loading}
                >
                  <span className={styles.pickName}>{m.name}</span>
                  <span className={styles.pickMeta}>교번 {m.personId}</span>
                </button>
              ))}
            </div>
            <div className={styles.hint}>
              <span className={styles.hintStrong}>{group.base}</span> 님이 두 분 계셔서 이름 뒤에 A·B를 붙여
              구분합니다.
              <span className={styles.hintLine}>
                위 사번이 본인 사번이 맞는지 확인하고, 본인 교번의 이름을 눌러주세요.
              </span>
            </div>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => { clearError(); setSabunStatus(null); setScreen('sabun'); }}
          >
            ← 사번 다시 입력
          </button>
        </div>
      </div>
    );
  }

  // ── 2단계: 로그인 ──
  if (screen === 'login') {
    const isAdminUser = sabunStatus?.isAdmin ?? false;

    // ── 일반 기관사: 이름만 입력 ──
    if (!isAdminUser) {
      const handleNameLogin = async () => {
        if (loading) return; // Enter 연타 중복 로그인 가드
        const n = cleanName(name);
        if (!n) return;
        await loginWithName(sabun, n);
      };

      return (
        <div className={styles.gate}>
          <div className={styles.card}>
            <div className={styles.icon}>🚇</div>
            <h1 className={styles.title}>기관사 DIA</h1>
            <p className={styles.subtitle}>사번 {sabun}</p>

            <div className={styles.inputGroup}>
              <label htmlFor="auth-name" className={styles.label}>이름</label>
              <input
                id="auth-name"
                type="text"
                enterKeyHint="done"
                className={styles.input}
                placeholder="홍길동"
                value={name}
                onChange={(e) => { setName(e.target.value); clearError(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameLogin(); }}
                onFocus={revealAction}
                autoComplete="off"
                autoFocus
              />
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <button
              ref={actionRef}
              type="button"
              className={`z-cta ${styles.btn}`}
              data-press
              onClick={handleNameLogin}
              disabled={loading || !cleanName(name)}
            >
              {loading ? <Loader2 size={18} className={styles.spinnerInline} /> : null}
              <span>{loading ? '로그인 중...' : '로그인'}</span>
            </button>

            <div className={styles.hint}>
              <span className={styles.hintStrong}>본인 이름</span>을 한글로 그대로 입력하세요. (PIN 아님)
              <span className={styles.hintLine}>예) 박종길 · 장진수 — 키보드의 «완료» 를 눌러도 로그인돼요</span>
              <span className={styles.hintLine}>※ 일반 기관사는 PIN을 쓰지 않습니다.</span>
            </div>

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => { clearError(); setSabunStatus(null); setName(''); setScreen('sabun'); }}
            >
              ← 사번 다시 입력
            </button>
          </div>
        </div>
      );
    }

    // ── 관리자: PIN 입력 ──
    const handlePinLogin = async () => {
      if (loading) return; // Enter 연타 중복 로그인 가드
      if (!pin) return;
      await loginWithPin(sabun, pin);
    };

    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.icon}>🚇</div>
          <h1 className={styles.title}>기관사 DIA</h1>
          <p className={styles.subtitle}>사번 {sabun} (관리자)</p>

          <div className={styles.inputGroup}>
            <label htmlFor="auth-pin" className={styles.label}>PIN (숫자 {PIN_MIN}~{PIN_MAX}자리)</label>
            <div className={styles.pinWrap}>
              <input
                id="auth-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                enterKeyHint="done"
                className={styles.input}
                placeholder="● ● ● ●"
                value={pin}
                onChange={(e) => { setPin(e.target.value); clearError(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePinLogin(); }}
                onFocus={revealAction}
                maxLength={PIN_MAX}
                autoComplete="off"
                autoFocus
              />
              <button
                type="button"
                className={styles.pinToggle}
                onClick={() => setShowPin(!showPin)}
                aria-label={showPin ? 'PIN 숨기기' : 'PIN 보기'}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <button
            ref={actionRef}
            type="button"
            className={`z-cta ${styles.btn}`}
            data-press
            onClick={handlePinLogin}
            disabled={loading || !pin}
          >
            <KeyRound size={18} />
            <span>{loading ? '로그인 중...' : 'PIN으로 로그인'}</span>
          </button>

          <div className={styles.hint}>
            처음 PIN을 만들 때 정한 <span className={styles.hintStrong}>숫자 PIN</span>을 입력하세요.
            <span className={styles.hintLine}>
              PIN을 잊었다면 이현구 부장님께 초기화를 부탁하세요. 초기화 뒤에는 PIN 없이 들어가 새로 정하면 돼요.
            </span>
          </div>

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => { clearError(); setSabunStatus(null); setPin(''); setScreen('sabun'); }}
          >
            ← 사번 다시 입력
          </button>
        </div>
      </div>
    );
  }

  // ── 관리자 PIN 최초 설정 ──
  if (screen === 'pin-setup') {
    const handleSetPin = async () => {
      if (pinSaving) return; // 연타로 두 번 저장되면 두 번째가 «현재 PIN» 을 요구하며 실패했다
      setPinChangeError('');
      if (newPin.length < PIN_MIN) {
        setPinChangeError(`PIN은 숫자 ${PIN_MIN}자리 이상으로 정해주세요`);
        return;
      }
      if (newPin !== newPinConfirm) {
        setPinChangeError('두 번 입력한 PIN이 서로 달라요. 아래 칸에 다시 입력해주세요');
        setNewPinConfirm('');
        confirmRef.current?.focus();
        return;
      }
      setPinSaving(true);
      try {
        const res = await fetch('/api/auth/pin/change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPin, firstSetup: true }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPinChangeError(data.message || 'PIN을 저장하지 못했어요. 잠시 후 다시 시도해주세요');
          setPinSaving(false);
          return;
        }
        // ★ 저장 성공 → 바로 앱으로. 전에는 화면이 PIN 설정에 그대로 남아 다시 누르면
        //   «현재 PIN» 을 요구하는 오류가 났다(이미 설정이 끝났으므로) — 나갔다 들어와야 들어가졌다.
        const current = useAuthStore.getState().user;
        if (current) useAuthStore.setState({ user: { ...current, mustChangePin: false } });
        setNewPin('');
        setNewPinConfirm('');
        setPinSaving(false);
        setScreen('done');
      } catch {
        setPinChangeError('인터넷 연결이 불안정해요. 연결을 확인하고 다시 눌러주세요');
        setPinSaving(false);
      }
    };

    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <ShieldCheck size={40} className={styles.iconBlue} />
          </div>
          <h1 className={styles.title}>새 PIN 만들기</h1>
          <p className={styles.subtitle}>
            다음부터 로그인할 때 쓸 <b>숫자 {PIN_MIN}~{PIN_MAX}자리</b>를 정해주세요.<br />
            <span className={styles.subtitleHint}>본인만 아는, 기억하기 쉬운 숫자를 추천합니다.</span>
          </p>

          <div className={styles.inputGroup}>
            <label htmlFor="new-pin" className={styles.label}>새 PIN (숫자 {PIN_MIN}~{PIN_MAX}자리)</label>
            <input
              id="new-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="next"
              className={styles.input}
              placeholder="● ● ● ●"
              value={newPin}
              onChange={(e) => { setNewPin(digitsOnly(e.target.value)); setPinChangeError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmRef.current?.focus(); } }}
              onFocus={revealAction}
              maxLength={PIN_MAX}
              autoComplete="new-password"
              autoFocus
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="new-pin-confirm" className={styles.label}>한 번 더 입력</label>
            <input
              ref={confirmRef}
              id="new-pin-confirm"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              enterKeyHint="done"
              className={styles.input}
              placeholder="● ● ● ●"
              value={newPinConfirm}
              onChange={(e) => { setNewPinConfirm(digitsOnly(e.target.value)); setPinChangeError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSetPin(); }}
              onFocus={revealAction}
              maxLength={PIN_MAX}
              autoComplete="new-password"
            />
          </div>

          {(pinChangeError || error) && (
            <p className={styles.error} role="alert">{pinChangeError || error}</p>
          )}

          <button
            ref={actionRef}
            type="button"
            className={`z-cta ${styles.btn}`}
            data-press
            onClick={handleSetPin}
            disabled={pinSaving || !newPin || !newPinConfirm}
          >
            {pinSaving ? <Loader2 size={18} className={styles.spinnerInline} /> : null}
            <span>{pinSaving ? '저장 중...' : 'PIN 저장하고 시작하기'}</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
