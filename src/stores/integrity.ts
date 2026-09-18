/**
 * 청렴 경진대회 — 시트 열기와 «나는 냈는가».
 *
 * 같은 화면을 세 곳에서 부른다: 홈의 청렴 아이콘, 진입 팝업의 «바로 응시하기», 그리고 시트 자신.
 * 서로 부모-자식이 아니라서 작은 스토어 하나로 잇는다.
 *
 * 응시 여부는 홈의 빨간 점과 팝업 노출을 함께 결정한다. 두 곳이 각자 물어보면
 * 홈에 들어올 때마다 같은 질문이 두 번 나가므로, 여기서 한 번만 묻고 나눠 쓴다.
 * 저장(persist)하지 않는다 — 앱을 다시 켜면 서버에 다시 묻는 게 맞다(다른 기기에서 냈을 수 있다).
 */
import { create } from 'zustand';

interface IntegrityState {
  open: boolean;
  /** null = 아직 모름 */
  submitted: boolean | null;
  /** 서버에 한 번은 물어봤는가(실패해도 true) — 물어보기 전에 팝업을 띄우지 않으려고 둔다 */
  statusChecked: boolean;
  openQuiz: () => void;
  closeQuiz: () => void;
  setSubmitted: (v: boolean) => void;
  /** 아직 모를 때만 서버에 묻는다 */
  ensureStatus: () => void;
}

let inFlight: Promise<void> | null = null;

export const useIntegrityStore = create<IntegrityState>((set, get) => ({
  open: false,
  submitted: null,
  statusChecked: false,
  openQuiz: () => set({ open: true }),
  closeQuiz: () => set({ open: false }),
  setSubmitted: (v) => set({ submitted: v, statusChecked: true }),
  ensureStatus: () => {
    if (get().statusChecked || inFlight) return;
    inFlight = fetch('/api/integrity/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { submitted?: boolean } | null) => {
        if (s && typeof s.submitted === 'boolean') set({ submitted: s.submitted });
      })
      .catch(() => { /* 모르는 채로 둔다 — submitted 는 null 로 남는다 */ })
      .finally(() => {
        inFlight = null;
        set({ statusChecked: true });
      });
  },
}));
