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
    if (user && user.personId) {
      const { myDriver, setMyDriverById } = useDriverStore.getState();
      // myDriver가 없거나 다른 사람이면 인증된 사용자로 설정
      if (!myDriver || myDriver.I !== user.personId) {
        setMyDriverById(user.personId);
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

  // PIN 변경 화면 (최초 로그인 시)
  if (screen === 'pin-change') {
    const handleChangePin = async () => {
      setPinChangeError('');
      if (newPin.length < 6) {
        setPinChangeError('PIN은 6자리 이상이어야 합니다');
        return;
      }
      if (newPin !== newPinConfirm) {
        setPinChangeError('새 PIN이 일치하지 않습니다');
        return;
      }
      const ok = await changePin(currentPin, newPin);
      if (ok) {
        setScreen('biometric-setup');
      }
    };

    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <ShieldCheck size={40} className={styles.iconBlue} />
          </div>
          <h1 className={styles.title}>PIN 변경</h1>
          <p className={styles.subtitle}>보안을 위해 PIN을 변경해주세요</p>

          <div className={styles.inputGroup}>
            <label htmlFor="current-pin" className={styles.label}>현재 PIN (사번 뒤 6자리)</label>
            <input
              id="current-pin"
              type="password"
              inputMode="numeric"
              className={styles.input}
              placeholder="● ● ● ● ● ●"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              maxLength={10}
              autoFocus
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="new-pin" className={styles.label}>새 PIN (6자리 이상)</label>
            <input
              id="new-pin"
              type="password"
              inputMode="numeric"
              className={styles.input}
              placeholder="● ● ● ● ● ●"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              maxLength={10}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="new-pin-confirm" className={styles.label}>새 PIN 확인</label>
            <input
              id="new-pin-confirm"
              type="password"
              inputMode="numeric"
              className={styles.input}
              placeholder="● ● ● ● ● ●"
              value={newPinConfirm}
              onChange={(e) => setNewPinConfirm(e.target.value)}
              maxLength={10}
            />
          </div>

          {(pinChangeError || error) && (
            <p className={styles.error}>{pinChangeError || error}</p>
          )}

          <button
            type="button"
            className={styles.btn}
            onClick={handleChangePin}
            disabled={loading}
          >
            {loading ? '변경 중...' : 'PIN 변경'}
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

  const handlePinLogin = async () => {
    if (!sabun) return;
    if (!pin) return;
    await loginWithPin(sabun, pin);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePinLogin();
  };

  return (
    <div className={styles.gate}>
      <div className={styles.card}>
        <div className={styles.icon}>🚇</div>
        <h1 className={styles.title}>기관사 DIA</h1>
        <p className={styles.subtitle}>답십리 승무사업소 · 5호선</p>

        {/* 최초 안내 (생체인증 미등록 = 처음 오는 사용자) */}
        {!hasBiometric && (
          <div className={styles.notice}>
            <p className={styles.noticeTitle}>보안 업데이트 안내</p>
            <p className={styles.noticeText}>
              보안 강화를 위해 로그인이 필요합니다.
            </p>
            <p className={styles.noticePin}>
              초기 PIN = <strong>사번 뒤 6자리</strong>
            </p>
            <p className={styles.noticeExample}>
              예: 사번 21714375 → PIN <strong>714375</strong>
            </p>
          </div>
        )}

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

        {/* PIN 입력 */}
        <div className={styles.inputGroup}>
          <label htmlFor="auth-pin" className={styles.label}>PIN</label>
          <div className={styles.pinWrap}>
            <input
              id="auth-pin"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              className={styles.input}
              placeholder="● ● ● ● ● ●"
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

        <button
          type="button"
          className={styles.btn}
          onClick={handlePinLogin}
          disabled={loading || !sabun || !pin}
        >
          <KeyRound size={18} />
          <span>{loading ? '로그인 중...' : 'PIN으로 로그인'}</span>
        </button>
      </div>
    </div>
  );
}
