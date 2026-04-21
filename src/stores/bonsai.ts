import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlantId } from '@/features/life/dab/plants';

/** 레벨당 필요 포인트 */
export const POINTS_PER_LEVEL = 10;
export const MAX_LEVEL = 9;

/** 행동별 획득 포인트 */
export const POINT_REWARDS = {
  breath: 3,       // 호흡 세션 1분 완료
  dailyCheckin: 2, // 하루 첫 접속
  quiz: 3,         // 퀴즈 합격 (70점+)
  video: 2,        // 영상 강의 완주
  tap: 0.1,        // 나무 터치 (최대치 있음)
  hazard: 2,       // 안전 제보 작성
};

/** 오늘 터치로 얻을 수 있는 최대 포인트 (어뷰징 방지) */
const DAILY_TAP_CAP = 1.5;

interface ActionCounts {
  breath: number;
  quiz: number;
  video: number;
  hazard: number;
}

interface BonsaiState {
  /** 현재 키우는 식물 id */
  currentPlantId: PlantId;
  /** 현재 레벨 (0-9) */
  level: number;
  /** 현재 레벨 내 포인트 진행도 (0 ~ POINTS_PER_LEVEL) */
  points: number;
  /** 완성한 식물 id 목록 */
  collection: PlantId[];
  /** 마지막 출근 체크인 날짜 (YYYY-MM-DD) */
  lastCheckinDate: string;
  /** 연속 접속 일수 */
  streak: number;
  /** 행동별 누적 횟수 (해금 조건용) */
  actionCounts: ActionCounts;
  /** 마지막 성장 사유 (UI 표시용) */
  lastReason: string | null;
  /** 오늘 터치로 얻은 포인트 (DAILY_TAP_CAP 관리) */
  todayTapPoints: number;
  /** 마지막 터치 날짜 (todayTapPoints 리셋용) */
  lastTapDate: string;

  /** 포인트 추가 → 자동으로 레벨업 처리 + 완성 시 도감 추가 */
  addPoints: (amount: number, reason: string) => { leveledUp: boolean; completed: boolean };
  /** 호흡 세션 완료 */
  completeBreath: () => { leveledUp: boolean; completed: boolean };
  /** 하루 첫 접속 체크인 (같은 날 재호출 시 no-op) */
  dailyCheckin: () => boolean;
  /** 퀴즈 합격 */
  recordQuizPass: () => { leveledUp: boolean; completed: boolean };
  /** 영상 시청 완료 */
  recordVideoComplete: () => { leveledUp: boolean; completed: boolean };
  /** 나무 터치 (하루 최대치 제한) */
  recordTap: () => { leveledUp: boolean; completed: boolean; capped: boolean };
  /** 식물 전환 (해금된 식물만 가능, 호출부에서 검증) */
  switchPlant: (id: PlantId) => void;
  /** 현재 분재 리셋 (씨앗 상태로) — 수집품은 유지 */
  resetCurrent: () => void;
  /** 전체 초기화 */
  resetAll: () => void;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const useBonsaiStore = create<BonsaiState>()(
  persist(
    (set, get) => ({
      currentPlantId: 'pine',
      level: 0,
      points: 0,
      collection: [],
      lastCheckinDate: '',
      streak: 0,
      actionCounts: { breath: 0, quiz: 0, video: 0, hazard: 0 },
      lastReason: null,
      todayTapPoints: 0,
      lastTapDate: '',

      addPoints: (amount, reason) => {
        const s = get();
        let newPoints = s.points + amount;
        let newLevel = s.level;
        let leveledUp = false;
        let completed = false;

        while (newPoints >= POINTS_PER_LEVEL && newLevel < MAX_LEVEL) {
          newPoints -= POINTS_PER_LEVEL;
          newLevel += 1;
          leveledUp = true;
        }

        // 최대 레벨 달성 → 도감 추가
        let newCollection = s.collection;
        let nextPlantId = s.currentPlantId;
        if (newLevel >= MAX_LEVEL) {
          newPoints = POINTS_PER_LEVEL; // 가득 찬 상태로 고정
          if (!s.collection.includes(s.currentPlantId)) {
            newCollection = [...s.collection, s.currentPlantId];
            completed = true;
          }
        }

        set({
          level: newLevel,
          points: newPoints,
          collection: newCollection,
          currentPlantId: nextPlantId,
          lastReason: reason,
        });

        return { leveledUp, completed };
      },

      completeBreath: () => {
        const s = get();
        set({ actionCounts: { ...s.actionCounts, breath: s.actionCounts.breath + 1 } });
        return get().addPoints(POINT_REWARDS.breath, '호흡 완료');
      },

      dailyCheckin: () => {
        const s = get();
        const today = todayStr();
        if (s.lastCheckinDate === today) return false;

        // 스트릭 계산
        const yesterday = yesterdayStr();
        const newStreak = s.lastCheckinDate === yesterday ? s.streak + 1 : 1;

        // 스트릭 보너스 (7일/30일 달성 시 ×2)
        let bonus = 1;
        if (newStreak === 7 || newStreak === 30) bonus = 2;

        set({
          lastCheckinDate: today,
          streak: newStreak,
        });
        get().addPoints(POINT_REWARDS.dailyCheckin * bonus, `출근 체크인 (${newStreak}일차)`);
        return true;
      },

      recordQuizPass: () => {
        const s = get();
        set({ actionCounts: { ...s.actionCounts, quiz: s.actionCounts.quiz + 1 } });
        return get().addPoints(POINT_REWARDS.quiz, '퀴즈 합격');
      },

      recordVideoComplete: () => {
        const s = get();
        set({ actionCounts: { ...s.actionCounts, video: s.actionCounts.video + 1 } });
        return get().addPoints(POINT_REWARDS.video, '영상 시청 완료');
      },

      recordTap: () => {
        const s = get();
        const today = todayStr();
        const todayTaps = s.lastTapDate === today ? s.todayTapPoints : 0;
        if (todayTaps >= DAILY_TAP_CAP) {
          return { leveledUp: false, completed: false, capped: true };
        }
        const grant = Math.min(POINT_REWARDS.tap, DAILY_TAP_CAP - todayTaps);
        set({ todayTapPoints: todayTaps + grant, lastTapDate: today });
        const res = get().addPoints(grant, '정성');
        return { ...res, capped: false };
      },

      switchPlant: (id) => set({ currentPlantId: id, level: 0, points: 0, lastReason: null }),

      resetCurrent: () => set({ level: 0, points: 0, lastReason: null }),

      resetAll: () =>
        set({
          currentPlantId: 'pine',
          level: 0,
          points: 0,
          collection: [],
          lastCheckinDate: '',
          streak: 0,
          actionCounts: { breath: 0, quiz: 0, video: 0, hazard: 0 },
          lastReason: null,
          todayTapPoints: 0,
          lastTapDate: '',
        }),
    }),
    {
      name: 'train-dia-bonsai',
      version: 1,
    },
  ),
);
