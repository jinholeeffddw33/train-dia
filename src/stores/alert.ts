import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

/** DB 알림 행 타입 */
interface DbAlert {
  id: string;
  station_from: string;
  station_to: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  created_by: string;
  created_at: string;
  is_active: boolean;
}

/** 프론트 Alert 타입 */
export interface AlertItem {
  id: string;
  stationFrom: string;
  stationTo: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  createdBy: string;
  created_at: string;
}

/** DB → 프론트 변환 */
function toAlert(row: DbAlert): AlertItem {
  return {
    id: row.id,
    stationFrom: row.station_from,
    stationTo: row.station_to,
    message: row.message,
    severity: row.severity,
    createdBy: row.created_by,
    created_at: row.created_at,
  };
}

interface AlertState {
  alerts: AlertItem[];
  loading: boolean;
  /** 서버에서 활성 알림 가져오기 */
  fetch: () => Promise<void>;
  /** 알림 등록 (Supabase에 저장) */
  addAlert: (params: {
    stationFrom: string;
    stationTo: string;
    message: string;
    severity: 'high' | 'medium' | 'low';
    authorName: string;
  }) => Promise<void>;
  /** 알림 해제 (is_active = false) */
  deactivate: (id: string) => Promise<void>;
  /** 실시간 구독 시작 */
  subscribe: () => () => void;
}

export const useAlertStore = create<AlertState>()((set, get) => ({
  alerts: [],
  loading: false,

  fetch: async () => {
    if (!supabase) return;
    set({ loading: true });
    const { data, error } = await supabase
      .from('alerts')
      .select('id,station_from,station_to,message,severity,created_by,created_at,is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      set({ alerts: (data as DbAlert[]).map(toAlert) });
    }
    set({ loading: false });
  },

  addAlert: async ({ stationFrom, stationTo, message, severity, authorName }) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('alerts')
      .insert({
        station_from: stationFrom,
        station_to: stationTo,
        station: stationFrom,
        message,
        severity,
        created_by: authorName,
        is_active: true,
      })
      .select()
      .single();

    if (!error && data) {
      set((state) => ({
        alerts: [toAlert(data as DbAlert), ...state.alerts],
      }));
    }
  },

  deactivate: async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('alerts')
      .update({ is_active: false })
      .eq('id', id);

    if (!error) {
      set((state) => ({
        alerts: state.alerts.filter((a) => a.id !== id),
      }));
    }
  },

  subscribe: () => {
    if (!supabase) return () => {};

    const channel = supabase
      .channel('alerts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        () => {
          get().fetch();
        },
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  },
}));
