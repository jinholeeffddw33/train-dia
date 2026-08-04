#!/usr/bin/env node
/**
 * 운전정보 13호(2호선 영등포구청역 내선 승강장안전문 미개방) 갱신.
 *
 * 왜:
 *  - 기존 첨부는 모니터를 찍은 사진이라 반사·기울어짐·바탕화면 테두리가 그대로 들어가 있었다.
 *    원본 PDF(운전정보 2026-13.pdf)를 200dpi 로 렌더해 교체한다.
 *  - 본문이 제목 + "승무원 기본업무 철저" 두 줄뿐이라, 원문의
 *    【발생개요】【원인】【재발방지 대책】을 12호와 같은 서식으로 채운다.
 *
 * 첨부를 PDF 파일 그대로 올리지 않고 이미지로 굽는 이유:
 *  HazardDetail 은 photo_url 하나만 읽는다. 여기에 .pdf 를 넣으면 상세화면의 인라인
 *  미리보기가 사라지고 "미리보기를 지원하지 않아요 + 다운로드" 로 떨어진다.
 *  (attachment_url 컬럼은 있지만 화면에서 쓰는 곳이 없다.)
 *
 * 사용: node scripts/update-driving-info-13.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PDF_PATH = String.raw`C:\Users\smrt2\Downloads\운전정보 2026-13.pdf`;
const TMP_DIR = path.join(__dirname, '..', '.tmp_driving');
const DRY_RUN = process.argv.includes('--dry-run');
const ISSUE_NO = '13호';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/** 원문 그대로 옮긴다 — 요약·의역 금지. 표(부져전호)는 줄글로 편다. */
const DESCRIPTION = `[열차] 2호선 영등포구청역 내선 승강장안전문 미개방
【발생개요】
제2476열차(270편성) 영등포구청역 내선(시청방면) 도착 후 출입문은 개방하였으나 승강장안전문 전체가 열리지 않아 일부 승객이 수동으로 승강장안전문을 개방(4개)하여 승·하차하였고, 그외 승·하차하지 못한 승객이 민원을 제기함
【원인】
1차 원인: 차상PSD조작반 시스템 오류
2차 원인: 승무원 기본업무 소홀
- 지적확인환호 소홀
- CCTV를 통한 승객 승·하차 확인 소홀(HMI로 승강장안전문 열림상태 미확인)
【재발방지 대책】
1. 사고사례 특별교육 실시
2. 승무원 기본업무 교육 철저(지적확인환호 절대준수사항 등)
- HMI 확인 철저(승강장안전문 전체열림 확인) 및 CCTV를 통한 승객 승·하차 상태 확인 철저
3. 출고점검 시 차상PSD조작반 내·외선 선택스위치 상태 관제보고 철저(2호선)
4. 운전실 변경 시 차상PSD조작반 내·외선 상태 승무원 상호확인(2호선)
5. 안전패트롤 2단계 발령('26.7.24.(금)~8.6.(목), 2주간)
6. 2인 승무원(기관사⇔차장) 간 상호 확인 철저
- 출입문/PSD 전체열림 시 기관사 ▶ 차장 (승강장안전문 전체열림 확인 후) 단1 부져전호
- 차장 ▶ 기관사 (기관사의 부져전호 확인 후) 단2 부져전호
- 관련근거: 승무지원처-1999('22.4.6)
7. 향후 인적오류로 인한 사고·장애 유발 시 관리자 연대 엄중문책 및 전보조치 검토
【발생일시·장소】
'26.7.24.(금) 22:58경 · 2호선 영등포구청역 내선`;

function renderPdf() {
  if (!fs.existsSync(PDF_PATH)) throw new Error(`PDF 없음: ${PDF_PATH}`);
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const py = `
import fitz, os, sys
pdf = fitz.open(r"${PDF_PATH}")
out_dir = r"${TMP_DIR.replace(/\\/g, '\\\\')}"
page = pdf[0]
# 200dpi — 부져전호 표처럼 작은 글씨를 확대해 읽을 수 있어야 한다(기존 150dpi 는 뭉갠다).
# q=85 로 낮춰 용량은 잡는다(q90 638KB → 550KB 대, 육안 차이 없음).
pix = page.get_pixmap(dpi=200)
pix.save(os.path.join(out_dir, "driving13-01.jpg"), jpg_quality=85)
sys.stdout.write(f"pages={len(pdf)} size={pix.width}x{pix.height}\\n")
`;
  const script = path.join(TMP_DIR, 'render13.py');
  fs.writeFileSync(script, py, 'utf8');
  console.log(execSync(`python "${script}"`, { encoding: 'utf8' }).trim());
  return path.join(TMP_DIR, 'driving13-01.jpg');
}

(async () => {
  console.log(`=== ${DRY_RUN ? 'DRY-RUN' : 'UPDATE'} 운전정보 ${ISSUE_NO} ===`);

  const { data: before, error: selErr } = await supabase
    .from('hazard_reports')
    .select('id, location, photo_url, description')
    .eq('location', ISSUE_NO)
    .single();
  if (selErr) throw new Error(`조회 실패: ${selErr.message}`);

  console.log(`\n대상: id=${before.id}`);
  console.log(`기존 photo_url: ${before.photo_url}`);
  console.log(`기존 description(${before.description.length}자):\n${before.description}`);

  const imgPath = renderPdf();
  const stat = fs.statSync(imgPath);
  console.log(`\n렌더 완료: ${imgPath} (${(stat.size / 1024).toFixed(0)} KB)`);
  console.log(`\n새 description(${DESCRIPTION.length}자):\n${DESCRIPTION}`);

  if (DRY_RUN) { console.log('\n(dry-run) 업로드/갱신 생략'); return; }

  const fileName = `inspect/${Date.now()}_13_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: upErr } = await supabase.storage
    .from('hazard-photos')
    .upload(fileName, fs.readFileSync(imgPath), { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw new Error(`Storage 실패: ${upErr.message}`);
  const photoUrl = supabase.storage.from('hazard-photos').getPublicUrl(fileName).data.publicUrl;

  const { data: row, error: dbErr } = await supabase
    .from('hazard_reports')
    .update({ photo_url: photoUrl, description: DESCRIPTION })
    .eq('id', before.id)
    .select('id, location, photo_url')
    .single();
  if (dbErr) throw new Error(`DB 실패: ${dbErr.message}`);

  console.log(`\n✓ 갱신 완료 — ${row.location}`);
  console.log(`  새 photo_url: ${row.photo_url}`);
  console.log(`  이전 파일은 지우지 않았다(되돌릴 수 있게). 필요 없으면 Storage 에서 삭제:`);
  console.log(`  hazard-photos/${before.photo_url.split('/hazard-photos/')[1]}`);
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
