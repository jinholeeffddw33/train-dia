// 엑셀 행로표에서 개별 열차의 출발/도착 시간을 파싱하여
// 소요시간 기반 행로 약호(m 필드) 검증 스크립트
// xlsx 모듈은 zinosb-marketplace에서 사용

const XLSX = require('C:/Users/smrt2/zinosb-marketplace/node_modules/xlsx');
const path = require('path');

const file = path.join('D:', '교육자료', '다이아 작업',
  '답십리사업소_행로표_260322_210054(엑셀)',
  '답십리사업소_행로표_260322_210054(엑셀).xlsm');

const wb = XLSX.readFile(file, { cellStyles: true, raw: true });

// ─── 기준 소요시간 (분) ───
const REF = {
  '답방': 60,   // 답십리→방화
  '답마': 26,   // 답십리→마천
  '답하': 36,   // 답십리→하남검단산
  '답영': 24,   // 답십리→영등포구청
  '답강': 15,   // 답십리→강동
  '답군': 8,    // 답십리→군자
  '답상': 30,   // 답십리→상일동
  '방마': 86,   // 방화→마천
  '방하': 96,   // 방화→하남검단산
  '방답': 60,   // 방화→답십리
  '마답': 26,   // 마천→답십리
  '하답': 36,   // 하남검단산→답십리
  '영답': 24,   // 영등포구청→답십리
  '하방': 96,   // 하남검단산→방화
  '마방': 86,   // 마천→방화
};

function timeHM(val) {
  if (typeof val !== 'number' || val <= 0 || val >= 2) return null;
  const totalMin = Math.round(val * 1440);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return { h, m, str: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, totalMin };
}

function minDiff(t1, t2) {
  return t2.totalMin - t1.totalMin;
}

// 열차번호로 방향/구간 추정
function trainInfo(num) {
  if (num >= 5500 && num <= 5899) {
    return { line: '마천', dir: num % 2 === 0 ? '상행' : '하행' };
  }
  if (num >= 5000 && num <= 5499) {
    return { line: '하남', dir: num % 2 === 0 ? '상행' : '하행' };
  }
  if (num >= 1000 && num <= 1999) {
    return { line: '기지', dir: num % 2 === 0 ? '상행' : '하행' };
  }
  if (num >= 2000 && num <= 2999) {
    return { line: '하남기지', dir: num % 2 === 0 ? '상행' : '하행' };
  }
  if (num >= 5900 && num <= 5999) {
    return { line: '회송', dir: num % 2 === 0 ? '상행' : '하행' };
  }
  return { line: '?', dir: '?' };
}

// 열차번호 시퀀스에서 구간별 방향/종착 추정
function estimateSegmentRoute(trains, depTime, arrTime) {
  const duration = minDiff(depTime, arrTime);
  const parts = [];

  // 각 열차를 분석
  for (const t of trains) {
    const info = trainInfo(t);
    parts.push({ num: t, ...info });
  }

  return { duration, parts, dep: depTime.str, arr: arrTime.str };
}

// ─── 현재 schedules.ts에서 m 필드 추출 ───
const schedules = {};
// 간단하게 schedules.ts를 파싱하진 않고, 엑셀에서 직접 비교하겠음

// ─── 엑셀 파싱 ───
const ALL_SHEETS = {
  '평일': { prefix: 'p_ord', diaRange: [1, 54] },
};

