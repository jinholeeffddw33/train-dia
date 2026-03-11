import { create } from 'zustand';

type Branch = 'main' | 'macheon' | 'hanam';
type ViewMode = 'list' | 'map';

interface TrainPosition {
  statnNm: string;
  trainNo: string;
  updnLine: string;
  statnTnm: string;
  bstatnNm: string;
  recptnDt: string;
  trainSttus: string;
  directAt: string;
  lstcarAt: string;
}

interface TrainState {
  /** 열차 위치 데이터 */
  data: TrainPosition[];
  /** 마지막 갱신 시각 */
  lastFetch: number | null;
  /** 현재 지선 */
  branch: Branch;
  /** 보기 모드 */
  viewMode: ViewMode;
  /** 로딩 상태 */
  loading: boolean;
  /** 에러 */
  error: string | null;
  /** 맵 줌 레벨 */
  mapZoom: number;
  /** 전체화면 여부 */
  mapFullscreen: boolean;
  /** 답십리 스크롤 트리거 (탭 재클릭 시 증가) */
  scrollTrigger: number;

  setData: (data: TrainPosition[]) => void;
  setBranch: (branch: Branch) => void;
  setViewMode: (mode: ViewMode) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setMapZoom: (zoom: number) => void;
  toggleFullscreen: () => void;
  triggerScroll: () => void;
}

export const useTrainStore = create<TrainState>()((set) => ({
  data: [],
  lastFetch: null,
  branch: 'main',
  viewMode: 'list',
  loading: false,
  error: null,
  mapZoom: 1,
  mapFullscreen: false,
  scrollTrigger: 0,

  setData: (data) => set({ data, lastFetch: Date.now(), error: null }),
  setBranch: (branch) => set({ branch }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setMapZoom: (zoom) => set({ mapZoom: Math.max(1, Math.min(3, zoom)) }),
  toggleFullscreen: () => set((s) => ({ mapFullscreen: !s.mapFullscreen })),
  triggerScroll: () => set((s) => ({ scrollTrigger: s.scrollTrigger + 1 })),
}));
