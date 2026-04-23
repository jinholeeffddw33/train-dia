import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlantId } from '@/features/life/dab/plants';

/** 레벨당 필요 포인트 (완화: 10 → 5) */
export const POINTS_PER_LEVEL = 5;
export const MAX_LEVEL = 9;

/** 행동별 획득 포인트 (전반적 상향) */
export const POINT_REWARDS = {
  breath: 5,       // 호흡 세션 1분 완료 (3 → 5, 한 번만 해도 1레벨)
  dailyCheckin: 3, // 하루 첫 접속 (2 → 3)
  quiz: 5,         // 퀴즈 합격 70점+ (3 → 5)
  video: 3,        // 영상 강의 첫 시청 (2 → 3)
  tap: 0.3,        // 나무 터치 (0.1 → 0.3)
  hazard: 3,       // 안전 제보 작성
};

/** 오늘 터치로 얻을 수 있는 최대 포인트 (1.5 → 3.0) */
const DAILY_TAP_CAP = 3.0;
/** 스트릭 보너스 상한 (+N) — 16일차 이후 고정 +15 */
const MAX_STREAK_BONUS = 15;

interface ActionCounts {
  breath: number;
  quiz: number;
  video: number;
  hazard: number;
}

interface Milestones {
  lv3: boolean;
  lv6: boolean;
}

export interface GrowthResult {
  leveledUp: boolean;
  completed: boolean;
  /** 오늘 첫 성장이면 true (무지개 이펙트용) */
  firstToday: boolean;
  /** 이번 성장으로 도달한 마일스톤 (한 번만 true) */
  milestone: 'lv3' | 'lv6' | null;
}

interface BonsaiState {
  currentPlantId: PlantId;
  level: number;
  points: number;
  collection: PlantId[];
  lastCheckinDate: string;
  streak: number;
  actionCounts: ActionCounts;
  lastReason: string | null;
  todayTapPoints: number;
  lastTapDate: string;
  /** 마지막 성장 발생 날짜 (YYYY-MM-DD) — 오늘 첫 성장 판별용 */
  lastGrowthDate: string;
  /** 식물별 마일스톤 달성 여부 (현재 식물 기준) */
  milestones: Milestones;

  addPoints: (amount: number, reason: string) => GrowthResult;
  completeBreath: () => GrowthResult;
  dailyCheckin: () => boolean;
  recordQuizPass: () => GrowthResult;
  recordVideoComplete: () => GrowthResult;
  recordTap: () => GrowthResult & { capped: boolean };
  switchPlant: (id: PlantId) => void;
  resetCurrent: () => void;
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
      lastGrowthDate: '',
      milestones: { lv3: false, lv6: false },

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

        let newCollection = s.collection;
        if (newLevel >= MAX_LEVEL) {
          newPoints = POINTS_PER_LEVEL;
          if (!s.collection.includes(s.currentPlantId)) {
            newCollection = [...s.collection, s.currentPlantId];
            completed = true;
          }
        }

        // 오늘 첫 성장 판별
        const today = todayStr();
        const firstToday = leveledUp && s.lastGrowthDate !== today;

        // 마일스톤 (레벨 3 · 6 처음 도달 시 한 번만)
        let milestone: 'lv3' | 'lv6' | null = null;
        const newMilestones = { ...s.milestones };
        if (!s.milestones.lv3 && newLevel >= 3) {
          newMilestones.lv3 = true;
          milestone = 'lv3';
        }
        if (!s.milestones.lv6 && newLevel >= 6) {
          newMilestones.lv6 = true;
          milestone = 'lv6'; // lv6이 더 큰 이벤트이므로 덮어씀
        }

        set({
          level: newLevel,
          points: newPoints,
          collection: newCollection,
          lastReason: reason,
          lastGrowthDate: leveledUp ? today : s.lastGrowthDate,
          milestones: newMilestones,
        });

        return { leveledUp, completed, firstToday, milestone };
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

        const yesterday = yesterdayStr();
        const newStreak = s.lastCheckinDate === yesterday ? s.streak + 1 : 1;

        // 스트릭 선형 보너스 — N일차 = 기본 + (N-1), 상한 MAX_STREAK_BONUS
        const streakBonus = Math.min(MAX_STREAK_BONUS, newStreak - 1);
        const total = POINT_REWARDS.dailyCheckin + streakBonus;

        set({ lastCheckinDate: today, streak: newStreak });

        const reason = streakBonus > 0
          ? `출근 ${newStreak}일 연속 (+${streakBonus} 보너스)`
          : `출근 ${newStreak}일차`;
        get().addPoints(total, reason);
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
          return { leveledUp: false, completed: false, firstToday: false, milestone: null, capped: true };
        }
        const grant = Math.min(POINT_REWARDS.tap, DAILY_TAP_CAP - todayTaps);
        set({ todayTapPoints: todayTaps + grant, lastTapDate: today });
        const res = get().addPoints(grant, '정성');
        return { ...res, capped: false };
      },

      switchPlant: (id) =>
        set({
          currentPlantId: id,
          level: 0,
          points: 0,
          lastReason: null,
          milestones: { lv3: false, lv6: false },
        }),

      resetCurrent: () =>
        set({
          level: 0,
          points: 0,
          lastReason: null,
          milestones: { lv3: false, lv6: false },
        }),

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
          lastGrowthDate: '',
          milestones: { lv3: false, lv6: false },
        }),
    }),
    {
      name: 'train-dia-bonsai',
      version: 2,
    },
  ),
);
