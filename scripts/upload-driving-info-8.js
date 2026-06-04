#!/usr/bin/env node
/**
 * 운전정보 2026-8.pdf — 1페이지 단일 사례 업로드.
 * 카테고리: 'inspect' (알림마당) — 기존 패턴과 동일.
 *
 * 사용:
 *   node scripts/upload-driving-info-8.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PDF_PATH = String.raw`C:\Users\smrt2\Downloads\운전정보 2026-8.pdf`;
const TMP_DIR = path.join(__dirname, '..', '.tmp_driving');
const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const AUTHOR_NAME = '이현구';
const AUTHOR_SABUN = '21711694';

const SPEC = {
  index: 1,
  title: '5호선 강동역 마천행 열차 행선지 육성안내방송 오방송',
  summary:
    '마천행 제5607열차(522편성) 강동역 하선 승강장 도착 후 승무원이 하남검단산행으로 오방송 → 일부 고객 오인 하차, 문자 민원 4건. ' +
    '발생일시 2026.6.2.(화) 13:41경 · 장소 5호선 강동역 하선. ' +
    '원인: 행선지 착각에 의한 오방송(마천행을 하남검단산행으로 잘못 안내). ' +
    '재발방지: ① 출무보고 시 행선지 상호 확인 철저 ② 행선안내 육성방송 전 행선지 확인 후 방송 ③ 열차 시각표 시인성 강화 ④ 긴급 업무지시(SNS)·사고사례 특별교육 실시.',
};

// ─── PDF → JPG 렌더 ───
function renderPdfPages() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const py = `
import fitz, os, sys
pdf = fitz.open(r"${PDF_PATH}")
out_dir = r"${TMP_DIR.replace(/\\/g, '\\\\')}"
for i, page in enumerate(pdf, 1):
    pix = page.get_pixmap(dpi=150)
    img_path = os.path.join(out_dir, f"driving8-{i:02d}.jpg")
    pix.save(img_path, jpg_quality=85)
sys.stdout.write(f"rendered {len(pdf)} pages\\n")
`;
  const script = path.join(TMP_DIR, 'render8.py');
  fs.writeFileSync(script, py, 'utf8');
  const out = execSync(`python "${script}"`, { encoding: 'utf8' });
  console.log(out.trim());
}

async function uploadOne(spec) {
  const description = `[열차] ${spec.title}\n${spec.summary}`;
  const imgPath = path.join(TMP_DIR, `driving8-${String(spec.index).padStart(2, '0')}.jpg`);

  console.log(`\n[${spec.index}] ${spec.title}`);
  console.log(`  요약: ${spec.summary.slice(0, 90)}...`);

  if (DRY_RUN) { console.log('  (dry-run) 업로드 생략'); return; }

  // Storage 업로드
  const fileBuf = fs.readFileSync(imgPath);
  const fileName = `inspect/${Date.now()}_${spec.index}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: upErr } = await supabase.storage
    .from('hazard-photos')
    .upload(fileName, fileBuf, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw new Error(`Storage 실패: ${upErr.message}`);
  const { data: pub } = supabase.storage.from('hazard-photos').getPublicUrl(fileName);
  const photoUrl = pub.publicUrl;

  // 작성자 user_id 조회
  const { data: profile } = await supabase
    .from('driver_profiles')
    .select('id')
    .eq('sabun', AUTHOR_SABUN)
    .single();
  const userId = profile?.id ?? null;

  // hazard_reports insert
  const { data: row, error: dbErr } = await supabase
    .from('hazard_reports')
    .insert({
      photo_url: photoUrl,
      description,
      location: '5호선 강동역 하선',
      created_by: AUTHOR_NAME,
      user_id: userId,
      category: 'inspect',
    })
    .select('id, created_at')
    .single();
  if (dbErr) throw new Error(`DB 실패: ${dbErr.message}`);
  console.log(`  ✓ id=${row.id.slice(0, 8)} created_at=${row.created_at}`);
}

(async () => {
  console.log(DRY_RUN ? '=== DRY-RUN (운전정보 2026-8) ===' : '=== UPLOAD (운전정보 2026-8) ===');
  renderPdfPages();
  await uploadOne(SPEC);
  console.log('\n=== 완료: 1건 ===');
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
