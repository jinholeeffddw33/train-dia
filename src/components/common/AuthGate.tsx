'use client';

import { useEffect, useState } from 'react';
import { useAuthStore, type SabunStatus } from '@/stores/auth';
import { useDriverStore } from '@/stores/driver';
import { KeyRound, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import styles from './AuthGate.module.css';

type Screen =
  | 'loading'
  | 'sabun'
  | 'notice'         // 관리자 첫 방문: PIN 0000 안내
  | 'login'          // 일반: 이름 입력 / 관리자: PIN 입력
  | 'pin-setup';     // 관리자 PIN 최초 설정

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

  // ── 앱 시작 시 세션 확인 ──
  useEffect(() => {
    checkSession().then(() => setSessionChecked(true));
  }, [checkSession]);

  // ── 로그인 성공 시 driver store 연동 ──
  useEffect(() => {
    if (user?.sabun) {
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
  }, [user]);

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

  // ── 인증 완료 → 앱 렌더 ──
  if (user && screen !== 'pin-setup') {
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
      if (!status) return;
      setSabunStatus(status);
      if (status.isAdmin && status.mustChangePin) {
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

  // ── 관리자 첫 방문 안내 (PIN 0000) ──
  if (screen === 'notice') {
    const handleStart = async () => {
      const ok = await loginWithPin(sabun, '');
      if (ok) setScreen('pin-setup');
    };

    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <ShieldCheck size={40} className={styles.iconBlue} />
          </div>
          <h1 className={styles.title}>관리자 보안 설정</h1>
          <p className={styles.subtitle}>
            관리자 계정은 PIN으로 보호됩니다.<br />
            처음 접속 시 새 PIN을 설정해주세요.
          </p>

          <div className={styles.steps}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <span className={styles.stepText}>아래 버튼을 눌러 시작</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <span className={styles.stepText}>본인만의 새 PIN 설정</span>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <span className={styles.stepText}>다음부터는 PIN으로 로그인</span>
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.btn}
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className={styles.spinnerInline} /> : null}
            <span>{loading ? '잠시만요...' : 'PIN 설정 시작 →'}</span>
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
        if (!name.trim()) return;
        await loginWithName(sabun, name.trim());
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
                className={styles.input}
                placeholder="홍길동"
                value={name}
                onChange={(e) => { setName(e.target.value); clearError(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNameLogin(); }}
                autoComplete="off"
                autoFocus
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              type="button"
              className={styles.btn}
              onClick={handleNameLogin}
              disabled={loading || !name.trim()}
            >
              {loading ? <Loader2 size={18} className={styles.spinnerInline} /> : null}
              <span>{loading ? '로그인 중...' : '로그인'}</span>
            </button>

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

  return null;
}
