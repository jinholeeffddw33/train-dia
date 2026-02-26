// data.js의 s 필드를 출근시각으로 복원 + e 필드도 엑셀 기준으로 갱신
const fs = require('fs');
const path = require('path');

const clockinData = JSON.parse(fs.readFileSync(path.join(__dirname, 'clockin-data.json'), 'utf8'));
const dataPath = path.join(__dirname, 'data.js');
let content = fs.readFileSync(dataPath, 'utf8');

const sections = ['p_ord', 'p_hol', 'p_ordord', 'p_ordhol', 'p_holord', 'p_holhol'];
let totalUpdated = 0;

for (const section of sections) {
  if (!clockinData[section]) continue;

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

  const lines = secContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const [dia, info] of Object.entries(clockinData[section])) {
      const diaPattern = `"${dia}":`;
      const idx = lines[i].indexOf(diaPattern);
      if (idx < 0) continue;
      if (idx > 0 && lines[i][idx - 1] >= '0' && lines[i][idx - 1] <= '9') continue;

      // s 필드 교체
      if (info.s) {
        lines[i] = lines[i].replace(/s:"[^"]*"/, `s:"${info.s}"`);
      }
      // e 필드 교체
      if (info.e) {
        lines[i] = lines[i].replace(/e:"[^"]*"/, `e:"${info.e}"`);
      }
      totalUpdated++;
      break;
    }
  }
  secContent = lines.join('\n');
  content = before + secContent + after;
}

// 코멘트 복원
content = content.replace(
  '// s=출발, e=퇴근, t=근무, m=운전행로, g=구간[{d=출발,a=도착,n=열차번호[]}]',
  '// s=출근, e=퇴근, t=근무, m=운전행로, g=구간[{d=출발,a=도착,n=열차번호[]}]'
);

fs.writeFileSync(dataPath, content, 'utf8');
console.log(`${totalUpdated}개 교번 s/e 필드 → 출근/퇴근시각 복원 완료`);
