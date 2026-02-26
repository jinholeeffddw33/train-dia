// data.js의 s 필드를 출근시각 → 출발시간으로 일괄 교체
const fs = require('fs');
const path = require('path');

// 추출 결과 JSON 읽기
const update = JSON.parse(fs.readFileSync(path.join(__dirname, 'departure-update.json'), 'utf8'));

// data.js 읽기
const dataPath = path.join(__dirname, 'data.js');
let content = fs.readFileSync(dataPath, 'utf8');

// 섹션별 교번 s값 교체
const sections = ['p_ord', 'p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol'];
let totalUpdated = 0;

for (const section of sections) {
  if (!update[section]) { console.log(`${section}: 데이터 없음`); continue; }

  // 섹션 시작/끝 위치 찾기
  const sectionStart = content.indexOf(`${section}: {`);
  if (sectionStart === -1) { console.log(`${section}: 섹션 못 찾음`); continue; }

  // 다음 섹션 또는 };까지 범위 결정
  let sectionEnd;
  const nextSections = sections.filter(s => s !== section);
  const candidates = nextSections.map(s => content.indexOf(`${s}: {`, sectionStart + 10)).filter(i => i > sectionStart);
  candidates.push(content.indexOf('};', sectionStart));
  sectionEnd = Math.min(...candidates.filter(i => i > 0));

  const before = content.slice(0, sectionStart);
  let sectionContent = content.slice(sectionStart, sectionEnd);
  const after = content.slice(sectionEnd);

  let sectionUpdated = 0;

  for (const [dia, data] of Object.entries(update[section])) {
    // "교번": {s:"XX:XX", 패턴 찾아서 s값만 교체
    // 대기교번은 건드리지 않음
    if (dia.startsWith('대')) continue;

    const newS = data.s;
    if (!newS) continue;

    // 정확한 교번 매칭: "1": {s:"06:25", 등
    const regex = new RegExp(`"${dia}":\\s*\\{s:"[^"]*"`, 'g');
    const replacement = `"${dia}": {s:"${newS}"`;

    if (regex.test(sectionContent)) {
      sectionContent = sectionContent.replace(regex, replacement);
      sectionUpdated++;
    } else {
      console.log(`  ${section}/${dia}: 매칭 실패`);
    }
  }

  content = before + sectionContent + after;
  console.log(`${section}: ${sectionUpdated}개 교번 업데이트`);
  totalUpdated += sectionUpdated;
}

// 코멘트 업데이트: s=출근 → s=출발
content = content.replace('// s=출근, e=퇴근', '// s=출발, e=퇴근');

// 저장
fs.writeFileSync(dataPath, content, 'utf8');
console.log(`\n총 ${totalUpdated}개 교번 s필드 → 출발시간 교체 완료`);

// 검증: 몇 개 샘플 확인
const verifyContent = fs.readFileSync(dataPath, 'utf8');
const samples = [
  { section: 'p_ord', dia: '1', expected: '06:55' },
  { section: 'p_ord', dia: '19', expected: '07:37' },
  { section: 'p_ord', dia: '44', expected: '12:47' },
  { section: 'p_hol', dia: '1', expected: '07:10' },
  { section: 'p_ordord', dia: '90', expected: '21:29' },
  { section: 'p_holord', dia: '90', expected: '21:49' },
];

console.log('\n=== 샘플 검증 ===');
let allOk = true;
for (const s of samples) {
  const match = verifyContent.match(new RegExp(`${s.section}:[\\s\\S]*?"${s.dia}":\\s*\\{s:"([^"]*?)"`));
  const found = match ? match[1] : 'NOT_FOUND';
  const ok = found === s.expected;
  console.log(`${ok ? '✓' : '✗'} ${s.section}/${s.dia}: ${found} (expected ${s.expected})`);
  if (!ok) allOk = false;
}
console.log(allOk ? '\n모든 샘플 검증 통과!' : '\n검증 실패 항목 있음!');
