/**
 * 게시판 익명 가명 시스템.
 *
 * - 사번 + 서버 솔트를 SHA-256으로 해시하여 author_hash 생성 (DB에 저장되는 식별자)
 * - scope별로 다른 가명 부여 ('general' | 'advice') — 고민상담은 별도 가명 풀
 * - 가명은 board_user_aliases 테이블에 deterministic하게 1회 생성·고정
 */
import crypto from 'crypto';
import { serverSupabase } from '@/lib/serverSupabase';

const SALT = process.env.BOARD_HASH_SALT || 'train-dia-board-default-salt-2026';

const ADJECTIVES = [
  '용감한', '신중한', '차분한', '명랑한', '재빠른', '꼼꼼한', '대담한', '온화한',
  '진지한', '활기찬', '느긋한', '단단한', '예리한', '부드러운', '겸손한', '당당한',
  '듬직한', '센스있는', '믿음직한', '맑은', '깊은', '환한', '고요한', '듬뿍한',
  '시원한', '따뜻한', '엉뚱한', '유쾌한', '의연한', '소박한',
];

const NOUNS = [
  '기관차', '선로', '판토', '신호등', '플랫폼', '터널', '레일', '차장',
  '제동', '노치', '환승', '폐색', '구간', '관제', '교번', '운전실',
  '하저', '강동', '답십리', '방화', '마천', '상일동', '한강', '5호선',
  '심야', '새벽', '동료', '베테랑', '신참', '오바',
];

const ADJ_LEN = ADJECTIVES.length;
const NOUN_LEN = NOUNS.length;
const COMBO_SIZE = ADJ_LEN * NOUN_LEN;

export type AliasScope = 'general' | 'advice';

/** 사번 → author_hash (서버 전용) */
export function hashSabun(sabun: string): string {
  return crypto.createHash('sha256').update(sabun + SALT).digest('hex').substring(0, 32);
}

/** scope 포함 deterministic seed */
function aliasSeed(authorHash: string, scope: AliasScope): number {
  const h = crypto.createHash('sha256').update(authorHash + ':' + scope).digest('hex');
  return parseInt(h.substring(0, 8), 16);
}

function aliasFromIndex(idx: number): string {
  const safeIdx = ((idx % COMBO_SIZE) + COMBO_SIZE) % COMBO_SIZE;
  const adj = ADJECTIVES[Math.floor(safeIdx / NOUN_LEN)];
  const noun = NOUNS[safeIdx % NOUN_LEN];
  return adj + noun;
}

/**
 * 사용자 가명 가져오기 또는 생성.
 * 같은 (사번, scope)은 항상 동일 가명 반환. 충돌 시 다음 인덱스로 회피.
 */
export async function getOrCreateAlias(
  sabun: string,
  scope: AliasScope = 'general',
): Promise<{ hash: string; alias: string }> {
  if (!serverSupabase) {
    // DB 미설정 — fallback (개발 환경 안전망)
    const hash = hashSabun(sabun);
    return { hash, alias: aliasFromIndex(aliasSeed(hash, scope)) };
  }

  const hash = hashSabun(sabun);

  // 기존 가명 조회
  const { data: existing } = await serverSupabase
    .from('board_user_aliases')
    .select('alias')
    .eq('author_hash', hash)
    .eq('scope', scope)
    .maybeSingle();

  if (existing?.alias) return { hash, alias: existing.alias };

  // 신규 발급 — 충돌 시 다음 인덱스
  const seed = aliasSeed(hash, scope);
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = aliasFromIndex(seed + attempt);
    const { error } = await serverSupabase
      .from('board_user_aliases')
      .insert({ author_hash: hash, scope, alias: candidate });
    if (!error) return { hash, alias: candidate };
    // unique 충돌이면 다음 시도, 그 외 에러면 fallback
    if (!error || !String(error.message ?? '').includes('duplicate')) {
      // 다른 오류 — 다시 조회해서 동시에 만들어진 경우 처리
      const { data: retry } = await serverSupabase
        .from('board_user_aliases')
        .select('alias')
        .eq('author_hash', hash)
        .eq('scope', scope)
        .maybeSingle();
      if (retry?.alias) return { hash, alias: retry.alias };
    }
  }

  // 최후의 폴백 — 해시 일부로 고유 가명
  const fallback = '익명' + hash.substring(0, 6);
  await serverSupabase
    .from('board_user_aliases')
    .upsert({ author_hash: hash, scope, alias: fallback }, { onConflict: 'author_hash,scope' });
  return { hash, alias: fallback };
}
