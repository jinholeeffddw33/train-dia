#!/usr/bin/env node
/**
 * 운전정보 15호(5호선 군자역 상선 첫열차 빠른출발)·16호(3호선 구파발역 하선 객실등 미점등) 등록.
 *
 * 이번 원본은 호별 PDF 가 아니라 1~16호 묶음 PDF 라 해당 쪽만 렌더한다(15호=15쪽, 16호=16쪽).
 * 첨부를 PDF 가 아닌 이미지로 넣는 이유는 14호와 같다 — HazardDetail 은 photo_url 하나만
 * 읽어서 .pdf 를 넣으면 인라인 미리보기가 사라진다(scripts/upload-driving-info-14.js).
 *
 * 게시자는 직전 호 행에서 그대로 가져온다 — 스크립트에 사람 이름·사번을 박지 않기 위해서다.
 *
 * 사용: node scripts/upload-driving-info-15-16.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PDF_PATH = String.raw`C:\Users\smrt2\Downloads\7. 2026년 운전정보(1호~16호).pdf`;
const TMP_DIR = path.join(__dirname, '..', '.tmp_driving');
const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * 원문 그대로 옮긴다 — 요약·의역 금지. 13·14호와 같은 서식.
 * 우측·하단 박스(예규 조문, 업무 프로세스)는 이 사건의 학습 포인트라 별도 절로 살린다.
 */
const SPECS = [
  {
    no: '15호',
    page: 15,
    description: `[열차] 5호선 군자역 상선 첫열차 빠른출발
【발생개요】
제5008열차(551편성) 군자역 상선 첫열차(야간유치열차)가 정시(05:32)보다 약 2분 빠른 출발(05:30)하여 다음 역인 장한평역부터 정시 운행한 상황
【원인】
첫열차 출발시각 착각으로 빠른 출발
【재발방지 대책】
1. 사고사례 특별교육 실시
2. 승무 중 운전실 내 태블릿PC 시간확인 철저
3. 첫열차 및 주박열차(야간유치열차) 출발 전 운전시각표 확인 철저
4. 주박열차(야간유치열차) 출고점검 후 관제보고 철저
- 예시: 제0000열차 00역 00시00분 출발입니다.
【정거장 도착·출발 시 승무원의 확인】 전동차승무원업무예규 제33조
① 기관사는 승객이 승·하차하는 열차가 정거장에 도착, 출발할 때에는 다음 각 호의 사항을 확인하여야 한다.
3. 승객 승하차 확인 및 열차 시각표를 확인한다
【발생일시·장소】
'26.8.11.(화) 05:30경 · 5호선 군자역 상선`,
  },
  {
    no: '16호',
    page: 16,
    description: `[열차] 3호선 구파발역 하선 객실등 미점등
【발생개요】
제3937열차(302편성) 지축차량기지 출고 후, 제3067열차 구파발역~불광역 하선 객실등 소등 상태로 운행하여 민원 발생, 운전관제 무전에 의해 상황을 인지하고 녹번역부터 객실등 점등하고 정상 운행
- 구파발역~불광역: 객실등 소등상태로 출발 / 녹번역: 객실 점등
【원인】
출발 전 객실등 점등상태 미확인
【재발방지 대책】
1. 사고사례 특별교육 실시
2. 출고 시 차량상태 및 서비스기기(객실등, 냉난방, 방송장치 등) 확인 철저
3. 출발(시발)역 승무원 업무프로세스 교육
- 승무지원처-1999(2022.4.8.) 『-승무원 인적오류 예방을 위한- 승강장안전문 미개방 재발방지대책(안)』 참고
【출발역 업무 프로세스】
1. (운전실) 정위치 정차 확인
2. (운전실) 출입문 및 승강장안전문 개방 확인
3. (객실) 객실등 및 냉난방 등 확인
4. (승강장) 행선 및 열차번호 확인
【발생일시·장소】
'26.8.11.(화) 08:10경 · 3호선 구파발역~불광역 하선`,
  },
];

