#!/usr/bin/env node
/**
 * 운전정보 17호·18호·19호 등록.
 *
 * 17호 5호선 행당역 하선 출입문 1개 열림불가
 * 18호 2호선 도림천역 내선 승강장안전문 안열림 / 전자기기 사용 및 후부감시 미이행
 * 19호 유관기관(한국철도공사) 중대재해 사고사례 전파
 *
 * 이번 원본은 호별 낱장 PDF 다(15·16호처럼 묶음이 아니다). 각 파일의 1쪽을 렌더한다.
 * 첨부를 PDF 가 아닌 이미지로 넣는 이유는 14호와 같다 — HazardDetail 은 photo_url 하나만
 * 읽어서 .pdf 를 넣으면 인라인 미리보기가 사라진다.
 *
 * 본문은 원문 그대로 옮긴다(요약·의역 금지). 원본 PDF 에서 추출한 텍스트는 한글 띄어쓰기가
 * 모두 붙어 나오는데(HWP→PDF 변환 특성), 읽을 수 없으므로 띄어쓰기만 되살렸다. 낱말은 그대로다.
 *
 * 게시자는 직전 호 행에서 그대로 가져온다 — 스크립트에 사람 이름·사번을 박지 않기 위해서다.
 *
 * 사용: node scripts/upload-driving-info-17-19.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DOWNLOADS = String.raw`C:\Users\smrt2\Downloads`;
const TMP_DIR = path.join(__dirname, '..', '.tmp_driving');
const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SPECS = [
  {
    no: '17호',
    pdf: '운전정보 2026-17.pdf',
    description: `[열차] 5호선 행당역 하선 출입문 1개 열림불가
【발생개요】
제5125열차(551편성) 방화차량기지 출고점검 시 견습기관사에게 출입문 관련 교육을 실시 중 출입문 걸쇠 쇄정 후 미복귀하여 출고, 하남검단산행으로 운행 중 관제로부터 출입문 1개 안열림 통보받아 행당역에서 현장 확인 후 관제 지시에 의거 승객 하차 후 회송 입고함
【원인】
1차원인: 기기취급 후 정상복귀 확인 소홀
2차원인: 출입문 전체 열림 확인 소홀
【재발방지 대책】
1. 사고사례 특별교육 실시
2. 승무원 기본업무 준수 철저
3. 견습기관사 교육 후 관련 차단기 및 기기상태 확인 철저
4. 출고점검 순서 및 내용 교육(전동차승무원업무예규 제20조 별표2)
【발생 일시·장소】
1. 일시: '26.8.23.(일), 19:14경
2. 장소: 5호선 행당역 상선
【출고점검 순서 및 내용(제20조 관련)】 전동차승무원업무예규 별표2
[출고점검 내용]
· 출입문 기능시험 확인
· 출입문 비상콕크 상태 확인
· 출입문 여닫음 상태 확인`,
  },
  {
    no: '18호',
    pdf: '2026-18.pdf',
    description: `[열차] 2호선 도림천역 내선 승강장안전문 안열림 / 전자기기 사용 및 후부감시 미이행(차양막 사용)
【발생개요】
제5502열차(248편성) 신정차량기지에서 출고 후 신도림역 정상출발 다음역 도림천역 내선에서 출입문 취급하였으나, 승강장안전문 전체 안열림으로 승객이 승·하차하지 못한 상태에서 출발한 상황
2호선 본선운행열차 전자기기(블루투스 이어폰) 및 불필요한 차양막 사용
【원인】
1차원인: 승강장안전문 통신오류(추정)
2차원인: 승무원 기본업무 소홀
- HMI를 통한 PSD 상태 및 CCTV를 통한 승객 승·하차 확인 소홀
- 형식적인 지적확인환호 시행
【재발방지 대책】
1. 사고사례 특별교육 실시
2. 지적확인환호 철저
3. 첫차 및 막차 운행 시 역직원 '출발지시전호' 확인 철저
4. 승강장안전문 고장 시 조치방법 숙지 철저
5. 운전실 내 불안전한 행동 금지(전자기기 사용 및 운전실 제어대 위 불안전한 물품 금지)
6. 차양막 사용 교육(운전실 차양막 사용 시 전방주사에 지장을 주지 않도록 할 것)
7. 안전패트롤 1단계 발령('26.8.27.(목) ~ 9.9.(수) 2주간)
【발생 일시·장소】
1. 일시: '26.8.27.(목)
2. 장소: 2호선 본선`,
  },
  {
    no: '19호',
    pdf: '운전정보 2026-19.pdf',
    description: `[열차] 유관기관(한국철도공사) 중대재해 사고사례 전파
【발생개요】
'26.8.29.(토) 07:20경 의왕역 #24번선에서 북부인상선을 경유하여 냉연선(J선)으로 차량(입환기: DL7435호 + 화물차 12칸)을 이동(후진)하던 중 입환작업자가 차량에 접촉
사망 1명(지원역무원: 사무영업 5급 1967년생)
【원인】
관계기관 조사 중
【재발방지 대책】
1. 구내운전 및 차량이동 개시 전 작업자 위치 및 안전상태 확인 철저
2. 전호 및 무선통화 상호확인 철저
3. 전호가 불명확하거나 작업자 위치가 확인되지 않을 경우 즉시 정차
4. 입환작업 관계자 간 작업내용 및 차량이동 정보 공유 철저
5. 구내운전 시 제한속도 준수 및 전도주시 철저
【시동전호】 차량기지운전취급내규 제20조
③ 차량기지 내에서 전동차의 운전을 개시할 경우에는 "차 움직입니다"의 시동방송을 2회 이상 시행하고, 주의기적을 1회 울린 후 작업자가 대피할 시간적 여유를 두고 단속운전 취급으로 시동하여야 한다.`,
  },
];

function resolvePython() {
  for (const cmd of ['py -3', 'python']) {
    try {
      execSync(`${cmd} -c "import fitz"`, { stdio: 'ignore' });
      return cmd;
    } catch { /* 다음 후보 */ }
  }
  throw new Error('PyMuPDF(fitz) 를 쓸 수 있는 python 을 찾지 못했다.');
}

