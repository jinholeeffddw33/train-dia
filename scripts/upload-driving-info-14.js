#!/usr/bin/env node
/**
 * 운전정보 14호(2호선 건대입구역 외선 승강장안전문 일부 미개방) 등록.
 *
 * 첨부는 원본 PDF(운전정보 2026-14.pdf)를 200dpi 로 렌더한 이미지다.
 * HazardDetail 은 photo_url 하나만 읽어서 .pdf 를 넣으면 인라인 미리보기가 사라지고
 * "미리보기를 지원하지 않아요 + 다운로드" 로 떨어진다 — 13호와 같은 이유(scripts/update-driving-info-13.js).
 *
 * 게시자는 13호 행에서 그대로 가져온다 — 스크립트에 사람 이름·사번을 박지 않기 위해서다.
 *
 * 사용: node scripts/upload-driving-info-14.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PDF_PATH = String.raw`C:\Users\smrt2\Downloads\운전정보 2026-14.pdf`;
const TMP_DIR = path.join(__dirname, '..', '.tmp_driving');
const DRY_RUN = process.argv.includes('--dry-run');
const ISSUE_NO = '14호';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * 원문 그대로 옮긴다 — 요약·의역 금지. 12·13호와 같은 서식.
 * 우측 박스의 '지적확인환호 요령'은 이 사건의 핵심 교훈이라 별도 절로 살린다.
 */
const DESCRIPTION = `[열차] 2호선 건대입구역 외선 승강장안전문 일부 미개방
【발생개요】
건대입구역 외선 PSD 8-3 장애로 관계 직원이 점검 중(PSD 4개 개방상태), 제2357열차(287편성, 다원)가 건대입구역 외선 도착 후 출입문을 개방하였으나 다수 PSD가 열리지 않음. 기술직원 출발지시전호를 확인하고 출발한 뒤, 승·하차하지 못한 승객이 고객센터로 민원을 제기함
【원인】
1차 원인: PSD 장애
2차 원인: 승무원 기본업무 소홀
- PSD 미개방을 인지하였으나 관제보고 및 PSD 열림S/W 수동취급 등 후속조치 미흡
- CCTV를 통한 승객 승·하차 확인 소홀
【재발방지 대책】
1. 사고사례 특별교육 실시
2. 이례상황 발생 시 관제 보고 철저
3. 승무원 기본업무 교육 철저(지적확인환호 및 이례상황 조치법 등)
- HMI 화면에서 PSD 전체열림 확인 후 지적확인환호 실시, CCTV를 통한 승객 승·하차 상태 확인
- 2인 승무열차 부저전호는 반드시 PSD 전체열림 확인 후 실시(운전정보 2026-13 참조)
4. 승강장안전문 장애 발생 시 관제보고 철저
- 관제보고 → 안내방송 → PSD 재개방·재취급 → (필요시) 인접출입문 이용 안내방송 및 현장출동
5. 지도승무 시 PSD 전체열림 확인 여부 집중 확인, 미흡 시 현장 교정 시행
- 형식적 지적확인환호 교정 → 규정에 따른 지적확인환호 요령 교육 및 교정 실시
【지적확인환호 요령】 운전관계 직원업무내규 제30조
1. 취급·확인할 대상을 본다
2. 인지로 대상물을 지적한다
3. 대상물의 상태를 확인한다
4. 대상물의 명칭과 상태를 환호한다
【발생일시·장소】
'26.8.3.(월) 18:44경 · 2호선 건대입구역 외선`;

function renderPdf() {
  if (!fs.existsSync(PDF_PATH)) throw new Error(`PDF 없음: ${PDF_PATH}`);
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const py = `
import fitz, os, sys
pdf = fitz.open(r"${PDF_PATH}")
out_dir = r"${TMP_DIR.replace(/\\/g, '\\\\')}"
page = pdf[0]
# 200dpi — 운행기록부 그래프처럼 작은 글씨를 확대해 읽어야 한다. q=85 로 용량은 잡는다.
pix = page.get_pixmap(dpi=200)
pix.save(os.path.join(out_dir, "driving14-01.jpg"), jpg_quality=85)
sys.stdout.write(f"pages={len(pdf)} size={pix.width}x{pix.height}\\n")
`;
  const script = path.join(TMP_DIR, 'render14.py');
  fs.writeFileSync(script, py, 'utf8');
  console.log(execSync(`python "${script}"`, { encoding: 'utf8' }).trim());
  return path.join(TMP_DIR, 'driving14-01.jpg');
}

(async () => {
  console.log(`=== ${DRY_RUN ? 'DRY-RUN' : 'UPLOAD'} 운전정보 ${ISSUE_NO} ===`);

  const { data: dup } = await supabase
    .from('hazard_reports').select('id').eq('location', ISSUE_NO).maybeSingle();
  if (dup) throw new Error(`이미 ${ISSUE_NO} 가 있다 (id=${dup.id}). 중복 등록 방지로 중단.`);

  // 게시자 = 13호와 동일 (스크립트에 이름·사번을 박지 않는다)
  const { data: prev, error: prevErr } = await supabase
    .from('hazard_reports').select('created_by, user_id').eq('location', '13호').single();
  if (prevErr) throw new Error(`13호 조회 실패: ${prevErr.message}`);
  console.log(`게시자(13호 기준): ${prev.created_by}`);

  const imgPath = renderPdf();
  console.log(`렌더 완료: ${(fs.statSync(imgPath).size / 1024).toFixed(0)} KB`);
  console.log(`\n--- description (${DESCRIPTION.length}자) ---\n${DESCRIPTION}\n---`);

  if (DRY_RUN) { console.log('\n(dry-run) 업로드 생략'); return; }

  const fileName = `inspect/${Date.now()}_14_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error: upErr } = await supabase.storage
    .from('hazard-photos')
    .upload(fileName, fs.readFileSync(imgPath), { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw new Error(`Storage 실패: ${upErr.message}`);
  const photoUrl = supabase.storage.from('hazard-photos').getPublicUrl(fileName).data.publicUrl;

  const { data: row, error: dbErr } = await supabase
    .from('hazard_reports')
    .insert({
      photo_url: photoUrl,
      description: DESCRIPTION,
      location: ISSUE_NO,
      created_by: prev.created_by,
      user_id: prev.user_id,
      category: 'inspect',
    })
    .select('id, location, created_at')
    .single();
  if (dbErr) throw new Error(`DB 실패: ${dbErr.message}`);

  console.log(`\n✓ 등록 완료 — ${row.location} id=${row.id.slice(0, 8)} created_at=${row.created_at}`);
  console.log(`  photo_url: ${photoUrl}`);
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
