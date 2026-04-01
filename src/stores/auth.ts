import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export interface AuthUser {
  id: string;
  name: string;
  sabun: string;
  personId: string;
  role: 'driver' | 'admin';
  mustChangePin?: boolean;
}

interface AuthState {
  /** 로그인된 사용자 (null이면 미인증) */
  user: AuthUser | null;
  /** 이 기기에 생체인증 등록 여부 */
  hasBiometric: boolean;
  /** 마지막 로그인한 사번 (자동 입력용) */
  lastSabun: string;
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 메시지 */
  error: string;

  // ── 액션 ──
  /** PIN 로그인 */
  loginWithPin: (sabun: string, pin: string) => Promise<boolean>;
  /** 생체인증 로그인 */
  loginWithBiometric: (sabun: string) => Promise<boolean>;
  /** 생체인증 등록 */
  registerBiometric: () => Promise<boolean>;
  /** 세션 확인 (앱 시작 시) */
  checkSession: () => Promise<void>;
  /** 로그아웃 */
  logout: () => Promise<void>;
  /** PIN 변경 */
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  /** 에러 초기화 */
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      hasBiometric: false,
      lastSabun: '',
      loading: false,
      error: '',

      loginWithPin: async (sabun, pin) => {
        set({ loading: true, error: '' });
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sabun, pin }),
          });
          const data = await res.json();

          if (!res.ok) {
            set({ loading: false, error: data.message || '로그인에 실패했습니다' });
            return false;
          }

          set({
            user: data.user,
            lastSabun: sabun,
            hasBiometric: data.user.hasBiometric || get().hasBiometric,
            loading: false,
            error: '',
          });
          return true;
        } catch {
          set({ loading: false, error: '네트워크 오류. 인터넷 연결을 확인해주세요' });
          return false;
        }
      },

      loginWithBiometric: async (sabun) => {
        set({ loading: true, error: '' });
        try {
          // 1. 인증 옵션 가져오기
          const optRes = await fetch(`/api/auth/webauthn/login?sabun=${encodeURIComponent(sabun)}`);
          const optData = await optRes.json();

          if (!optRes.ok) {
            set({ loading: false, error: optData.message || '생체인증 준비에 실패했습니다' });
            return false;
          }

          const { userId, ...options } = optData;

          // 2. 브라우저 생체인증 시작
          const credential = await startAuthentication({ optionsJSON: options });

          // 3. 서버 검증
          const verifyRes = await fetch('/api/auth/webauthn/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, credential }),
          });
          const verifyData = await verifyRes.json();

          if (!verifyRes.ok) {
            set({ loading: false, error: verifyData.message || '생체인증에 실패했습니다' });
            return false;
          }

          set({
            user: verifyData.user,
            lastSabun: sabun,
            loading: false,
            error: '',
          });
          return true;
        } catch (err) {
          const message = err instanceof Error && err.name === 'NotAllowedError'
            ? '생체인증이 취소되었습니다'
            : '생체인증에 실패했습니다. PIN으로 로그인해주세요';
          set({ loading: false, error: message });
          return false;
        }
      },

      registerBiometric: async () => {
        set({ loading: true, error: '' });
        try {
          // 1. 등록 옵션 가져오기
          const optRes = await fetch('/api/auth/webauthn/register');
          const options = await optRes.json();

          if (!optRes.ok) {
            set({ loading: false, error: options.message || '생체인증 등록 준비에 실패했습니다' });
            return false;
          }

          // 2. 브라우저 생체인증 등록
          const credential = await startRegistration({ optionsJSON: options });

          // 3. 서버 검증 + 저장
          const verifyRes = await fetch('/api/auth/webauthn/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credential),
          });
          const verifyData = await verifyRes.json();

          if (!verifyRes.ok) {
            set({ loading: false, error: verifyData.message || '생체인증 등록에 실패했습니다' });
            return false;
          }

          set({ hasBiometric: true, loading: false, error: '' });
          return true;
        } catch (err) {
          let message: string;
          if (err instanceof Error) {
            if (err.name === 'NotAllowedError') {
              message = '생체인증 등록이 취소되었습니다';
            } else {
              message = `생체인증 오류: ${err.name} — ${err.message}`;
            }
          } else {
            message = `생체인증 등록 실패: ${String(err)}`;
          }
          set({ loading: false, error: message });
          return false;
        }
      },

      checkSession: async () => {
        try {
          const res = await fetch('/api/auth/me');
          const data = await res.json();
          if (data.user) {
            set({ user: data.user });
          } else {
            set({ user: null });
          }
        } catch {
          set({ user: null });
        }
      },

      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
          // 네트워크 실패해도 로컬은 정리
        }
        set({ user: null });
      },

      changePin: async (currentPin, newPin) => {
        set({ loading: true, error: '' });
        try {
          const res = await fetch('/api/auth/pin/change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPin, newPin }),
          });
          const data = await res.json();

          if (!res.ok) {
            set({ loading: false, error: data.message || 'PIN 변경에 실패했습니다' });
            return false;
          }

          // mustChangePin 해제
          const user = get().user;
          if (user) {
            set({ user: { ...user, mustChangePin: false }, loading: false, error: '' });
          }
          return true;
        } catch {
          set({ loading: false, error: '네트워크 오류. 인터넷 연결을 확인해주세요' });
          return false;
        }
      },

      clearError: () => set({ error: '' }),
    }),
    {
      name: 'traindia-auth',
      partialize: (state) => ({
        hasBiometric: state.hasBiometric,
        lastSabun: state.lastSabun,
      }),
    },
  ),
);