function renderFirstPage(python, pdfName, tag) {
  const pdfPath = path.join(DOWNLOADS, pdfName);
  if (!fs.existsSync(pdfPath)) throw new Error(`PDF 없음: ${pdfPath}`);
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const out = path.join(TMP_DIR, `driving-${tag}.jpg`);
  const py = `
import fitz, sys
pdf = fitz.open(r"${pdfPath}")
pix = pdf[0].get_pixmap(dpi=200)
pix.save(r"${out}", jpg_quality=85)
sys.stdout.write(f"${tag} {pix.width}x{pix.height}\\n")
`;
  const script = path.join(TMP_DIR, `render-${tag}.py`);
  fs.writeFileSync(script, py, 'utf8');
  console.log(execSync(`${python} "${script}"`, { encoding: 'utf8' }).trim());
  return out;
}

(async () => {
  console.log(`=== ${DRY_RUN ? 'DRY-RUN' : 'UPLOAD'} 운전정보 ${SPECS.map((s) => s.no).join(', ')} ===`);
  const python = resolvePython();

  /* 게시자는 이미 올라가 있는 마지막 호(16호)에서 한 번만 가져온다 */
  const { data: prev, error: prevErr } = await supabase
    .from('hazard_reports').select('created_by, user_id').eq('location', '16호').single();
  if (prevErr) throw new Error(`16호 조회 실패: ${prevErr.message}`);
  console.log(`게시자(16호 기준): ${prev.created_by}`);

  for (const spec of SPECS) {
    console.log(`\n──────── ${spec.no} ────────`);

    const { data: dup } = await supabase
      .from('hazard_reports').select('id').eq('location', spec.no).maybeSingle();
    if (dup) throw new Error(`이미 ${spec.no} 가 있다 (id=${dup.id}). 중복 등록 방지로 중단.`);

    const imgPath = renderFirstPage(python, spec.pdf, spec.no);
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
