#!/usr/bin/env node
/**
 * 사고사례(운전정보) 유형 태그 부여.
 *
 * 기존 분류는 [열차]/[신호]/[시설물] 3종뿐이라 17건 중 다수가 [열차] 하나로 뭉쳐 있다.
 * 13호(영등포구청 PSD 미개방)와 14호(건대입구 PSD 미개방)는 같은 유형이고 14호 문서가
 * 13호를 직접 참조하는데도 묶어볼 방법이 없었다.
 *
 * 규칙 기반으로 붙이고 결과를 사람이 보고 확인한다 — 자동 저장이 아니라 자동 '제안'이다.
 * 사용: node scripts/tag-driving-info.js [--apply]
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * 태그 규칙 — 본문 전체에서 찾는다.
 * 넓게 잡지 않는다. 붙으면 "이 유형이 맞다"가 되어야 필터가 쓸모 있다.
 */
const RULES = [
  ['출입문',       /출입문/],
  ['승강장안전문', /승강장안전문|PSD|psd|스크린도어/],
  ['미개방',       /미개방|안열림|안 열림|열리지\s*않|미취급/],
  ['신호',         /신호장치|정지신호|신호기|차상신호|ATC|ATS/],
  ['제동',         /제동/],
  ['정차',         /미달정차|과주|정차위치|지연출발|정위치/],
  ['방송',         /방송/],
  ['입환',         /입환/],
  ['탈선',         /탈선|궤도\s*이탈|일탈/],
  ['선로전환기',   /선로전환기/],
  ['지적확인환호', /지적확인환호|지적\s*확인/],
  ['관제보고',     /관제\s*보고|관제보고/],
  ['차량고장',     /고장/],
  ['기지',         /차량기지|기지/],
  ['냉방',         /냉방|송풍/],
  ['자동운전',     /자동운전|ATO/],
  ['무선',         /무전기|열차무선|LTE-R/],
];

function tagsFor(text) {
  const out = [];
  for (const [tag, re] of RULES) if (re.test(text)) out.push(tag);
  return out;
}

(async () => {
  const { data, error } = await supabase
    .from('hazard_reports')
    .select('id, location, description, tags')
    .eq('category', 'inspect')
    .order('created_at');
  if (error) throw new Error(error.message);

  console.log(`${APPLY ? '=== APPLY ===' : '=== DRY-RUN (--apply 로 저장) ==='}\n`);
  const changes = [];
  for (const r of data) {
    const title = r.description.split('\n')[0].replace(/^\[[^\]]+\]\s*/, '');
    const next = tagsFor(r.description);
    const prev = r.tags ?? [];
    const same = prev.length === next.length && prev.every((t) => next.includes(t));
    console.log(`[${(r.location || '—').padEnd(4)}] ${title.slice(0, 44)}`);
    console.log(`        ${next.length ? next.join(' · ') : '(태그 없음)'}${same ? '   (변경 없음)' : ''}`);
    if (!same) changes.push({ id: r.id, tags: next, location: r.location });
  }

  console.log(`\n대상 ${data.length}건 중 갱신 ${changes.length}건`);
  if (!APPLY) { console.log('(dry-run) 저장하지 않음'); return; }

  for (const c of changes) {
    const { error: e } = await supabase.from('hazard_reports').update({ tags: c.tags }).eq('id', c.id);
    if (e) throw new Error(`${c.location}: ${e.message}`);
  }
  console.log('✓ 저장 완료');
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
