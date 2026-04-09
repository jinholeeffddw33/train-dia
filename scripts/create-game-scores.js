#!/usr/bin/env node
/**
 * game_scores 테이블 생성 스크립트
 * Supabase service_role_key로 직접 SQL 실행
 */
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

const ref = url.replace('https://', '').split('.')[0];

async function run() {
  // Try Supabase Management API pg endpoint
  const sql = `
    CREATE TABLE IF NOT EXISTS game_scores (
      id BIGSERIAL PRIMARY KEY,
      sabun TEXT NOT NULL,
      name TEXT NOT NULL,
      game TEXT NOT NULL CHECK (game IN ('snake', 'reaction')),
      score INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_game_scores_ranking ON game_scores (game, score DESC);
    CREATE INDEX IF NOT EXISTS idx_game_scores_monthly ON game_scores (game, created_at DESC, score DESC);
    CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores (game, sabun, score DESC);
  `;

  // Method 1: Try supabase postgres HTTP endpoint
  const pgUrl = `${url}/rest/v1/rpc/exec_sql`;
  console.log('Trying RPC method...');
  const res1 = await fetch(pgUrl, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (res1.ok) {
    console.log('✅ Table created via RPC');
    return;
  }

  console.log('RPC not available, trying direct table check...');

  // Method 2: Just check if table exists by querying it
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(url, key);
  
  const { data, error } = await supabase.from('game_scores').select('id').limit(1);
  
  if (!error) {
    console.log('✅ Table already exists');
    return;
  }
  
  if (error.code === '42P01') {
    console.log('❌ Table does not exist. Please run this SQL in Supabase Dashboard SQL Editor:');
    console.log('');
    console.log(sql);
    console.log('');
    console.log('Dashboard: https://supabase.com/dashboard/project/' + ref + '/sql/new');
    process.exit(1);
  }
  
  console.log('Table check result:', error.message);
}

run().catch(e => { console.error(e); process.exit(1); });