for (const [sheetName, config] of Object.entries(ALL_SHEETS)) {
  const ws = wb.Sheets[sheetName];
  if (!ws) { console.error(`Sheet "${sheetName}" not found`); continue; }
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  console.log(`\n${'='.repeat(80)}`);
  console.log(`시트: ${sheetName}`);
  console.log(`${'='.repeat(80)}`);

  // 각 다이아 블록 찾기
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    if (typeof row[0] !== 'string') continue;
    if (!row[0].includes('출근') || !row[0].includes('시각')) continue;

    // 출근시각 값 찾기
    let clockInRow = null;
    for (let sr = r + 1; sr < Math.min(r + 6, data.length); sr++) {
      const srow = data[sr];
      if (srow && typeof srow[0] === 'number' && srow[0] > 0 && srow[0] < 1) {
        clockInRow = sr;
        break;
      }
    }
    if (clockInRow === null) continue;

    // 교번 번호 찾기
    let diaNum = null;
    for (let dr = clockInRow + 1; dr < Math.min(clockInRow + 5, data.length); dr++) {
      const drow = data[dr];
      if (!drow) continue;
      const v = drow[0];
      if (typeof v === 'number' && v >= config.diaRange[0] && v <= config.diaRange[1]) {
        diaNum = v;
        break;
      }
    }
    if (!diaNum) continue;

    // 퇴근시각 블록 찾기
    let retireRow = null;
    for (let rr = clockInRow + 3; rr < Math.min(clockInRow + 60, data.length); rr++) {
      const rrow = data[rr];
      if (rrow && typeof rrow[0] === 'string' &&
          rrow[0].includes('퇴근') && rrow[0].includes('시각')) {
        retireRow = rr;
        break;
      }
    }
    if (!retireRow) continue;

    // 열차번호와 시간 데이터 스캔
    // 노란셀 행에서 열차번호 + 시간 추출
    const trainEntries = []; // {row, col, num, time}

    for (let yr = clockInRow; yr < retireRow; yr++) {
      const yrow = data[yr];
      if (!yrow) continue;

      for (let c = 0; c < Math.min(yrow.length || 0, 25); c++) {
        const v = yrow[c];
        // 열차번호 (1000~9999)
        if (typeof v === 'number' && v >= 1000 && v <= 9999) {
          // 이 열차번호 주변에서 시간 찾기
          // 같은 행에서 앞뒤 시간값 찾기
          let depTimeVal = null;
          let arrTimeVal = null;

          // 열 기준으로 왼쪽에서 출발시간, 오른쪽에서 도착시간
          for (let tc = 0; tc < c; tc++) {
            if (typeof yrow[tc] === 'number' && yrow[tc] > 0 && yrow[tc] < 1) {
              depTimeVal = yrow[tc];
            }
          }
          for (let tc = c + 1; tc < Math.min(yrow.length || 0, 25); tc++) {
            if (typeof yrow[tc] === 'number' && yrow[tc] > 0 && yrow[tc] < 1) {
              arrTimeVal = yrow[tc];
              break;
            }
          }

          trainEntries.push({
            row: yr, col: c, num: v,
            depTime: depTimeVal ? timeHM(depTimeVal) : null,
            arrTime: arrTimeVal ? timeHM(arrTimeVal) : null,
          });
        }
      }
    }

    // 교번별 출력 (51-54는 정답 확인용)
    const isProtected = [51,52,53,54].includes(diaNum);

    console.log(`\n--- 다이아 ${diaNum} ${isProtected ? '(정답확인)' : ''} ---`);

    // 세그먼트 분석 - 퇴근시각 블록에서 구간별 시간 추출
    const headerRow = retireRow + 1;
    const upperRow = retireRow + 2;
    const lowerRow = retireRow + 3;

    if (lowerRow < data.length) {
      const upper = data[upperRow];
      const lower = data[lowerRow];

      if (upper && lower) {
        for (let si = 0; si < 3; si++) {
          const col = 3 + si;
          const startVal = lower[col];
          const endVal = upper[col];

          if (startVal != null && typeof startVal === 'number' && startVal > 0 && startVal < 2) {
            const dep = timeHM(startVal);
            const arr = (endVal != null && typeof endVal === 'number') ? timeHM(endVal) : null;
            if (dep && arr) {
              const dur = minDiff(dep, arr);
              console.log(`  구간${si+1}: ${dep.str} → ${arr.str} (${dur}분)`);
            }
          }
        }
      }
    }

    // 개별 열차 분석
    if (trainEntries.length > 0) {
      // 열차번호별 정리
      const byNum = {};
      for (const e of trainEntries) {
        if (!byNum[e.num]) byNum[e.num] = [];
        byNum[e.num].push(e);
      }

      // 열차번호 순서대로 (행 순서)
      const sorted = trainEntries.sort((a, b) => a.row - b.row || a.col - b.col);

      // 연속 열차 그룹핑 (같은 세그먼트의 열차들)
      let lastRow = -999;
      let segIdx = 0;

      console.log('  열차:');
      for (const e of sorted) {
        if (e.row - lastRow > 3) segIdx++;
        const info = trainInfo(e.num);
        const depStr = e.depTime ? e.depTime.str : '?';
        const arrStr = e.arrTime ? e.arrTime.str : '?';
        console.log(`    [${segIdx}] ${e.num} (${info.line}/${info.dir}) row${e.row} dep=${depStr} arr=${arrStr}`);
        lastRow = e.row;
      }
    }
  }
}
