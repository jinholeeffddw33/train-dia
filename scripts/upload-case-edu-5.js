#!/usr/bin/env node
/**
 * 사례교육 5호(열차 객실 내 보조배터리 불꽃·연기 발생) 등록.
 *
 * 원본이 .hwpx 라 PDF 를 거쳐 이미지로 만든다.
 *   hwpx --(한글 Office COM)--> pdf --(PyMuPDF 200dpi)--> png
 * 첨부를 이미지로 넣는 이유는 운전정보와 같다 — HazardDetail 은 photo_url 하나만 읽어서
 * 문서 파일을 넣으면 인라인 미리보기가 사라진다(scripts/upload-driving-info-15-16.js).
 *
 * 한글 COM 은 경로에 한글이 있어도 열지만, PowerShell 스크립트 파일 자체에 한글이 들어가면
 * PS 5.1 이 ANSI 로 읽어 깨진다 — 그래서 원본을 ASCII 경로로 복사한 뒤 변환한다.
 *
 * 게시자는 직전 호 행에서 그대로 가져온다 — 스크립트에 사람 이름·사번을 박지 않기 위해서다.
 *
 * 사용: node scripts/upload-case-edu-5.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const SRC_HWPX = String.raw`C:\Users\smrt2\Downloads\사례교육 2026-5.hwpx`;
const TMP_DIR = path.join(os.tmpdir(), 'case-edu-5');
const DRY_RUN = process.argv.includes('--dry-run');
const ISSUE_NO = '5호';
const PREV_NO = '4호';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * 원문 그대로 옮긴다 — 요약·의역 금지.
 * 원본이 역·열차번호를 ○○·0000 으로 가려 둔 문서라 그대로 둔다. 추측해서 채우지 않는다.
 */
const DESCRIPTION = `[열차] 열차 객실 내 보조배터리 불꽃·연기 발생
【발생개요】
2026.8.18.(화) 15:25경 00행 제0000열차(000편성) ○○역 출발 시 객실 내 승객이 소지한 보조배터리에서 불꽃 및 연기가 발생하여 승객이 소화기로 초기 진화를 시도(기관사 미인지 / 정상운행), 기관사는 다음 역인 △△역에서 객실 비상인터폰으로 '상황 발생 후 종료되었음(○○역에서 보조배터리 승강장 이동)'을 통보받은 후 관제보고, □□역에서 역직원 확인 후 정상운행
- 피해 사항 및 열차 지장: 없음
- 민원 및 언론보도: 민원(문자 1건), 언론보도 1건(JTBC)
【발생원인】
휴대폰 보조배터리 내부 단락으로 연기 발생(추정)
【문제점(승무분야)】
기관사가 △△역에서 승객으로부터(비상인터폰) '보조배터리 연기 발생 상황 발생 후 종료' 통보를 받은 후 관제 보고하였으나, 객실 상태는 미확인(연기 잔류 및 소화기 분사 미확인)
【예방대책】
1. 열차 운행 중 객실 내 휴대용 배터리 연기 발생 등 사고 발생을 인지(통보 등)한 때에는 해당 객실 확인(소화기 분사 및 연기 잔류 유무 등) 후 관제 보고하고 운행 재개
【발생일시·장소】
'26.8.18.(화) 15:25경 · 0호선 00역 출발 시`;

/** hwpx → pdf → png. 만들어진 png 경로를 돌려준다. */
function renderDocument() {
  if (!fs.existsSync(SRC_HWPX)) throw new Error(`원본 없음: ${SRC_HWPX}`);
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const ascii = path.join(TMP_DIR, 'src.hwpx');
  const pdf = path.join(TMP_DIR, 'src.pdf');
  const png = path.join(TMP_DIR, 'case-edu-5.png');
  fs.copyFileSync(SRC_HWPX, ascii);

  const ps = [
    '$h = New-Object -ComObject HWPFrame.HwpObject',
    '$h.XHwpWindows.Item(0).Visible = $false',
    `if (-not $h.Open('${ascii.replace(/\\/g, '\\\\')}', '', '')) { throw 'hwpx open failed' }`,
    `if (-not $h.SaveAs('${pdf.replace(/\\/g, '\\\\')}', 'PDF', '')) { throw 'pdf save failed' }`,
    '$h.Quit()',
  ].join('; ');
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], { stdio: 'inherit' });

  const py = `
import fitz
doc = fitz.open(r"${pdf}")
if len(doc) != 1:
    raise SystemExit(f"쪽 수가 1이 아니다({len(doc)}) — 첨부 한 장 전제가 깨졌다")
doc[0].get_pixmap(dpi=200).save(r"${png}")
`;
  const pyPath = path.join(TMP_DIR, 'render.py');
  fs.writeFileSync(pyPath, py, 'utf8');
  execSync(`py -3 "${pyPath}"`, { stdio: 'inherit' });

  return png;
}

(async () => {
  console.log(`=== ${DRY_RUN ? 'DRY-RUN' : 'UPLOAD'} 사례교육 ${ISSUE_NO} ===`);

  const { data: dup } = await supabase
    .from('hazard_reports').select('id').eq('category', 'action').eq('location', ISSUE_NO).maybeSingle();
  if (dup) throw new Error(`이미 사례교육 ${ISSUE_NO} 가 있다 (id=${dup.id}). 중복 등록 방지로 중단.`);

  // 게시자 = 직전 호와 동일 (스크립트에 이름·사번을 박지 않는다)
  const { data: prev, error: prevErr } = await supabase
    .from('hazard_reports').select('created_by, user_id').eq('category', 'action').eq('location', PREV_NO).single();
  if (prevErr) throw new Error(`${PREV_NO} 조회 실패: ${prevErr.message}`);
  console.log(`게시자(${PREV_NO} 기준): ${prev.created_by}`);

  const imgPath = renderDocument();
  console.log(`렌더 완료: ${(fs.statSync(imgPath).size / 1024).toFixed(0)} KB`);
  console.log(`\n--- description (${DESCRIPTION.length}자) ---\n${DESCRIPTION}\n---`);

  if (DRY_RUN) { console.log('\n(dry-run) 업로드 생략'); return; }

  const fileName = `attachments/action/${Date.now()}_case_edu_5.png`;
  const { error: upErr } = await supabase.storage
    .from('hazard-photos')
    .upload(fileName, fs.readFileSync(imgPath), { contentType: 'image/png', upsert: false });
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
      category: 'action',
    })
    .select('id, location, created_at')
    .single();
  if (dbErr) throw new Error(`DB 실패: ${dbErr.message}`);

  console.log(`\n✓ 등록 완료 — 사례교육 ${row.location} id=${row.id.slice(0, 8)} created_at=${row.created_at}`);
  console.log(`  photo_url: ${photoUrl}`);
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
