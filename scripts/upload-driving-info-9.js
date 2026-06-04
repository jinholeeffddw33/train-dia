#!/usr/bin/env node
/**
 * 운전정보 2026-9.pdf — 1페이지 사례 업로드.
 * 규칙 (메모리 feedback_driving_info_upload.md):
 *  - category: 'inspect' (알림마당)
 *  - location: "N호"
 *  - description 첫 줄: [열차] 사고 상세 제목
 *  - description 본문: 【재발방지 대책】 + 1./2./3. 아라비아 번호
 *
 * 사용: node scripts/upload-driving-info-9.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PDF_PATH = String.raw`C:\Users\smrt2\Downloads\운전정보 2026-9.pdf`;
const TMP_DIR = path.join(__dirname, '..', '.tmp_driving');
const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const AUTHOR_NAME = '이현구';
const AUTHOR_SABUN = '21711694';

const ISSUE_NO     = '9호';
const TITLE        = '4호선 신용산역 하선 승강장안전문 일부 안열림';
const PREVENTION   = `【재발방지 대책】
1. 승무원 기본업무 교육철저 (지적확인환호 절대준수사항 등)
2. HMI 및 CCTV를 통한 승객 승·하차 상태 확인 철저
3. 승강장안전문 및 출입문 전체 개방 확인 후 지적확인환호 실시
4. 형식적인 지적확인환호 절대금지`;

function renderPdfPages() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const py = `
import fitz, os, sys
pdf = fitz.open(r"${PDF_PATH}")
out_dir = r"${TMP_DIR.replace(/\\/g, '\\\\')}"
for i, page in enumerate(pdf, 1):
    pix = page.get_pixmap(dpi=150)
    img_path = os.path.join(out_dir, f"driving9-{i:02d}.jpg")
    pix.save(img_path, jpg_quality=85)
sys.stdout.write(f"rendered {len(pdf)} pages\\n")
`;
  const script = path.join(TMP_DIR, 'render9.py');
  fs.writeFileSync(script, py, 'utf8');
  const out = execSync(`python "${script}"`, { encoding: 'utf8' });
  console.log(out.trim());
}

(async () => {
  console.log(DRY_RUN ? `=== DRY-RUN (운전정보 ${ISSUE_NO}) ===` : `=== UPLOAD (운전정보 ${ISSUE_NO}) ===`);
  renderPdfPages();

  const description = `[열차] ${TITLE}\n\n${PREVENTION}`;
  const imgPath = path.join(TMP_DIR, 'driving9-01.jpg');

  console.log(`\n[${ISSUE_NO}] ${TITLE}`);
  console.log('--- description preview ---');
  console.log(description);
  console.log('---');

  if (DRY_RUN) { console.log('(dry-run) 업로드 생략'); return; }

  // Storage 업로드
  const fileBuf = fs.readFileSync(imgPath);
  const fileName = `inspect/${Date.now()}_9_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: upErr } = await supabase.storage
    .from('hazard-photos')
    .upload(fileName, fileBuf, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw new Error(`Storage 실패: ${upErr.message}`);
  const photoUrl = supabase.storage.from('hazard-photos').getPublicUrl(fileName).data.publicUrl;

  // user_id 조회
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
      location: ISSUE_NO,
      created_by: AUTHOR_NAME,
      user_id: userId,
      category: 'inspect',
    })
    .select('id, location, created_at')
    .single();
  if (dbErr) throw new Error(`DB 실패: ${dbErr.message}`);
  console.log(`✓ 등록 완료 — id=${row.id.slice(0, 8)} location=${row.location} created_at=${row.created_at}`);
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
