import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// dynamic import — 일부 브라우저에서 모듈 로드 에러 방지
async function getWebAuthn() {
  const mod = await import('@simplewebauthn/browser');
  return mod;
}

export interface AuthUser {
  id: string;
  name: string;
  sabun: string;
  personId: string;
  role: 'driver' | 'admin';
  mustChangePin?: boolean;
}

export interface SabunStatus {
  exists: boolean;
  isAdmin: boolean;
  mustChangePin: boolean;
  hasBiometric: boolean;
}

interface AuthState {
  /** 로그인된 사용자 (null이면 미인증) */
  user: AuthUser | null;
  /**
   * 오프라인 세션 그레이스 — checkSession이 네트워크 실패했을 때
   * persist된 user를 유지한 채 true. 온라인 복귀 후 재검증 성공 시 해제.
   * 보안: 서버 API는 어차피 쿠키로 검증하므로 클라이언트 user 유지는 표시용일 뿐.
   */
  offlineGrace: boolean;
  /** 이 기기에 생체인증 등록 여부 (서버 기준) */
  hasBiometric: boolean;
  /** 마지막 로그인한 사번 (자동 입력용) */
  lastSabun: string;
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 메시지 */
  error: string;

  // ── 액션 ──
  /** 사번으로 계정 상태 조회 (로그인 전) */
  checkSabun: (sabun: string) => Promise<SabunStatus | null>;
  /** PIN 로그인 */
  loginWithPin: (sabun: string, pin: string) => Promise<boolean>;
  /** 이름 로그인 (일반 사용자) */
  loginWithName: (sabun: string, name: string) => Promise<boolean>;
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
      offlineGrace: false,
      hasBiometric: false,
      lastSabun: '',
      loading: false,
      error: '',

      checkSabun: async (sabun) => {
        set({ loading: true, error: '' });
        try {
          const res = await fetch(`/api/auth/check-sabun?sabun=${encodeURIComponent(sabun)}`);
          const data = await res.json();
          if (!res.ok) {
            set({ loading: false, error: data.message || '사번을 확인할 수 없습니다' });
            return null;
          }
          // 서버에서 받은 hasBiometric으로 로컬 상태 동기화
          set({ hasBiometric: data.hasBiometric, loading: false, error: '' });
          return data as SabunStatus;
        } catch {
          set({ loading: false, error: '네트워크 오류. 인터넷 연결을 확인해주세요' });
          return null;
        }
      },

      loginWithPin: async (sabun, pin) => {
        set({ loading: true, error: '' });
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sabun, ...(pin ? { pin } : {}) }),
          });
          const data = await res.json();

          if (!res.ok) {
            set({ loading: false, error: data.message || '로그인에 실패했습니다' });
            return false;
          }

          set({
            user: data.user,
            offlineGrace: false,
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

      loginWithName: async (sabun, name) => {
        set({ loading: true, error: '' });
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sabun, name }),
          });
          const data = await res.json();

          if (!res.ok) {
            set({ loading: false, error: data.message || '로그인에 실패했습니다' });
            return false;
          }

          set({
            user: data.user,
            offlineGrace: false,
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
          const { startAuthentication } = await getWebAuthn();
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
            offlineGrace: false,
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
          const { startRegistration } = await getWebAuthn();
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
            // 재검증 성공 → 그레이스 해제
            set({ user: data.user, offlineGrace: false });
          } else {
            // 서버가 응답했는데 세션 무효(401/403 등) → 진짜 로그아웃
            set({ user: null, offlineGrace: false });
          }
        } catch {
          // 네트워크 실패(오프라인/서버 불통) — 세션 무효와 구분한다.
          // persist된 user가 있으면 표시용으로 유지(오프라인 그레이스).
          // 보안: 서버 API는 쿠키를 다시 검증하므로 클라이언트 user 유지는 표시용일 뿐이다.
          if (get().user) {
            set({ offlineGrace: true });
          } else {
            set({ user: null, offlineGrace: false });
          }
        }
      },

      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
          // 네트워크 실패해도 로컬은 정리
        }
        set({ user: null, offlineGrace: false });
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
        // user 포함 — 오프라인 그레이스용 표시 정보. 실제 인가는 서버가 쿠키로 검증한다.
        user: state.user,
        hasBiometric: state.hasBiometric,
        lastSabun: state.lastSabun,
      }),
    },
  ),
);