/* 이 PC 의 `python` 은 스토어 안내문만 찍는 껍데기라 실행되지 않는다. 실제 인터프리터를 찾는다. */
function resolvePython() {
  for (const cmd of ['py -3', 'python']) {
    try {
      execSync(`${cmd} -c "import fitz"`, { stdio: 'ignore' });
      return cmd;
    } catch { /* 다음 후보 */ }
  }
  throw new Error('PyMuPDF(fitz) 를 쓸 수 있는 python 을 찾지 못했다.');
}

/** 묶음 PDF 의 한 쪽만 200dpi 로 렌더한다 — 운행선도·CCTV 캡처의 작은 글씨를 읽어야 한다. */
function renderPage(python, page) {
  if (!fs.existsSync(PDF_PATH)) throw new Error(`PDF 없음: ${PDF_PATH}`);
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const out = path.join(TMP_DIR, `driving-p${page}.jpg`);
  const py = `
import fitz, sys
pdf = fitz.open(r"${PDF_PATH}")
pix = pdf[${page - 1}].get_pixmap(dpi=200)
pix.save(r"${out}", jpg_quality=85)
sys.stdout.write(f"p${page} {pix.width}x{pix.height}\\n")
`;
  const script = path.join(TMP_DIR, `render-p${page}.py`);
  fs.writeFileSync(script, py, 'utf8');
  console.log(execSync(`${python} "${script}"`, { encoding: 'utf8' }).trim());
  return out;
}

(async () => {
  console.log(`=== ${DRY_RUN ? 'DRY-RUN' : 'UPLOAD'} 운전정보 ${SPECS.map((s) => s.no).join(', ')} ===`);
  const python = resolvePython();

  /* 게시자는 이미 올라가 있는 마지막 호에서 한 번만 가져온다 — 스크립트에 이름·사번을
     박지 않으면서, 15호를 넣기 전에도(dry-run 포함) 조회가 성립하게 하려고 루프 밖에 둔다. */
  const baseNo = `${parseInt(SPECS[0].no, 10) - 1}호`;
  const { data: prev, error: prevErr } = await supabase
    .from('hazard_reports').select('created_by, user_id').eq('location', baseNo).single();
  if (prevErr) throw new Error(`${baseNo} 조회 실패: ${prevErr.message}`);
  console.log(`게시자(${baseNo} 기준): ${prev.created_by}`);

  for (const spec of SPECS) {
    console.log(`\n──────── ${spec.no} ────────`);

    const { data: dup } = await supabase
      .from('hazard_reports').select('id').eq('location', spec.no).maybeSingle();
    if (dup) throw new Error(`이미 ${spec.no} 가 있다 (id=${dup.id}). 중복 등록 방지로 중단.`);

    const imgPath = renderPage(python, spec.page);
    console.log(`렌더 완료: ${(fs.statSync(imgPath).size / 1024).toFixed(0)} KB`);
    console.log(`\n--- description (${spec.description.length}자) ---\n${spec.description}\n---`);

    if (DRY_RUN) { console.log(`(dry-run) ${spec.no} 업로드 생략`); continue; }

    const n = parseInt(spec.no, 10);
    const fileName = `inspect/${Date.now()}_${n}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error: upErr } = await supabase.storage
      .from('hazard-photos')
      .upload(fileName, fs.readFileSync(imgPath), { contentType: 'image/jpeg', upsert: false });
    if (upErr) throw new Error(`Storage 실패: ${upErr.message}`);
    const photoUrl = supabase.storage.from('hazard-photos').getPublicUrl(fileName).data.publicUrl;

    const { data: row, error: dbErr } = await supabase
      .from('hazard_reports')
      .insert({
        photo_url: photoUrl,
        description: spec.description,
        location: spec.no,
        created_by: prev.created_by,
        user_id: prev.user_id,
        category: 'inspect',
      })
      .select('id, location, created_at')
      .single();
    if (dbErr) throw new Error(`DB 실패: ${dbErr.message}`);

    console.log(`\n✓ 등록 완료 — ${row.location} id=${row.id.slice(0, 8)} created_at=${row.created_at}`);
    console.log(`  photo_url: ${photoUrl}`);
  }
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
