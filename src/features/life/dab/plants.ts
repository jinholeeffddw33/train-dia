/**
 * 분재 도감 9종 — 한국적 식물 컬렉션
 * 완성 시 다음 씨앗이 해금되며, 특정 계절/조건으로 잠금해제되는 식물도 있음.
 */

export type PlantId =
  | 'pine'
  | 'maehwa'
  | 'maple'
  | 'bamboo'
  | 'orchid'
  | 'camellia'
  | 'cherry'
  | 'chrysanthemum'
  | 'ginkgo';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface UnlockRule {
  type: 'default' | 'collection' | 'breath' | 'season' | 'all';
  /** 필요 개수 (collection/breath) */
  count?: number;
  /** 해금 계절 (season) */
  season?: Season;
}

export interface Plant {
  id: PlantId;
  name: string;
  emoji: string;
  theme: string;
  /** 잎 주 색상 */
  leafColor: string;
  /** 잎 보조 색상 (하이라이트) */
  leafColorAlt: string;
  /** 꽃 색상 (null이면 꽃 없음) */
  flowerColor: string | null;
  /** 줄기 색상 */
  trunkColor: string;
  /** 해금 규칙 */
  unlock: UnlockRule;
}

export const PLANTS: Plant[] = [
  {
    id: 'pine',
    name: '소나무',
    emoji: '🌲',
    theme: '우직한 운행',
    leafColor: '#15803d',
    leafColorAlt: '#22c55e',
    flowerColor: null,
    trunkColor: '#44403c',
    unlock: { type: 'default' },
  },
  {
    id: 'maehwa',
    name: '매화',
    emoji: '🌸',
    theme: '이른 봄의 희망',
    leafColor: '#65a30d',
    leafColorAlt: '#a3e635',
    flowerColor: '#f9a8d4',
    trunkColor: '#57534e',
    unlock: { type: 'collection', count: 1 },
  },
  {
    id: 'maple',
    name: '단풍',
    emoji: '🍁',
    theme: '가을 감성',
    leafColor: '#dc2626',
    leafColorAlt: '#fca5a5',
    flowerColor: null,
    trunkColor: '#3f3f46',
    unlock: { type: 'collection', count: 2 },
  },
  {
    id: 'bamboo',
    name: '대나무',
    emoji: '🎋',
    theme: '곧은 자세',
    leafColor: '#16a34a',
    leafColorAlt: '#6ee7b7',
    flowerColor: null,
    trunkColor: '#84cc16',
    unlock: { type: 'collection', count: 3 },
  },
  {
    id: 'orchid',
    name: '난초',
    emoji: '🪴',
    theme: '절제의 미',
    leafColor: '#0d9488',
    leafColorAlt: '#5eead4',
    flowerColor: '#c084fc',
    trunkColor: '#475569',
    unlock: { type: 'breath', count: 30 },
  },
  {
    id: 'camellia',
    name: '동백',
    emoji: '🌺',
    theme: '붉은 겨울',
    leafColor: '#047857',
    leafColorAlt: '#34d399',
    flowerColor: '#dc2626',
    trunkColor: '#292524',
    unlock: { type: 'season', season: 'winter' },
  },
  {
    id: 'cherry',
    name: '벚나무',
    emoji: '🌸',
    theme: '화려한 봄',
    leafColor: '#86efac',
    leafColorAlt: '#bbf7d0',
    flowerColor: '#fbcfe8',
    trunkColor: '#57534e',
    unlock: { type: 'season', season: 'spring' },
  },
  {
    id: 'chrysanthemum',
    name: '국화',
    emoji: '🌼',
    theme: '깊은 가을',
    leafColor: '#16a34a',
    leafColorAlt: '#86efac',
    flowerColor: '#fbbf24',
    trunkColor: '#3f3f46',
    unlock: { type: 'season', season: 'autumn' },
  },
  {
    id: 'ginkgo',
    name: '은행',
    emoji: '🌳',
    theme: '오랜 세월',
    leafColor: '#eab308',
    leafColorAlt: '#fde047',
    flowerColor: null,
    trunkColor: '#1c1917',
    unlock: { type: 'all' },
  },
];

export function getPlant(id: PlantId): Plant {
  return PLANTS.find((p) => p.id === id) ?? PLANTS[0];
}

/** 현재 월 기준 계절 */
export function currentSeason(date: Date = new Date()): Season {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

export function seasonLabel(s: Season): string {
  return { spring: '봄', summer: '여름', autumn: '가을', winter: '겨울' }[s];
}

/** 특정 식물이 해금되었는지 */
export function isUnlocked(
  plant: Plant,
  ctx: {
    collection: string[];
    breathSessions: number;
    season: Season;
  },
): boolean {
  const { unlock } = plant;
  switch (unlock.type) {
    case 'default':
      return true;
    case 'collection':
      return ctx.collection.length >= (unlock.count ?? 0);
    case 'breath':
      return ctx.breathSessions >= (unlock.count ?? 0);
    case 'season':
      return ctx.season === unlock.season;
    case 'all':
      // 나머지 8종 모두 완성해야 마지막 해금
      return ctx.collection.length >= PLANTS.length - 1;
  }
}

/** 해금 조건 설명 */
export function unlockHint(plant: Plant): string {
  const { unlock } = plant;
  switch (unlock.type) {
    case 'default':
      return '처음 씨앗';
    case 'collection':
      return `분재 ${unlock.count}종 완성`;
    case 'breath':
      return `호흡 세션 ${unlock.count}회`;
    case 'season':
      return `${seasonLabel(unlock.season!)}에만 해금`;
    case 'all':
      return '모든 분재 완성 시';
  }
}
