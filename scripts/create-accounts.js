#!/usr/bin/env node
/**
 * Train-DIA 계정 일괄 생성 스크립트
 *
 * 사용법:
 *   node scripts/create-accounts.js [--dry-run]
 *
 * 필수 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 동작:
 *   1. cycle.ts의 P + auth.ts의 EXTRA_USERS 전원의 계정 생성
 *   2. 초기 PIN = 사번 뒤 6자리
 *   3. must_change_pin = true (최초 로그인 시 PIN 변경 강제)
 *   4. 진호(사번 21714375) → role: admin
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// ─── 환경변수 ───
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  console.error('   .env.local 파일을 확인해주세요.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');

// ─── 관리자 사번 ───
const ADMIN_SABUNS = ['21714375']; // 진호

// ─── 인원 데이터 (cycle.ts + auth.ts에서 복사) ───
// 사번이 있는 인원만 계정 생성 (결원은 제외)
function getAllUsers() {
  // cycle.ts의 P와 auth.ts의 EXTRA_USERS를 직접 사용할 수 없으므로
  // Supabase에서 이미 생성된 계정을 체크하고,
  // 코드 데이터에서 읽어옴

  // 여기서는 실행 시 동적으로 cycle.ts를 읽는 대신,
  // 직접 데이터 파일을 파싱합니다.
  const fs = require('fs');
  const path = require('path');

  const cycleContent = fs.readFileSync(
    path.join(__dirname, '../src/data/cycle.ts'), 'utf-8'
  );
  const authContent = fs.readFileSync(
    path.join(__dirname, '../src/lib/auth.ts'), 'utf-8'
  );

  const users = [];

  // cycle.ts에서 Person 추출
  const cycleRegex = /\{I:"([^"]+)",d:"([^"]*)",n:"([^"]+)"(?:,s:"([^"]+)")?/g;
  let match;
  while ((match = cycleRegex.exec(cycleContent)) !== null) {
    const [, id, dia, name, sabun] = match;
    if (sabun && !name.startsWith('결원')) {
      users.push({ personId: id, name, sabun });
    }
  }

  // auth.ts에서 EXTRA_USERS 추출
  const authRegex = /\{.*?n:\s*'([^']+)',\s*s:\s*'([^']+)'/g;
  while ((match = authRegex.exec(authContent)) !== null) {
    const [, name, sabun] = match;
    users.push({ personId: '0', name, sabun });
  }

  return users;
}

async function createAccounts() {
  const users = getAllUsers();
  console.log(`\n📋 총 ${users.length}명 계정 생성 ${DRY_RUN ? '(DRY RUN)' : ''}\n`);

  // 기존 계정 조회
  const { data: existing } = await supabase
    .from('driver_profiles')
    .select('sabun');
  const existingSabuns = new Set((existing ?? []).map(e => e.sabun));

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    if (existingSabuns.has(user.sabun)) {
      console.log(`  ⏭️  ${user.name} (${user.sabun}) — 이미 존재`);
      skipped++;
      continue;
    }

    // 초기 PIN = 사번 뒤 6자리
    const initialPin = user.sabun.slice(-6);
    const pinHash = await bcrypt.hash(initialPin, 10);
    const role = ADMIN_SABUNS.includes(user.sabun) ? 'admin' : 'driver';

    if (DRY_RUN) {
      console.log(`  🔍 ${user.name} (${user.sabun}) → PIN: ${initialPin}, role: ${role}`);
      created++;
      continue;
    }

    const { error } = await supabase
      .from('driver_profiles')
      .insert({
        sabun: user.sabun,
        name: user.name,
        person_id: user.personId,
        role,
        pin_hash: pinHash,
        must_change_pin: true,
        is_active: true,
      });

    if (error) {
      console.error(`  ❌ ${user.name} (${user.sabun}) — ${error.message}`);
      failed++;
    } else {
      console.log(`  ✅ ${user.name} (${user.sabun}) → role: ${role}`);
      created++;
    }
  }

  console.log(`\n📊 결과: 생성 ${created}, 스킵 ${skipped}, 실패 ${failed}`);
  if (DRY_RUN) {
    console.log('\n💡 실제 생성하려면: node scripts/create-accounts.js');
  }
}

createAccounts().catch((err) => {
  console.error('❌ 스크립트 실행 실패:', err.message);
  process.exit(1);
});
