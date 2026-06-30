// 안전상식 시드: YouTube 영상 1건 + 보조배터리 이미지 1건
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: 'c:/Users/smrt2/Documents/GitHub/train-dia/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const REGISTRAR = { sabun: '21714375', name: '관리자' };  // 시드 등록자 (관리자)

async function main() {
  // 1) 동영상 — 리튬 배터리 화재 생존 가이드
  const { data: v, error: ev } = await supabase
    .from('safety_tips')
    .insert({
      title: '리튬 배터리 화재 생존 가이드',
      description: '리튬 배터리 화재 발생 시 대피·초동 대응 요령. 운행 중 만일의 상황 대비 필수 시청.',
      content_type: 'video',
      media_url: 'https://youtu.be/aD-VLM7JyTQ',
      created_by_sabun: REGISTRAR.sabun,
      created_by_name: REGISTRAR.name,
    })
    .select('id')
    .single();
  if (ev) { console.error('video insert:', ev.message); process.exit(1); }
  console.log('✓ video inserted', v.id);

  // 2) 이미지 — 보조배터리 화재 대응 예방 가이드
  const imgPath = 'C:/Users/smrt2/Downloads/보조배터리 화재 대응 예방 가이드 (1).png';
  const buffer = fs.readFileSync(imgPath);
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.png`;

  const { error: ue } = await supabase.storage
    .from('safety-tips')
    .upload(fileName, buffer, { contentType: 'image/png', upsert: false });
  if (ue) { console.error('upload:', ue.message); process.exit(1); }

  const url = supabase.storage.from('safety-tips').getPublicUrl(fileName).data.publicUrl;
  console.log('✓ image uploaded', url);

  const { data: i, error: ei } = await supabase
    .from('safety_tips')
    .insert({
      title: '보조배터리 화재 대응 예방 가이드',
      description: '보조배터리 화재 예방·초동 대응 요령. 휴대용 배터리 사용 시 주의사항 정리.',
      content_type: 'image',
      media_url: url,
      created_by_sabun: REGISTRAR.sabun,
      created_by_name: REGISTRAR.name,
    })
    .select('id')
    .single();
  if (ei) { console.error('image insert:', ei.message); process.exit(1); }
  console.log('✓ image entry inserted', i.id);

  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
