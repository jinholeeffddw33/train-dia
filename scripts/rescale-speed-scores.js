#!/usr/bin/env node
/**
 * 스피드 마스터 기존 점수를 새 규칙 비율로 환산한다.
 *
 * 왜 필요한가
 *   한 단계가 7구간 → 5구간으로 줄면서 한 단계 만점이 1,050 → 750 이 됐다.
 *   기존 기록을 그대로 두면 새로 하는 사람은 아무리 잘해도 옛 기록을 못 넘는다.
 *   랭킹이 "언제 했느냐"로 갈리면 기록의 의미가 없어지므로 같은 자로 맞춘다.
 *
 * 환산 비율 = 5/7 (구간 수의 비). 반올림.
 *
 * 실행: node scripts/rescale-speed-scores.js [--apply]
 *   --apply 없으면 무엇이 어떻게 바뀌는지만 출력한다(안전).
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const RATIO = 5 / 7;
const APPLY = process.argv.includes('--apply');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('환경변수 없음: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

/** 한 테이블의 speed 행을 비율대로 고친다. 이미 환산된 행을 또 줄이지 않도록 한 번만 돌린다. */
async function rescale(table) {
  const { data, error } = await db.from(table).select('id, name, score').eq('game', 'speed');
  if (error) {
    // 게임별 명예의전당이 없는 배포도 있다 — 없으면 조용히 넘어간다
    if (/does not exist|relation/i.test(error.message)) {
      console.log(`- ${table}: 테이블 없음, 건너뜀`);
      return;
    }
    throw new Error(`${table} 조회 실패: ${error.message}`);
  }
  if (!data.length) {
    console.log(`- ${table}: speed 기록 없음`);
    return;
  }

  console.log(`\n[${table}] ${data.length}건`);
  for (const row of data) {
    const next = Math.round(row.score * RATIO);
    console.log(`  ${String(row.name ?? '').padEnd(6)} ${String(row.score).padStart(5)} → ${String(next).padStart(5)}`);
    if (!APPLY) continue;
    const { error: upErr } = await db.from(table).update({ score: next }).eq('id', row.id);
    if (upErr) throw new Error(`${table} id=${row.id} 수정 실패: ${upErr.message}`);
  }
}

(async () => {
  console.log(APPLY ? '=== 실제 반영 (--apply) ===' : '=== 미리보기 (반영 안 함) ===');
  console.log(`환산 비율 ${RATIO.toFixed(4)} (5구간 / 7구간)`);
  await rescale('game_scores');
  await rescale('game_hall_of_fame');
  console.log(APPLY ? '\n완료' : '\n--apply 를 붙이면 실제로 반영됩니다');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
