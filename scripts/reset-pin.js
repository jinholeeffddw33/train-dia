#!/usr/bin/env node
/**
 * PIN 초기화 스크립트
 *
 * 사용법: node scripts/reset-pin.js <사번> [<사번> ...]
 *
 * 동작: pin_hash = bcrypt(사번 뒤 6자리), must_change_pin = true
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const sabuns = process.argv.slice(2);

if (sabuns.length === 0) {
  console.error('사용법: node scripts/reset-pin.js <사번> [<사번> ...]');
  process.exit(1);
}

(async () => {
  for (const sabun of sabuns) {
    const initialPin = sabun.slice(-6);
    const pinHash = await bcrypt.hash(initialPin, 10);

    const { data, error } = await supabase
      .from('driver_profiles')
      .update({ pin_hash: pinHash, must_change_pin: true })
      .eq('sabun', sabun)
      .select('sabun, name');

    if (error) {
      console.error(`❌ ${sabun} — ${error.message}`);
    } else if (!data || data.length === 0) {
      console.error(`❌ ${sabun} — 계정 없음`);
    } else {
      console.log(`✅ ${data[0].name} (${sabun}) → PIN: ${initialPin}`);
    }
  }
})();
