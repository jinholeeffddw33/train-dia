#!/usr/bin/env node
/**
 * 퇴사자 데이터 조사 (읽기 전용)
 * - 어느 테이블에 데이터가 있는지 집계만 한다. 삭제하지 않는다.
 *
 * 사용법: node scripts/investigate-resigned-interns.js <8자리 사번> [사번...]
 * 대상 사번은 인자로만 받는다. 저장소가 공개라 실명·사번을 코드에 남기지 않는다.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SABUNS = process.argv.slice(2).filter((a) => /^\d{8}$/.test(a));
if (!SABUNS.length) {
  console.error('사용법: node scripts/investigate-resigned-interns.js <8자리 사번> [사번...]');
  process.exit(1);
}
const SALT = process.env.BOARD_HASH_SALT || 'train-dia-board-default-salt-2026';
const hashSabun = (s) => crypto.createHash('sha256').update(s + SALT).digest('hex').substring(0, 32);
const HASHES = SABUNS.map(hashSabun);

async function countBy(table, col, values) {
  const { data, error, count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: false })
    .in(col, values);
  if (error) return `ERR(${error.message})`;
  return count ?? (data ? data.length : 0);
}

(async () => {
  console.log('=== 퇴사 인턴 2명 데이터 조사 ===');
  console.log('대상 사번:', SABUNS.join(', '));
  console.log('board salt:', SALT === 'train-dia-board-default-salt-2026' ? '(default)' : '(custom)');
  console.log('board hash:', HASHES.join(', '));
  console.log('');

  // 1) driver_profiles
  const { data: profiles, error: pe } = await supabase
    .from('driver_profiles')
    .select('id, sabun, name, is_active')
    .in('sabun', SABUNS);
  if (pe) { console.log('driver_profiles ERR:', pe.message); }
  console.log('driver_profiles:', JSON.stringify(profiles));
  const ids = (profiles || []).map((p) => p.id);

  // 2) sabun 기반 테이블
  const sabunTables = [
    ['game_scores', 'sabun'],
    ['multi_game_ratings', 'sabun'],
    ['game_hall_of_fame', 'sabun'],
    ['push_subscriptions', 'sabun'],
  ];
  for (const [t, c] of sabunTables) {
    console.log(`${t}.${c}:`, await countBy(t, c, SABUNS));
  }
  // multi_game_results (winner/loser)
  console.log('multi_game_results.winner_sabun:', await countBy('multi_game_results', 'winner_sabun', SABUNS));
  console.log('multi_game_results.loser_sabun:', await countBy('multi_game_results', 'loser_sabun', SABUNS));

  // 3) user_id 기반 테이블
  if (ids.length) {
    const uidTables = [
      ['webauthn_credentials', 'user_id'],
      ['webauthn_challenges', 'user_id'],
      ['audit_log', 'user_id'],
      ['hazard_reports', 'user_id'],
      ['hazard_comments', 'user_id'],
      ['hazard_likes', 'user_id'],
    ];
    for (const [t, c] of uidTables) {
      console.log(`${t}.${c}:`, await countBy(t, c, ids));
    }
  } else {
    console.log('(driver_profiles 행 없음 → user_id 기반 테이블 조회 생략)');
  }

  // 4) board (author_hash 기반)
  const boardTables = [
    ['board_posts', 'author_hash'],
    ['board_comments', 'author_hash'],
    ['board_post_likes', 'author_hash'],
    ['board_comment_likes', 'author_hash'],
    ['board_reports', 'reporter_hash'],
    ['board_user_aliases', 'author_hash'],
  ];
  for (const [t, c] of boardTables) {
    console.log(`${t}.${c}:`, await countBy(t, c, HASHES));
  }
  console.log('board_blocks.blocker_hash:', await countBy('board_blocks', 'blocker_hash', HASHES));
  console.log('board_blocks.blocked_hash:', await countBy('board_blocks', 'blocked_hash', HASHES));

  console.log('\n=== 조사 완료 (삭제 안 함) ===');
})();
