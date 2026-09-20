/**
 * 공지(점호)사항 — 게시판 하나를 세 곳이 같이 본다.
 *   · 홈 «공지(점호)» 아이콘(새 글 빨간 점)
 *   · 안전 첫 화면의 공지 칸(맨 위 항목 미리보기)
 *   · 점호 시트(전체 보기·고치기)
 * 게시판이 하나뿐이라 자료도 한 벌만 들고 있으면 된다. 저장(persist)하지 않는다 —
 * 점호 사항은 언제나 서버의 최신본이어야 한다.
 */
import { create } from 'zustand';

export interface RollCallItem {
  id: string;
  text: string;
  detail?: string;
}

interface RollCallState {
  open: boolean;
  items: RollCallItem[];
  attachmentUrl: string | null;
  attachmentName: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  loading: boolean;
  error: boolean;
  loaded: boolean;
  openBoard: () => void;
  closeBoard: () => void;
  /** 서버에서 다시 읽는다. 이미 읽었으면 다시 읽지 않는다(force 로 강제). */
  load: (force?: boolean) => Promise<void>;
  /** 지금 본 것으로 표시 — 홈 아이콘의 빨간 점이 사라진다 */
  markSeen: () => void;
}

const SEEN_KEY = 'rollcall-seen-at';
let inFlight: Promise<void> | null = null;

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export const useRollCallStore = create<RollCallState>((set, get) => ({
  open: false,
  items: [],
  attachmentUrl: null,
  attachmentName: null,
  updatedBy: null,
  updatedAt: null,
  loading: false,
  error: false,
  loaded: false,

  openBoard: () => {
    set({ open: true });
    get().load(true);
    get().markSeen();
  },
  closeBoard: () => set({ open: false }),

  load: async (force = false) => {
    if (!force && (get().loaded || inFlight)) return;
    if (inFlight) return inFlight;
    set({ loading: true, error: false });
    inFlight = fetch('/api/rollcall', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('rollcall'))))
      .then((d) => {
        set({
          items: Array.isArray(d.items) ? d.items : [],
          attachmentUrl: d.attachmentUrl ?? null,
          attachmentName: d.attachmentName ?? null,
          updatedBy: d.updatedBy ?? null,
          updatedAt: d.updatedAt ?? null,
          loaded: true,
          loading: false,
          error: false,
        });
      })
      .catch(() => set({ loading: false, error: true }))
      .finally(() => { inFlight = null; });
    return inFlight;
  },

  markSeen: () => {
    const at = get().updatedAt;
    try {
      localStorage.setItem(SEEN_KEY, at ?? new Date().toISOString());
    } catch { /* ignore */ }
  },
}));

/** 마지막으로 본 뒤에 바뀌었는가 — 홈 아이콘의 빨간 점 */
export function hasUnseenRollCall(items: RollCallItem[], updatedAt: string | null): boolean {
  if (!updatedAt || items.length === 0) return false;
  const seen = readSeen();
  return !seen || updatedAt > seen;
}
