import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase-lazy';

/** DB 알림 행 타입 */
interface DbAlert {
  id: string;
  station_from: string;
  station_to: string;
  direction: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  created_by: string;
  created_at: string;
  is_active: boolean;
  expires_at: string | null;
}

/** 프론트 Alert 타입 */
export interface AlertItem {
  id: string;
  stationFrom: string;
  stationTo: string;
  direction: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  createdBy: string;
  created_at: string;
  expires_at: string | null;
}

/** DB → 프론트 변환 */
function toAlert(row: DbAlert): AlertItem {
  return {
    id: row.id,
    stationFrom: row.station_from,
    stationTo: row.station_to,
    direction: row.direction || '',
    message: row.message,
    severity: row.severity,
    createdBy: row.created_by,
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

interface AlertState {
  alerts: AlertItem[];
  loading: boolean;
  /** 서버에서 활성 알림 가져오기 */
  fetch: () => Promise<void>;
  /** 알림 등록 (API 서버 검증 후 저장) */
  addAlert: (params: {
    stationFrom: string;
    stationTo: string;
    direction: string;
    message: string;
    severity: 'high' | 'medium' | 'low';
    authorName: string;
    authorSabun: string;
    expiresAt?: string | null;
  }) => Promise<void>;
  /** 알림 해제 (API 서버 검증 후 비활성화) */
  deactivate: (id: string, name: string, sabun: string) => Promise<void>;
  /** 실시간 구독 시작 */
  subscribe: () => () => void;
}

export const useAlertStore = create<AlertState>()((set, get) => ({
  alerts: [],
  loading: false,

  fetch: async () => {
    const sb = await getSupabase();
    if (!sb) return;
    set({ loading: true });
    const { data, error } = await sb
      .from('alerts')
      .select('id,station_from,station_to,direction,message,severity,created_by,created_at,is_active,expires_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const now = new Date().toISOString();
      set({
        alerts: (data as DbAlert[])
          .filter((row) => !row.expires_at || row.expires_at > now)
          .map(toAlert),
      });
    }
    set({ loading: false });
  },

  addAlert: async ({ stationFrom, stationTo, direction, message, severity, authorName, authorSabun, expiresAt }) => {
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: authorName,
        sabun: authorSabun,
        stationFrom,
        stationTo,
        direction: direction || '',
        message,
        severity,
        expiresAt: expiresAt || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || '알림 등록에 실패했습니다');
    }

    // 실시간 구독이 fetch를 트리거하므로, 구독 없을 때를 위해 직접 fetch
    get().fetch();
  },

  deactivate: async (id: string, name: string, sabun: string) => {
    const params = new URLSearchParams({ id, name, sabun });
    const res = await fetch(`/api/alerts?${params}`, { method: 'DELETE' });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || '알림 해제에 실패했습니다');
    }

    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id),
    }));
  },

  subscribe: () => {
    // supabase-js 지연 로드 — 구독은 클라이언트 준비 후 비동기로 연결
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    getSupabase().then((sb) => {
      if (!sb || cancelled) return;
      channel = sb
        .channel('alerts-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'alerts' },
          () => {
            get().fetch();
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) {
        const ch = channel;
        getSupabase().then((sb) => { sb?.removeChannel(ch); });
      }
    };
  },
}));
