'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import { Fingerprint, KeyRound, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import styles from './AuthGate.module.css';

type Screen = 'loading' | 'login' | 'biometric-setup' | 'pin-change';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const hasBiometric = useAuthStore((s) => s.hasBiometric);
  const lastSabun = useAuthStore((s) => s.lastSabun);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const loginWithPin = useAuthStore((s) => s.loginWithPin);
  const loginWithBiometric = useAuthStore((s) => s.loginWithBiometric);
  const registerBiometric = useAuthStore((s) => s.registerBiometric);
  const changePin = useAuthStore((s) => s.changePin);
  const checkSession = useAuthStore((s) => s.checkSession);
  const clearError = useAuthStore((s) => s.clearError);

  const [screen, setScreen] = useState<Screen>('loading');
  const [sabun, setSabun] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [skipBiometric, setSkipBiometric] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  // 앱 시작 시 세션 확인
  useEffect(() => {
    checkSession().then(() => setSessionChecked(true));
  }, [checkSession]);

  // 로그인 성공 시 driver store 연동
  useEffect(() => {
    if (user && user.sabun) {
      const { myDriver, setMyDriverById, setMyDriverBySabun } = useDriverStore.getState();
      if (!myDriver || myDriver.s !== user.sabun) {
        // 사번으로 먼저 시도 (EXTRA_USERS 포함)
        if (user.personId && user.personId !== '0') {
          setMyDriverById(user.personId);
        } else {
          setMyDriverBySabun(user.sabun);
        }
      }
    }
  }, [user]);

  // 세션 확인 후 화면 결정
  useEffect(() => {
    if (!sessionChecked) return;
    if (user) {
      if (user.mustChangePin) {
        setScreen('pin-change');
      } else if (!hasBiometric && !skipBiometric) {
        setScreen('biometric-setup');
      } else {
        setScreen('login'); // 인증됨 → children 렌더
      }
    } else {
      setScreen('login');
      if (lastSabun) setSabun(lastSabun);
    }
  }, [sessionChecked, user, hasBiometric, lastSabun, skipBiometric]);

  // 인증 완료 → children
  if (user && screen !== 'biometric-setup' && screen !== 'pin-change') {
    return <>{children}</>;
  }

  // 로딩
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

  // PIN 최초 설정 화면 (사번만으로 로그인한 후)
  if (screen === 'pin-change') {
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
      // 최초 설정: currentPin 없이 firstSetup 플래그
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
      // mustChangePin 해제
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
          <h1 className={styles.title}>PIN 설정</h1>
          <p className={styles.subtitle}>
            앱 잠금에 사용할 PIN을 설정해주세요
          </p>

          <div className={styles.inputGroup}>
            <label htmlFor="new-pin" className={styles.label}>PIN (4자리 이상)</label>
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
            {loading ? '설정 중...' : 'PIN 설정'}
          </button>
        </div>
      </div>
    );
  }

  // 생체인증 등록 유도 화면
  if (screen === 'biometric-setup' && user) {
    const handleRegister = async () => {
      const ok = await registerBiometric();
      if (ok) {
        // 등록 완료 → 앱 진입
        setScreen('login');
      }
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

  // ── 로그인 화면 ──
  const handleBiometricLogin = async () => {
    const targetSabun = sabun || lastSabun;
    if (!targetSabun) {
      clearError();
      return;
    }
    await loginWithBiometric(targetSabun);
  };

  // 사번만으로 최초 로그인 (PIN 미설정자)
  const handleFirstLogin = async () => {
    if (!sabun) return;
    await loginWithPin(sabun, ''); // 빈 PIN → 서버에서 must_change_pin이면 허용
  };

  const handlePinLogin = async () => {
    if (!sabun || !pin) return;
    await loginWithPin(sabun, pin);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (hasBiometric) handlePinLogin();
      else if (pin) handlePinLogin();
      else handleFirstLogin();
    }
  };

  return (
    <div className={styles.gate}>
      <div className={styles.card}>
        <div className={styles.icon}>🚇</div>
        <h1 className={styles.title}>기관사 DIA</h1>
        <p className={styles.subtitle}>답십리 승무사업소 · 5호선</p>

        {/* 사번 입력 */}
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
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoFocus={!lastSabun}
          />
        </div>

        {/* 생체인증 버튼 (등록된 경우) */}
        {hasBiometric && (sabun || lastSabun) && (
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

        {/* 구분선 */}
        {hasBiometric && (sabun || lastSabun) && (
          <div className={styles.divider}>
            <span>또는 PIN으로 로그인</span>
          </div>
        )}

        {/* 생체인증 미등록 시에도 PIN 입력 표시 */}
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
              onKeyDown={handleKeyDown}
              maxLength={10}
              autoComplete="off"
              autoFocus={!!lastSabun}
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

        {hasBiometric && (sabun || lastSabun) ? (
          <button
            type="button"
            className={styles.btn}
            onClick={handlePinLogin}
            disabled={loading || !sabun || !pin}
          >
            <KeyRound size={18} />
            <span>{loading ? '로그인 중...' : 'PIN으로 로그인'}</span>
          </button>
        ) : (
          <button
            type="button"
            className={styles.btn}
            onClick={pin ? handlePinLogin : handleFirstLogin}
            disabled={loading || !sabun}
          >
            <span>{loading ? '확인 중...' : '시작하기'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
