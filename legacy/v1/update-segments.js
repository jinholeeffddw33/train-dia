// data.js에 구간 데이터(g 필드) 삽입
const fs = require('fs');
const path = require('path');

const segData = JSON.parse(fs.readFileSync(path.join(__dirname, 'segments-data.json'), 'utf8'));
const dataPath = path.join(__dirname, 'data.js');
let content = fs.readFileSync(dataPath, 'utf8');

const sections = ['p_ord', 'p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol'];
let totalUpdated = 0;

for (const section of sections) {
  if (!segData[section]) continue;

  // 섹션 경계 찾기
  const secStart = content.indexOf(`${section}: {`);
  if (secStart === -1) continue;

  const candidates = sections
    .filter(s => s !== section)
    .map(s => content.indexOf(`${s}: {`, secStart + 10))
    .filter(i => i > secStart);
  candidates.push(content.indexOf('};', secStart));
  const secEnd = Math.min(...candidates.filter(i => i > 0));

  const before = content.slice(0, secStart);
  let secContent = content.slice(secStart, secEnd);
  const after = content.slice(secEnd);

  for (const [dia, segInfo] of Object.entries(segData[section])) {
    if (!segInfo.g || segInfo.g.length === 0) continue;

    // g 필드 문자열 생성
    const gParts = segInfo.g.map(seg => {
      let s = `{d:"${seg.d}",a:"${seg.a}"`;
      if (seg.n && seg.n.length > 0) s += `,n:[${seg.n.join(',')}]`;
      s += '}';
      return s;
    });
    const gStr = `g:[${gParts.join(',')}]`;

    // 해당 교번 라인 찾기: "교번": {s:"...",e:"...",t:"...",m:"..."}
    // 기존 g 필드가 있으면 제거 후 재삽입
    const lineRegex = new RegExp(`("${dia}":\\s*\\{[^}]*(?:,g:\\[[^\\]]*\\])?)\\}`, 'g');

    // 더 안전한 방식: 라인 단위 처리
    const lines = secContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 정확한 교번 매칭 (앞뒤 구분)
      const diaPattern = `"${dia}":`;
      if (!line.includes(diaPattern)) continue;
      // "1": 이 "11": 에 매칭되지 않도록 정확한 위치 확인
      const idx = line.indexOf(diaPattern);
      if (idx < 0) continue;
      // 교번 앞 문자가 숫자가 아닌지 확인 (공백 또는 줄 시작)
      if (idx > 0) {
        const prevChar = line[idx - 1];
        if (prevChar >= '0' && prevChar <= '9') continue;
      }

      // 기존 g 필드 제거
      let cleaned = line.replace(/,g:\[[^\]]*\]/g, '');

      // 마지막 } 앞에 g 필드 삽입
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace < 0) continue;

      lines[i] = cleaned.slice(0, lastBrace) + ',' + gStr + cleaned.slice(lastBrace);
      totalUpdated++;
      break;
    }
    secContent = lines.join('\n');
  }

  content = before + secContent + after;
}

// 코멘트 업데이트
content = content.replace(
  '// s=출발, e=퇴근, t=근무, m=운전행로',
  '// s=출발, e=퇴근, t=근무, m=운전행로, g=구간[{d=출발,a=도착,n=열차번호[]}]'
);

fs.writeFileSync(dataPath, content, 'utf8');
console.log(`${totalUpdated}개 교번에 구간 데이터(g) 삽입 완료`);

// 검증
const verify = fs.readFileSync(dataPath, 'utf8');

// 교번 16 확인
const m16 = verify.match(/"16":\s*\{([^]*?)\}/);
if (m16) {
  const hasG = m16[1].includes('g:[');
  const segs = m16[1].match(/g:\[(.+?)\]/);
  console.log(`\n교번 16 검증: g필드 ${hasG ? '있음' : '없음'}`);
  if (segs) {
    const segCount = (segs[1].match(/\{d:/g) || []).length;
    console.log(`  구간 수: ${segCount}`);
    console.log(`  g값: ${segs[0].slice(0, 120)}...`);
  }
}
