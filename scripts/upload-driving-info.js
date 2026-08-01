#!/usr/bin/env node
/**
 * 7. 2026년 운전정보(1호~7호).pdf 7개 페이지를 운전 정보로 등록.
 * 각 페이지: 사진(렌더된 JPG) + 제목 + 분류 [열차] + 짧은 설명
 * 1호 → 7호 순으로 등록되어 7호가 가장 최신 (대시보드 최상단).
 *
 * 등록 후 사용자가 안전관리에서 수정 가능 (HazardDetail 편집 기능).
 *
 * 사용:
 *   node scripts/upload-driving-info.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PDF_PATH = String.raw`C:\Users\smrt2\Downloads\7. 2026년 운전정보(1호~7호).pdf`;
const TMP_DIR = path.join(__dirname, '..', '.tmp_driving');
const DRY_RUN = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/* 작성자는 환경변수로 받는다 — 저장소가 공개라 실명·사번을 코드에 남기지 않는다.
   .env.local 에 AUTHOR_NAME / AUTHOR_SABUN 을 넣거나 실행 시 앞에 붙여 전달. */
const AUTHOR_NAME = process.env.AUTHOR_NAME;
const AUTHOR_SABUN = process.env.AUTHOR_SABUN;
if (!AUTHOR_NAME || !/^\d{8}$/.test(AUTHOR_SABUN ?? '')) {
  console.error('AUTHOR_NAME, AUTHOR_SABUN(8자리) 환경변수가 필요합니다.');
  process.exit(1);
}

/** 페이지별 제목·요약 (이미지 확인 후 직접 작성) */
const PAGES = [
  {
    index: 1,
    title: '4호선 길음역 하선 열차 차상신호장치 고장',
    summary: '제4057열차(459편성) 미아역 초과정차 후 ADU 60km/h→15km/h 현시되며 비상제동 반복 체결. MC-key 재투입·AFS 취급으로 미아사거리까지 운행 후 길음역에서 회송. 원인: 승무원 응급조치 소홀. 재발방지: 사고사례 특별교육, 정위치정차 조정 후 EB위치 확인 철저.',
  },
  {
    index: 2,
    title: '4호선 신길온천역 하선 정지신호 위반',
    summary: '제4609열차(466편성) 신길온천역 진입 시 1폐색 주의신호 미인지로 속도초과·ATS 경보 동작, 비상제동했으나 장내신호기(1A) 진과정차. 원인: 신호 확인 소홀, 전자기기 OFF 미흡. 재발방지: 승무 중 전자기기 전원 OFF 철저, DSD 무력화 금지, 지적확인환호 철저.',
  },
  {
    index: 3,
    title: '5호선 방화차량기지 유치선 입환 중 궤도 이탈',
    summary: '538편성 검사고(D4번)→유치선(S11번) 입환 중 가드레일 부근에서 6호차 1대차 탈선 후 약 50m 진행. 원인: 규정속도(20km/h) 위반, 타오름에 의한 궤도이탈 추정. 재발방지: 기지구내 제한속도 구간 준수 교육, 신호·진로 확인 및 지적확인환호 철저.',
  },
  {
    index: 4,
    title: '7호선 어린이대공원역 하선 제동풀림 안됨',
    summary: '제7607열차(749편성) 1칸(7249호) 제동풀림 안됨 고장으로 어린이대공원역 승객 하차, 청담역 유치 후 천왕기지 입고. 원인: 7249호 ECU 불량, 출고 중 17회 발생 보고 미흡. 재발방지: 출고 점검 철저, 차량 고장 발생 시 차량교환 후 출고(고장차 출고 절대 금지).',
  },
  {
    index: 5,
    title: '5호선 장한평역 하선 반대편 출입문 개방',
    summary: '제5655열차(564편성) 장한평역 도착 후 출입문 폐문→재취급(운전모드 수동, 출입문 수/수) 시 반대편 출입문 개방되어 민원 발생. 원인: 수동 취급 시 반대쪽 출입문 스위치 취급, 승강장 방향 확인 소홀. 재발방지: 측창문 개방 후 지적확인환호, 중앙 제어대 출입문 열림 스위치 취급 금지.',
  },
  {
    index: 6,
    title: '5호선 명일역 하선 반대편 출입문 개방',
    summary: '하남검단산행 제5087열차(517편성) 명일역 도착 시 출입문 취급 후 반대편 출입문 재개방(약 11초)으로 고객센터 민원 접수. 원인: 수동 취급 시 반대쪽 스위치, 승강장 방향 확인 소홀. 재발방지: 안전패트롤 2단계 경보 발령(2주간), 출입문 재취급 시 반드시 승강장 방향 지적확인환호.',
  },
  {
    index: 7,
    title: '7호선 군자역 하선 미달정차 후 후속조치 미흡',
    summary: '제7125열차(772편성) 군자역 하선 3m 미달정차, 수동운전모드 전환 후 정위치 조정(750mm 미달), 출입문 및 PSD 수동 취급, 1-1 PSD 조기 닫힘으로 미하차 승객 민원. 원인: 자동운전 중 미달정차·정위치 정차 미흡(2회), 관제 미보고 임의조치. 재발방지: 정위치 조정 시 정위치범위 확인 후 출입문 개방, 정위치정차 유도안내표시등 양호 상태 반드시 확인.',
  },
];

// ─── PDF → 페이지별 JPG 이미지 생성 ───
function renderPdfPages() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const py = `
import fitz, os, sys
pdf = fitz.open(r"${PDF_PATH}")
out_dir = r"${TMP_DIR.replace(/\\/g, '\\\\')}"
for i, page in enumerate(pdf, 1):
    pix = page.get_pixmap(dpi=150)
    img_path = os.path.join(out_dir, f"page-{i:02d}.jpg")
    pix.save(img_path, jpg_quality=85)
sys.stdout.write(f"rendered {len(pdf)} pages\\n")
`;
  const script = path.join(TMP_DIR, 'render.py');
  fs.writeFileSync(script, py, 'utf8');
  const out = execSync(`python "${script}"`, { encoding: 'utf8' });
  console.log(out.trim());
}

async function uploadOne(spec) {
  const description = `[열차] ${spec.title}\n${spec.summary}`;
  const imgPath = path.join(TMP_DIR, `page-${String(spec.index).padStart(2, '0')}.jpg`);

  console.log(`\n[${spec.index}/${PAGES.length}] ${spec.title}`);
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
      location: '',
      created_by: AUTHOR_NAME,
      user_id: userId,
      category: 'inspect',
    })
    .select('id, created_at')
    .single();
  if (dbErr) throw new Error(`DB 실패: ${dbErr.message}`);
  console.log(`  ✓ id=${row.id.slice(0, 8)} created_at=${row.created_at}`);
  await new Promise(r => setTimeout(r, 700)); // created_at 순서 보장
}

(async () => {
  console.log(DRY_RUN ? '=== DRY-RUN ===' : '=== UPLOAD 시작 ===');
  renderPdfPages();
  for (const spec of PAGES) {
    await uploadOne(spec);
  }
  console.log(`\n=== 완료: ${PAGES.length}건 ===`);
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
