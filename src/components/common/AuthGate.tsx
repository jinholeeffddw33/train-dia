'use client';

import { useEffect, useState } from 'react';
import { useAuthStore, type SabunStatus } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import { Fingerprint, KeyRound, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import styles from './AuthGate.module.css';

type Screen =
  | 'loading'        // 세션 확인 중
  | 'sabun'          // 1단계: 사번 입력
  | 'notice'         // 첫 방문자 안내 모달 (PIN = 0000)
  | 'login'          // 2단계: PIN / 생체인증 로그인
  | 'pin-setup'      // PIN 최초 설정
  | 'biometric-setup'; // 생체인증 등록 권유

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hasBiometric = useAuthStore((s) => s.hasBiometric);
  const lastSabun = useAuthStore((s) => s.lastSabun);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const checkSabun = useAuthStore((s) => s.checkSabun);
  const loginWithPin = useAuthStore((s) => s.loginWithPin);
  const loginWithBiometric = useAuthStore((s) => s.loginWithBiometric);
  const registerBiometric = useAuthStore((s) => s.registerBiometric);
  const checkSession = useAuthStore((s) => s.checkSession);
  const clearError = useAuthStore((s) => s.clearError);

  const [screen, setScreen] = useState<Screen>('loading');
  const [sessionChecked, setSessionChecked] = useState(false);
  const [skipBiometric, setSkipBiometric] = useState(false);

  // 사번 입력 단계
  const [sabun, setSabun] = useState('');

  // 사번 조회 결과
  const [sabunStatus, setSabunStatus] = useState<SabunStatus | null>(null);

  // PIN 로그인 단계
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  // PIN 설정 단계
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');

  // ── 앱 시작 시 세션 확인 ──
  useEffect(() => {
    checkSession().then(() => setSessionChecked(true));
  }, [checkSession]);

  // ── 로그인 성공 시 driver store 연동 ──
  useEffect(() => {
    if (user?.sabun) {
      const { myDriver, setMyDriverById, setMyDriverBySabun, setMyDriver } = useDriverStore.getState();
      // sabun(유일값)으로 비교 — I는 EXTRA_USERS 전원 '0'이라 신뢰 불가
      if (!myDriver || myDriver.s !== user.sabun) {
        if (user.personId && user.personId !== '0') {
          setMyDriverById(user.personId);
        } else {
          setMyDriverBySabun(user.sabun);
        }

        // P/EXTRA에 없는 사용자 fallback (관리자 등)
        const updated = useDriverStore.getState().myDriver;
        if (!updated || updated.s !== user.sabun) {
          setMyDriver({ I: user.personId || '0', d: '', n: user.name, s: user.sabun });
        } else if (updated.n !== user.name) {
          // DB 이름이 P 배열 이름과 다르면 DB(인증) 이름 우선
          setMyDriver({ ...updated, n: user.name });
        }
      }
    }
  }, [user]);

  // ── 세션 확인 후 화면 결정 ──
  useEffect(() => {
    if (!sessionChecked) return;
    if (user) {
      if (user.mustChangePin) {
        setScreen('pin-setup');
      } else if (!hasBiometric && !skipBiometric) {
        setScreen('biometric-setup');
      }
      // 그외 → children 렌더 (아래 early return)
    } else {
      setScreen('sabun');
      if (lastSabun) setSabun(lastSabun);
    }
  }, [sessionChecked, user, hasBiometric, lastSabun, skipBiometric]);

  // ── 인증 완료 → 앱 렌더 ──
  if (user && screen !== 'biometric-setup' && screen !== 'pin-setup') {
    return <>{children}</>;
  }

  // ── 로딩 ──
  if (screen === 'loading' || !sessionChecked) {
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
    const handleNext = async () => {
      if (!sabun.trim()) return;
      const status = await checkSabun(sabun.trim());
      if (!status) return; // 에러는 store에서 처리
      setSabunStatus(status);
      if (status.mustChangePin) {
        setScreen('notice');
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
            <label htmlFor="auth-sabun" className={styles.label}>사번</label>
            <input
              id="auth-sabun"
              type="number"
              inputMode="numeric"
              className={styles.input}
              placeholder="21700000"
              value={sabun}
              onChange={(e) => { setSabun(e.target.value); clearError(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNext(); }}
              autoComplete="off"
              autoFocus
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.btn}
            onClick={handleNext}
            disabled={loading || !sabun.trim()}
          >
            {loading ? <Loader2 size={18} className={styles.spinnerInline} /> : null}
            <span>{loading ? '확인 중...' : '다음'}</span>
          </button>
        </div>
      </div>
    );
  }

  // ── 첫 방문자 안내 모달 ──
  if (screen === 'notice') {
    const handleStart = async () => {
      // 사번 + 빈 PIN → 서버에서 mustChangePin=true이면 허용
      const ok = await loginWithPin(sabun, '');
      if (ok) setScreen('pin-setup');
    };

    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <ShieldCheck size={40} className={styles.iconBlue} />
          </div>
          <h1 className={styles.title}>보안 로그인 안내</h1>
          <p className={styles.subtitle}>
            이제부터 개인 PIN으로 앱에 로그인합니다.<br />
            처음 접속 시 아래 단계를 따라주세요.
          </p>

          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <span className={styles.stepText}>초기 PIN <strong>0000</strong> 입력 후 시작</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <span className={styles.stepText}>본인만의 새 PIN으로 변경</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <span className={styles.stepText}>다음부터는 PIN 또는 지문으로 빠르게 로그인</span>
            </div>
          </div>

          <div className={styles.pinHint}>
            <span className={styles.pinHintLabel}>초기 PIN</span>
            <span className={styles.pinHintCode}>0000</span>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.btn}
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className={styles.spinnerInline} /> : null}
            <span>{loading ? '잠시만요...' : '시작하기 →'}</span>
          </button>
        </div>
      </div>
    );
  }

  // ── 2단계: PIN / 생체인증 로그인 ──
  if (screen === 'login') {
    const hasBio = sabunStatus?.hasBiometric ?? hasBiometric;

    const handleBiometricLogin = async () => {
      await loginWithBiometric(sabun);
    };

    const handlePinLogin = async () => {
      if (!pin) return;
      await loginWithPin(sabun, pin);
    };

    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.icon}>🚇</div>
          <h1 className={styles.title}>기관사 DIA</h1>
          <p className={styles.subtitle}>사번 {sabun}</p>

          {/* 생체인증 버튼 */}
          {hasBio && (
            <button
              type="button"
              className={styles.biometricBtn}
              onClick={handleBiometricLogin}
              disabled={loading}
            >
              <Fingerprint size={24} />
              <span>{loading ? '인증 중...' : '지문 / 얼굴인식으로 로그인'}</span>
            </button>
          )}

          {hasBio && (
            <div className={styles.divider}>
              <span>또는 PIN으로 로그인</span>
            </div>
          )}

          {/* PIN 입력 */}
          <div className={styles.inputGroup}>
            <label htmlFor="auth-pin" className={styles.label}>PIN</label>
            <div className={styles.pinWrap}>
              <input
                id="auth-pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                className={styles.input}
                placeholder="● ● ● ●"
                value={pin}
                onChange={(e) => { setPin(e.target.value); clearError(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePinLogin(); }}
                maxLength={10}
                autoComplete="off"
                autoFocus={!hasBio}
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

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.btn}
            onClick={handlePinLogin}
            disabled={loading || !pin}
          >
            <KeyRound size={18} />
            <span>{loading ? '로그인 중...' : 'PIN으로 로그인'}</span>
          </button>

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => {
              clearError();
              setSabunStatus(null);
              setPin('');
              setScreen('sabun');
            }}
          >
            ← 사번 다시 입력
          </button>
        </div>
      </div>
    );
  }

  // ── PIN 최초 설정 ──
  if (screen === 'pin-setup') {
    const handleSetPin = async () => {
      setPinChangeError('');
      if (newPin.length < 4) {
        setPinChangeError('PIN은 4자리 이상이어야 합니다');
        return;
      }
      if (newPin !== newPinConfirm) {
        setPinChangeError('PIN이 일치하지 않습니다');
        return;
      }
      const res = await fetch('/api/auth/pin/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin, firstSetup: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinChangeError(data.message || 'PIN 설정에 실패했습니다');
        return;
      }
      if (user) {
        useAuthStore.setState({ user: { ...user, mustChangePin: false } });
      }
      setScreen('biometric-setup');
    };

    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <ShieldCheck size={40} className={styles.iconBlue} />
          </div>
          <h1 className={styles.title}>새 PIN 설정</h1>
          <p className={styles.subtitle}>
            앞으로 사용할 개인 PIN을 설정해주세요.<br />
            <span className={styles.subtitleHint}>생년월일 앞 4자리 등 기억하기 쉬운 숫자를 추천합니다.</span>
          </p>

          <div className={styles.inputGroup}>
            <label htmlFor="new-pin" className={styles.label}>새 PIN (4자리 이상)</label>
            <input
              id="new-pin"
              type="password"
              inputMode="numeric"
              className={styles.input}
              placeholder="● ● ● ●"
              value={newPin}
              onChange={(e) => { setNewPin(e.target.value); setPinChangeError(''); }}
              maxLength={10}
              autoFocus
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="new-pin-confirm" className={styles.label}>PIN 확인</label>
            <input
              id="new-pin-confirm"
              type="password"
              inputMode="numeric"
              className={styles.input}
              placeholder="● ● ● ●"
              value={newPinConfirm}
              onChange={(e) => { setNewPinConfirm(e.target.value); setPinChangeError(''); }}
              maxLength={10}
            />
          </div>

          {(pinChangeError || error) && (
            <p className={styles.error}>{pinChangeError || error}</p>
          )}

          <button
            type="button"
            className={styles.btn}
            onClick={handleSetPin}
            disabled={loading}
          >
            {loading ? '설정 중...' : 'PIN 설정 완료'}
          </button>
        </div>
      </div>
    );
  }

  // ── 생체인증 등록 권유 ──
  if (screen === 'biometric-setup' && user) {
    const handleRegister = async () => {
      const ok = await registerBiometric();
      if (ok) setScreen('login');
    };

    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <Fingerprint size={48} className={styles.iconBlue} />
          </div>
          <h1 className={styles.title}>생체인증 등록</h1>
          <p className={styles.subtitle}>
            다음부터 지문 또는 얼굴인식으로<br />
            빠르게 로그인할 수 있습니다
          </p>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.btn}
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? '등록 중...' : '생체인증 등록하기'}
          </button>

          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => {
              setSkipBiometric(true);
              setScreen('login');
            }}
          >
            나중에 할게요
          </button>
        </div>
      </div>
    );
  }

  return null;
}
