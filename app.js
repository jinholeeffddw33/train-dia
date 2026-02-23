// ====================================================================
// 답십리 기관사 DIA — App Logic (v3.2 PWA)
// ====================================================================

// ===== CONFIG =====
const API_KEY = '5a724369526a696e34366552514247';
const TRAIN_POLL_MS = 120000; // 2분 간격 폴링

// ===== SUPABASE =====
const SB_URL = 'https://uhlxokrskgloupjelqlf.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVobHhva3Jza2dsb3VwamVscWxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjAzNTksImV4cCI6MjA4NzIzNjM1OX0.nNrV8FMVVz35uzcKMOesiziUBJ5YPq19U1_LgHtlr5g';
let sb = null;

// ===== STATE =====
let cur = null, calY, calM, selDate, c1 = null, c2 = null, cmpY, cmpM;
let mTarget = 'home', sopIdx = -1;
let alerts = [], alertSeverity = 'high', lineBranch = 'main';
let weekPreviewDate = null; // null = showing today
let trainData = [], trainTimer = null;
let lineViewMode = 'list', lastTrainFetch = 0, updateCounterTimer = null;

// ===== 장애알림 권한 =====
const ALERT_PIN = '5959'; // 승인된 사용자용 PIN
let alertAuthorized = false; // 세션 내 인증 상태

// ===== UTILITY =====
function td() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function isH(d) {
  const day = d.getDay();
  if (day === 0 || day === 6) return true; // 일요일 + 토요일 = 휴일
  const y = d.getFullYear(), ds = HOL[String(y)];
  if (!ds) return false;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return ds.includes(`${y}/${mm}/${dd}`);
}

function gDia(p, d) {
  if (!p || p.d === '~') return '~';
  const r = CYCLE.indexOf(p.d);
  if (r === -1) return p.d;
  const diff = Math.floor((d - DB_STD) / 864e5);
  return CYCLE[((r + diff) % CL + CL) % CL];
}

function gType(d) {
  if (d === '~' || d.startsWith('휴')) return 'rest';
  if (d.startsWith('대')) return 'standby';
  const n = parseInt(d);
  if (n >= 62 && n <= 91) return 'night';
  if (n >= 1 && n <= 44) return 'day';
  return 'rest';
}

function gSched(dia, date) {
  if (dia === '~' || dia.startsWith('휴')) return null;
  const h = isH(date);
  const tm = new Date(date);
  tm.setDate(tm.getDate() + 1);
  const th = isH(tm);
  // 야간 대기(대61~대66)는 야간 테이블 사용
  const isNight = gType(dia) === 'night' ||
    (dia.startsWith('대') && parseInt(dia.replace('대','')) >= 61);
  let t;
  if (!isNight) {
    t = h ? S.p_hol : S.p_ord;
  } else {
    if (h && th) t = S.p_holhol;
    else if (h && !th) t = S.p_holord;
    else if (!h && th) t = S.p_ordhol;
    else t = S.p_ordord;
  }
  return t[dia] || null;
}

function gLabel(d) {
  if (d === '~') return '비순환';
  if (d.startsWith('휴')) return '비번';
  if (d.startsWith('대')) return '대기';
  const n = parseInt(d);
  return n >= 62 ? '야간' : '주간';
}

function gTypeName(tp) {
  return { day: '주간 근무', night: '야간 근무', standby: '대기 근무', rest: '비번' }[tp] || '비번';
}

function gColor(t) {
  return { day: 'var(--blue)', night: 'var(--purple)', rest: 'var(--gray)', standby: 'var(--orange)' }[t] || 'var(--gray)';
}

// 출퇴근 시간에서 근무시간 계산 (tTime이 PNG일 때)
function calcWorkTime(s, e) {
  if (!s || !e || !/^\d{1,2}:\d{2}$/.test(s) || !/^\d{1,2}:\d{2}$/.test(e)) return '-';
  const sp = s.split(':'), ep = e.split(':');
  let sm = parseInt(sp[0]) * 60 + parseInt(sp[1]);
  let em = parseInt(ep[0]) * 60 + parseInt(ep[1]);
  if (em <= sm) em += 1440; // 야간 (자정 넘김)
  const diff = em - sm;
  return Math.floor(diff / 60) + ':' + String(diff % 60).padStart(2, '0');
}

function getWorkTime(sc) {
  if (!sc) return '-';
  if (sc.t && !/\.png$/i.test(sc.t)) return sc.t;
  return calcWorkTime(sc.s, sc.e);
}

// 시간 문자열("HH:MM") → 분으로 변환
function timeToMins(t) {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t.replace('기', ''))) return -1;
  var clean = t.replace('기', '');
  var p = clean.split(':');
  return (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0);
}

// 다음 근무일 탐색 (최대 7일 앞)
function getNextShift(person, fromDate) {
  for (var i = 1; i <= 7; i++) {
    var d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    var dia = gDia(person, d);
    var tp = gType(dia);
    if (tp !== 'rest') {
      var sc = gSched(dia, d);
      return { date: d, dia: dia, type: tp, schedule: sc, daysAhead: i };
    }
  }
  return null;
}

// 배너 상태 판별: 'working' | 'done' | 'idle' | 'preparing'
// - working: 출근 시간 ~ 퇴근 시간 사이 (또는 출근 2시간 이상 전)
// - done: 퇴근 후 2시간 이내 (격려 + 다음 출발)
// - idle: 퇴근 후 2시간 이후 (차분하게 다음 출발만)
// - preparing: 다음 출근 2시간 전 ~
function getBannerState(sc, nextShift, now) {
  if (!sc || !sc.s || !sc.e) return { state: 'working', next: nextShift };
  var nowMins = now.getHours() * 60 + now.getMinutes();
  var startMins = timeToMins(sc.s);
  var endMins = timeToMins(sc.e);
  if (startMins < 0 || endMins < 0) return { state: 'working', next: nextShift };

  var isNight = endMins <= startMins; // 야간 (자정 넘김)

  // 현재 근무 중인지 판별
  var isWorking;
  if (isNight) {
    isWorking = nowMins >= startMins || nowMins < endMins;
  } else {
    isWorking = nowMins >= startMins && nowMins < endMins;
  }
  if (isWorking) return { state: 'working', next: nextShift };

  // 근무 중이 아닌 경우 — 출근 전인지 퇴근 후인지 판별
  var isBeforeShift;
  if (isNight) {
    // 야간: endMins(새벽) ~ startMins(밤) 사이 = 출근 전 대기
    isBeforeShift = nowMins >= endMins && nowMins < startMins;
  } else {
    isBeforeShift = nowMins < startMins;
  }

  if (isBeforeShift) {
    // 오늘 출근 전 — 2시간 이내면 '준비' 상태
    var minsUntilToday = startMins - nowMins;
    if (minsUntilToday <= 120) {
      // 오늘 근무를 "다음 근무"로 구성
      var todayAsNext = { schedule: sc, daysAhead: 0 };
      return { state: 'preparing', next: todayAsNext, minsUntil: minsUntilToday };
    }
    // 2시간 이상 전 — 야간이면 '종료' (어젯밤 근무 끝남), 주간이면 그냥 정상 배너
    if (isNight) {
      // 야간 퇴근 후 경과: nowMins - endMins
      var minsAfterNight = nowMins - endMins;
      return calcDoneState(nextShift, nowMins, startMins, minsAfterNight);
    }
    return { state: 'working', next: nextShift };
  }

  // 오늘 퇴근 후 — 경과 시간 계산
  var minsAfterEnd = nowMins - endMins;
  return calcDoneState(nextShift, nowMins, -1, minsAfterEnd);
}

// 근무 종료 상태에서 다음 근무까지 시간 계산
// minsAfterEnd: 퇴근 후 경과 시간(분) — 2시간 넘으면 idle
function calcDoneState(nextShift, nowMins, todayStartMins, minsAfterEnd) {
  var isDone = minsAfterEnd <= 120; // 퇴근 후 2시간 이내 = done, 이후 = idle

  if (!nextShift || !nextShift.schedule || !nextShift.schedule.s) {
    return { state: isDone ? 'done' : 'idle', next: nextShift, minsUntil: null };
  }
  var nextStartMins = timeToMins(nextShift.schedule.s);
  if (nextStartMins < 0) {
    return { state: isDone ? 'done' : 'idle', next: nextShift, minsUntil: null };
  }
  // 다음 출근까지 남은 시간(분)
  var minsUntilNext;
  if (nextShift.daysAhead === 0) {
    // 오늘 근무 (야간 대기 시간 중)
    minsUntilNext = todayStartMins - nowMins;
  } else if (nextShift.daysAhead === 1) {
    minsUntilNext = (1440 - nowMins) + nextStartMins;
  } else {
    minsUntilNext = ((nextShift.daysAhead - 1) * 1440) + (1440 - nowMins) + nextStartMins;
  }
  if (minsUntilNext <= 120) {
    return { state: 'preparing', next: nextShift, minsUntil: minsUntilNext };
  }
  return { state: isDone ? 'done' : 'idle', next: nextShift, minsUntil: minsUntilNext };
}

// 남은 시간 포맷 ("약 N시간 후" / "약 N시간 N분 후")
function formatTimeUntil(mins) {
  if (!mins || mins <= 0) return '';
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  if (h === 0) return '약 ' + m + '분 후';
  if (m === 0) return '약 ' + h + '시간 후';
  return '약 ' + h + '시간 ' + m + '분 후';
}

function expandRoute(m) {
  if (!m) return '';
  const parts = m.split(',');
  const segments = [];
  let timeCode = '';
  parts.forEach(p => {
    const trimmed = p.trim();
    if (/^\d{4}$/.test(trimmed)) {
      const hh = trimmed.slice(0, 2), mm = trimmed.slice(2);
      timeCode = `${hh}:${mm}`;
    } else {
      let expanded = '';
      for (const ch of trimmed) {
        expanded += STATION_ABBR[ch] || ch;
        expanded += '→';
      }
      expanded = expanded.replace(/→$/, '');
      segments.push(expanded);
    }
  });
  let html = segments.map(s => `<span class="tc-route-seg">${s}</span>`).join('<br>');
  if (timeCode) {
    html += `<span class="tc-route-time">교대 ${timeCode}</span>`;
  }
  return html;
}

// 교대 방향 판별 — 상선/하선/기지 출발
function getRouteDirection(m) {
  if (!m || m.includes('충당여부') || m.includes('대휴')) return null;
  const UP = new Set(['방','왕','영','여','애','화','다']);
  const DOWN = new Set(['군','마','상','기','둔','강']);
  const parts = m.split(',');
  for (const p of parts) {
    const t = p.trim();
    if (/^\d{4}$/.test(t)) continue;
    if (t.includes('편승')) continue;
    // 기지 출발 (첫 구간이 기로 시작하고 답 없음)
    if (t[0] === '기' && !t.includes('답')) {
      return { dir: 'depot', label: '고덕기지 출발', sub: '고덕기지에서 직접 출발' };
    }
    const dIdx = t.indexOf('답');
    if (dIdx >= 0 && dIdx < t.length - 1) {
      const next = t[dIdx + 1];
      if (next === '(') continue;
      if (UP.has(next)) {
        return { dir: 'up', label: '▲ 상선 교대', sub: '방화 방면 승강장' };
      }
      if (DOWN.has(next)) {
        return { dir: 'down', label: '▼ 하선 교대', sub: '마천·하남 방면 승강장' };
      }
    }
  }
  return null;
}

// 역의 동서(east-west) 위치 인덱스 (방화=0 ~ 하남검단산=48)
function getStationPos(name) {
  let idx = LINE5_MAIN.indexOf(name);
  if (idx >= 0) return idx;
  idx = LINE5_MACHEON.indexOf(name);
  if (idx >= 0) return LINE5_MAIN.length + idx;
  idx = LINE5_HANAM.indexOf(name);
  if (idx >= 0) return LINE5_MAIN.length + idx;
  // 특수 위치
  if (name === '고덕기지') return LINE5_MAIN.length + 4.5; // 고덕~상일동 사이
  if (name === '둔촌오륜') return LINE5_MAIN.length;
  if (name === '다산') return LINE5_MAIN.indexOf('왕십리');
  return LINE5_MAIN.indexOf('답십리'); // fallback
}

// 방향 전환점 기준 구간 분리 (동행/서행)
function splitByDirection(stations) {
  if (stations.length < 2) return [{ stations, direction: 'east' }];
  const legs = [];
  let cur = [stations[0]], curDir = null;
  for (let i = 1; i < stations.length; i++) {
    const pp = getStationPos(stations[i - 1]);
    const cp = getStationPos(stations[i]);
    const d = cp >= pp ? 'east' : 'west';
    if (curDir && d !== curDir) {
      legs.push({ stations: [...cur], direction: curDir });
      cur = [stations[i - 1]]; // 전환점에서 새 구간 시작
    }
    curDir = d;
    cur.push(stations[i]);
  }
  if (cur.length >= 2) legs.push({ stations: cur, direction: curDir });
  return legs;
}

// 차트 위치 — 선형화 (본선→마천→하남)
function getChartIdx(name) {
  let i = LINE5_MAIN.indexOf(name);
  if (i >= 0) return i;
  i = LINE5_MACHEON.indexOf(name);
  if (i >= 0) return LINE5_MAIN.length + i;
  i = LINE5_HANAM.indexOf(name);
  if (i >= 0) return LINE5_MAIN.length + LINE5_MACHEON.length + i;
  if (name === '고덕기지') return LINE5_MAIN.length + LINE5_MACHEON.length + 3.5;
  if (name === '다산') return LINE5_MAIN.indexOf('왕십리');
  return LINE5_MAIN.indexOf('답십리');
}

// 블록별 방향 판별 (첫 세그먼트의 역 순서 기반)
function getBlockDir(blockSegs) {
  if (!blockSegs || !blockSegs.length) return null;
  const seg = blockSegs[0];
  if (!seg.stations || seg.stations.length < 2) return null;
  if (seg.stations[0] === '고덕기지') {
    return { dir: 'depot', short: '기지출발', label: '고덕기지 출발', sub: '고덕기지에서 직접 출발' };
  }
  const p0 = getStationPos(seg.stations[0]);
  const p1 = getStationPos(seg.stations[1]);
  return p1 < p0
    ? { dir: 'up', short: '▲상선', label: '▲ 상선 교대', sub: '방화 방면 승강장' }
    : { dir: 'down', short: '▼하선', label: '▼ 하선 교대', sub: '마천·하남 방면 승강장' };
}

// 현재 시각 기준 활성 블록 결정 (교대 시각에 전환)
function getActiveBlock(changeTimes, startTime) {
  if (!changeTimes.length) return 0;
  var now = new Date();
  var nowMins = now.getHours() * 60 + now.getMinutes();
  var sClean = (startTime || '06:00').replace('기', '');
  var sp = sClean.split(':');
  var startMins = (parseInt(sp[0]) || 0) * 60 + (parseInt(sp[1]) || 0);
  for (var i = changeTimes.length - 1; i >= 0; i--) {
    var cp = changeTimes[i].split(':');
    var cMins = (parseInt(cp[0]) || 0) * 60 + (parseInt(cp[1]) || 0);
    // 야간 근무: 출근 > 교대 (자정 넘김)
    if (startMins > cMins) {
      if (nowMins >= cMins && nowMins < startMins) return i + 1;
    } else {
      if (nowMins >= cMins) return i + 1;
    }
  }
  return 0;
}

function shortStn(name) {
  var map = {'영등포구청':'영등포','하남검단산':'하남','고덕기지':'기지',
    '둔촌오륜':'둔촌','올림픽공원':'올공','상일동':'상일',
    '하남풍산':'풍산','하남시청':'시청'};
  return map[name] || name;
}

// 세그먼트들에서 마천/하남 브랜치 판별
function detectBranch(segs) {
  var hasMacheon = false, hasHanam = false;
  segs.forEach(function(seg) {
    seg.stations.forEach(function(s) {
      if (LINE5_MACHEON.indexOf(s) >= 0) hasMacheon = true;
      if (LINE5_HANAM.indexOf(s) >= 0 || s === '고덕기지') hasHanam = true;
    });
  });
  return { macheon: hasMacheon, hanam: hasHanam };
}

// Y자 미니맵 렌더링 (답십리 중앙 고정, 브랜치 시각화)
function renderYMap(segs) {
  var branch = detectBranch(segs);
  // 경로에 포함된 모든 역 수집
  var routeStns = {};
  segs.forEach(function(seg) {
    seg.stations.forEach(function(s) { routeStns[s] = true; });
  });

  // 활성/비활성 브랜치 클래스
  var mCls = branch.macheon ? 'ym-active' : 'ym-dim';
  var hCls = branch.hanam ? 'ym-active' : 'ym-dim';
  // 둘 다 없으면 양쪽 동일
  if (!branch.macheon && !branch.hanam) { mCls = ''; hCls = ''; }

  // 본선 내 고정 레퍼런스 역 (% = 본선 영역 내 비율)
  // 답십리(index 32)는 본선 39역의 중간보다 약간 뒤 → 약 55% 위치
  // 방화(0) = 2%, 답십리(32) = 55%, 강동(38) = 98%
  var refStations = [
    { name: '방화', pct: 2 },
    { name: '답십리', pct: 55, home: true },
    { name: '강동', pct: 98 },
  ];

  var html = '<div class="ym-wrap"><div class="ym-row">';

  // === 본선 (방화 → 강동) ===
  html += '<div class="ym-main">';
  // 메인 라인 (방화~강동 전체)
  html += '<div class="ym-line" style="left:2%;width:96%"></div>';
  // 역 점 + 라벨
  refStations.forEach(function(st) {
    var dot = routeStns[st.name] ? ' ym-dot-on' : '';
    var label = st.home ? ' ym-home' : '';
    html += '<div class="ym-station' + label + '" style="left:' + st.pct + '%">';
    html += '<div class="ym-dot' + dot + '"></div>';
    html += '<div class="ym-name">' + shortStn(st.name) + '</div>';
    html += '</div>';
  });
  html += '</div>';

  // === 분기 영역 (강동 이후 Y자) ===
  html += '<div class="ym-fork">';

  // 마천 브랜치 (위쪽, 짧음)
  html += '<div class="ym-branch ym-macheon ' + mCls + '">';
  html += '<div class="ym-bline"></div>';
  var mDot = routeStns['마천'] ? ' ym-dot-on' : '';
  html += '<div class="ym-station ym-end"><div class="ym-dot' + mDot + '"></div>';
  html += '<div class="ym-name">마천</div></div>';
  html += '<div class="ym-blabel">' + (branch.macheon ? '운행' : '7역') + '</div>';
  html += '</div>';

  // 하남 브랜치 (아래쪽, 김)
  html += '<div class="ym-branch ym-hanam ' + hCls + '">';
  html += '<div class="ym-bline"></div>';
  var hDot = routeStns['하남검단산'] ? ' ym-dot-on' : '';
  html += '<div class="ym-station ym-end"><div class="ym-dot' + hDot + '"></div>';
  html += '<div class="ym-name">하남</div></div>';
  html += '<div class="ym-blabel">' + (branch.hanam ? '운행' : '10역') + '</div>';
  html += '</div>';

  html += '</div>'; // ym-fork
  html += '</div></div>'; // ym-row, ym-wrap
  return html;
}

function renderRouteVisual(m, startTime, endTime, bannerState) {
  if (!m) return '';
  if (m.includes('충당여부') || m.includes('대휴'))
    return `<div class="rv-text">${m}</div>`;

  const parts = m.split(',');

  // 세그먼트 파싱 + 교대 시간 추출
  const segs = [];
  let changeTimes = [];
  parts.forEach(p => {
    const trimmed = p.trim();
    if (/^\d{4}$/.test(trimmed)) {
      const hh = trimmed.slice(0, 2), mm = trimmed.slice(2);
      changeTimes.push(`${hh}:${mm}`);
      return;
    }
    const pm = trimmed.match(/\((.+)\)/);
    const note = pm ? pm[1] : '';
    const clean = trimmed.replace(/\(.+\)/, '');
    if (/^\d{4}$/.test(clean)) return;
    const stations = [];
    for (const ch of clean) {
      if (ch === '(' || ch === ')') break;
      if (STATION_ABBR[ch]) stations.push(STATION_ABBR[ch]);
    }
    if (stations.length >= 2) segs.push({ stations, note });
  });
  if (!segs.length) return '';

  // 세그먼트 note에서 교대시간 추출 (괄호 안 HH:MM)
  segs.forEach((seg, i) => {
    if (i > 0 && seg.note && /^\d{2}:\d{2}$/.test(seg.note)) {
      changeTimes.push(seg.note);
    }
  });

  // 유니크 역 수집 → 비율 기반 위치 계산
  const stSet = new Set();
  segs.forEach(seg => seg.stations.forEach(s => stSet.add(s)));
  const sorted = [...stSet].sort((a, b) => getChartIdx(a) - getChartIdx(b));

  // 비율 기반 위치 계산
  const indices = sorted.map(s => getChartIdx(s));
  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);
  const range = maxIdx - minIdx || 1;

  // 원시 비율(0~100) 계산
  const rawPos = {};
  sorted.forEach(s => {
    rawPos[s] = ((getChartIdx(s) - minIdx) / range) * 100;
  });

  // 인접 역 간 최소 12% 간격 보장
  const MIN_GAP = 12;
  const positions = {};
  positions[sorted[0]] = rawPos[sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prevPos = positions[sorted[i - 1]];
    const rawGap = rawPos[sorted[i]] - rawPos[sorted[i - 1]];
    positions[sorted[i]] = rawGap < MIN_GAP ? prevPos + MIN_GAP : rawPos[sorted[i]];
  }
  // 정규화 (5~95% 범위로 — 양쪽 여백 확보)
  const posMax = positions[sorted[sorted.length - 1]];
  const posMin = positions[sorted[0]];
  const posRange = posMax - posMin || 1;
  sorted.forEach(s => {
    positions[s] = 5 + ((positions[s] - posMin) / posRange) * 90;
  });

  // 구간 커넥터 정보 (인접 역 간 연결선 + n역 라벨)
  const connectors = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    const raw = Math.abs(getChartIdx(b) - getChartIdx(a));
    const count = Math.round(raw); // 소수점 제거 (고덕기지 0.5 오프셋 등)
    if (count >= 1) {
      connectors.push({
        leftPct: positions[a], rightPct: positions[b],
        count, isMini: count <= 2, isLong: count >= 15
      });
    }
  }

  // === 블록 구성 (배너보다 먼저) ===
  const hasBlocks = changeTimes.length > 0 && segs.length > 1;
  let blocks;
  if (hasBlocks) {
    blocks = [];
    const numBlocks = Math.min(changeTimes.length + 1, segs.length);
    for (let i = 0; i < numBlocks; i++) {
      const tStart = i === 0 ? startTime : changeTimes[i - 1];
      const tEnd = i < changeTimes.length ? changeTimes[i] : endTime;
      const bSegs = i < numBlocks - 1 ? [segs[i]] : segs.slice(i);
      blocks.push({
        label: `${i + 1}근무`,
        time: tStart && tEnd ? `${tStart} → ${tEnd}` : (tStart ? `${tStart}~` : ''),
        segs: bSegs
      });
    }
  } else {
    blocks = [{ label: null, time: null, segs: segs }];
  }

  // 블록별 방향 + 활성 블록 (시간 기반 자동 전환)
  const blockDirs = blocks.map(b => getBlockDir(b.segs));
  const isPreview = typeof weekPreviewDate !== 'undefined' && !!weekPreviewDate;
  const activeIdx = hasBlocks && !isPreview
    ? Math.min(getActiveBlock(changeTimes, startTime), blocks.length - 1)
    : 0;

  // === HTML 빌드 ===
  let html = '';

  // Y자 미니맵 (답십리 중앙 + 브랜치 시각화)
  html += renderYMap(segs);

  // 출발 방향 배너 — 4-state (근무중 / 종료 / 대기 / 준비)
  const bannerDir = blockDirs[activeIdx] || blockDirs[0];
  const bState = bannerState || { state: 'working' };

  if (bState.state === 'done' && bState.next) {
    // === STATE 2: 근무 종료 (퇴근 후 2시간 이내) ===
    const ns = bState.next;
    const nextTime = ns.schedule ? ns.schedule.s : '';
    const nextDir = ns.schedule ? getRouteDirection(ns.schedule.m) : null;
    const nextDirText = nextDir
      ? (nextDir.dir === 'up' ? '▲상선' : nextDir.dir === 'down' ? '▼하선' : '🚇기지')
      : '';
    const timeUntil = bState.minsUntil ? formatTimeUntil(bState.minsUntil) : '';
    const daysText = ns.daysAhead === 1 ? '내일' : (ns.daysAhead > 1 ? ns.daysAhead + '일 후' : '');

    html += `<div class="rv-depart rv-done">`;
    html += `<div class="rv-depart-dir">근무 종료</div>`;
    html += `<div class="rv-depart-sub">수고하셨습니다</div>`;
    if (nextTime) {
      html += `<div class="rv-depart-next">`;
      html += `다음 출발 ${daysText ? daysText + ' ' : ''}${nextTime} ${nextDirText}`;
      if (timeUntil) html += ` <span class="rv-depart-until">(${timeUntil})</span>`;
      html += `</div>`;
    }
    html += `</div>`;

  } else if (bState.state === 'idle') {
    // === STATE 3: 오늘 근무 완료 (퇴근 후 2시간 이후, 차분) ===
    const ns = bState.next;
    const nextTime = ns && ns.schedule ? ns.schedule.s : '';
    const nextDir = ns && ns.schedule ? getRouteDirection(ns.schedule.m) : null;
    const nextDirText = nextDir
      ? (nextDir.dir === 'up' ? '▲상선' : nextDir.dir === 'down' ? '▼하선' : '🚇기지')
      : '';
    const timeUntil = bState.minsUntil ? formatTimeUntil(bState.minsUntil) : '';
    const daysText = ns && ns.daysAhead === 1 ? '내일' : (ns && ns.daysAhead > 1 ? ns.daysAhead + '일 후' : '');

    html += `<div class="rv-depart rv-idle">`;
    html += `<div class="rv-depart-dir">오늘 근무 완료</div>`;
    if (nextTime) {
      html += `<div class="rv-depart-next">`;
      html += `다음 출발 ${daysText ? daysText + ' ' : ''}${nextTime} ${nextDirText}`;
      if (timeUntil) html += ` <span class="rv-depart-until">(${timeUntil})</span>`;
      html += `</div>`;
    }
    html += `</div>`;

  } else if (bState.state === 'preparing' && bState.next) {
    // === STATE 4: 다음 근무 준비 (2시간 이내) ===
    const ns = bState.next;
    const nextTime = ns.schedule ? ns.schedule.s : '';
    const nextDir = ns.schedule ? getRouteDirection(ns.schedule.m) : null;
    const nextDirCls = nextDir ? nextDir.dir : 'up';
    const nextDirLabel = nextDir ? nextDir.label : '';
    const nextDirSub = nextDir ? nextDir.sub : '';
    const timeUntil = bState.minsUntil ? formatTimeUntil(bState.minsUntil) : '';

    html += `<div class="rv-depart rv-prep ${nextDirCls}">`;
    html += `<div class="rv-depart-dir">다음 근무 · ${nextDirLabel}</div>`;
    html += `<div class="rv-depart-sub">${nextDirSub}</div>`;
    if (nextTime) {
      html += `<div class="rv-depart-time">출발 ${nextTime}`;
      if (timeUntil) html += ` <span class="rv-depart-until">(${timeUntil})</span>`;
      html += `</div>`;
    }
    html += `</div>`;

  } else if (bannerDir) {
    // === STATE 1: 근무 중 (기존 동작) ===
    const dirCls = bannerDir.dir;
    const blockPrefix = hasBlocks ? `${blocks[activeIdx].label} · ` : '';
    const departTime = activeIdx === 0 ? startTime : changeTimes[activeIdx - 1];
    html += `<div class="rv-depart ${dirCls}">`;
    html += `<div class="rv-depart-dir">${blockPrefix}${bannerDir.label}</div>`;
    html += `<div class="rv-depart-sub">${bannerDir.sub}</div>`;
    if (departTime) html += `<div class="rv-depart-time">출발 ${departTime}</div>`;
    html += `</div>`;
  }

  // 공통: 차트 컨테이너
  html += `<div class="rv-apk">`;

  // 역 헤더 — 위: 역 이름, 아래: 구간 커넥터 라인
  html += '<div class="rv-hdr">';
  sorted.forEach(s => {
    const home = s === '답십리' ? ' rv-home' : '';
    const pct = positions[s];
    html += `<div class="rv-col${home}" style="left:${pct.toFixed(1)}%">${shortStn(s)}</div>`;
  });
  // 구간 커넥터 (얇은 라인 + n역 라벨)
  connectors.forEach(c => {
    const w = c.rightPct - c.leftPct;
    const cls = c.isMini ? 'rv-conn rv-conn-mini' : 'rv-conn';
    let inner = '';
    // 긴 구간 눈금 (15역 이상)
    if (c.isLong) {
      const ticks = Math.min(5, Math.floor(c.count / 7));
      for (let t = 1; t <= ticks; t++) {
        inner += `<span class="rv-conn-tick" style="left:${(t / (ticks + 1) * 100).toFixed(0)}%"></span>`;
      }
    }
    inner += `<span class="rv-conn-label">${c.count}역</span>`;
    html += `<div class="${cls}" style="left:${c.leftPct.toFixed(1)}%;width:${w.toFixed(1)}%">${inner}</div>`;
  });
  html += '</div>';

  // 블록별 렌더링
  blocks.forEach((block, bi) => {
    if (block.label) {
      if (bi > 0) html += `<div class="rv-rest">교대 ${changeTimes[bi - 1] || ''}</div>`;
      const bDir = blockDirs[bi];
      const dirTag = bDir ? ` · ${bDir.short}` : '';
      const activeCls = bi === activeIdx ? ' rv-block-active' : '';
      html += `<div class="rv-block${activeCls}"><div class="rv-block-label">${block.label}${dirTag} · ${block.time}</div>`;
    }

    // 차트 바디
    html += '<div class="rv-body">';

    // 그리드 라인
    sorted.forEach(s => {
      const pct = positions[s];
      html += `<div class="rv-vl" style="left:${pct.toFixed(1)}%"></div>`;
    });

    // 세그먼트 렌더링
    block.segs.forEach((seg, si) => {
      if (si > 0) {
        html += `<div class="rv-sep"><span>${seg.note ? '교대 ' + seg.note : '교대'}</span></div>`;
      }

      const legs = splitByDirection(seg.stations);

      html += '<div class="rv-pair">';
      legs.forEach((leg, li) => {
        const stnPositions = leg.stations.map(s => positions[s]);
        const minP = Math.min(...stnPositions);
        const maxP = Math.max(...stnPositions);
        const isW = leg.direction === 'west';

        const barCls = isW ? 'rv-bar rv-bar-up' : 'rv-bar rv-bar-down';
        html += '<div class="rv-row">';
        html += `<div class="${barCls}" style="left:${(minP).toFixed(1)}%;width:${(maxP - minP).toFixed(1)}%">`;
        html += `<span class="rv-arr">${isW ? '◀' : '▶'}</span>`;
        html += '</div></div>';

        if (li < legs.length - 1) {
          const shared = leg.stations[leg.stations.length - 1];
          const turnPct = positions[shared];
          html += `<div class="rv-turn" style="--turn-pos:${turnPct.toFixed(1)}%"></div>`;
        }
      });
      html += '</div>';
    });

    html += '</div>'; // rv-body

    if (block.label) html += '</div>'; // rv-block
  });

  html += '</div>'; // rv-apk
  return html;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

// ===== TOAST =====
let toastTimer = null;
function showToast(msg, duration) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.whiteSpace = msg.includes('\n') ? 'pre-line' : '';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration || 2500);
}

// ===== PIN MODAL =====
function showPinModal() {
  let bg = document.getElementById('pinModalBg');
  if (!bg) {
    bg = document.createElement('div');
    bg.id = 'pinModalBg';
    bg.className = 'pin-modal-bg';
    bg.innerHTML = `<div class="pin-modal">
      <div class="pin-title">🔒 승인 필요</div>
      <div class="pin-desc">장애 알림 등록은 승인된 사용자만 가능합니다</div>
      <input type="password" id="pinInput" class="pin-input" placeholder="PIN 입력" maxlength="8" inputmode="numeric">
      <div class="pin-error" id="pinError"></div>
      <div class="pin-actions">
        <button type="button" class="pin-btn cancel" onclick="closePinModal()">취소</button>
        <button type="button" class="pin-btn confirm" onclick="verifyPin()">확인</button>
      </div>
    </div>`;
    document.body.appendChild(bg);
  }
  bg.classList.add('open');
  document.getElementById('pinError').textContent = '';
  const input = document.getElementById('pinInput');
  input.value = '';
  setTimeout(() => input.focus(), 200);
  input.onkeydown = (e) => { if (e.key === 'Enter') verifyPin(); };
}

function closePinModal() {
  const bg = document.getElementById('pinModalBg');
  if (bg) bg.classList.remove('open');
}

function verifyPin() {
  const pin = document.getElementById('pinInput').value;
  if (pin === ALERT_PIN) {
    alertAuthorized = true;
    closePinModal();
    showToast('인증 완료 — 장애 알림 등록이 가능합니다');
    openAlertForm();
  } else {
    document.getElementById('pinError').textContent = 'PIN이 일치하지 않습니다';
    document.getElementById('pinInput').value = '';
    document.getElementById('pinInput').focus();
  }
}

// ===== ALERT POPUP (실시간 알림 수신 시) =====
let alertPopupTimer = null;
function showAlertPopup(a) {
  let el = document.getElementById('alertPopup');
  if (!el) {
    el = document.createElement('div');
    el.id = 'alertPopup';
    el.className = 'alert-popup';
    document.body.appendChild(el);
  }
  const sevIcon = a.severity === 'high' ? '🚨' : a.severity === 'medium' ? '⚠️' : 'ℹ️';
  el.innerHTML = `<div class="ap-inner" onclick="goTab('pageMore');setTimeout(()=>showSub('alertPanel'),100);closeAlertPopup();">
    <div class="ap-icon">${sevIcon}</div>
    <div class="ap-body">
      <div class="ap-title">${a.station}역 장애 발생</div>
      <div class="ap-msg">${a.message}</div>
    </div>
    <button type="button" class="ap-close" onclick="event.stopPropagation();closeAlertPopup();">✕</button>
  </div>`;
  el.classList.add('show');
  clearTimeout(alertPopupTimer);
  alertPopupTimer = setTimeout(() => el.classList.remove('show'), 8000);
}

function closeAlertPopup() {
  const el = document.getElementById('alertPopup');
  if (el) el.classList.remove('show');
  clearTimeout(alertPopupTimer);
}

// ===== CLOCK =====
function tick() {
  const n = new Date();
  const de = document.getElementById('homeDate');
  const te = document.getElementById('homeTime');
  const se = document.getElementById('homeSec');
  if (de) de.textContent = `${n.getFullYear()}년 ${n.getMonth() + 1}월 ${n.getDate()}일 ${DOW[n.getDay()]}요일`;
  if (te) {
    const h = n.getHours(), ap = h < 12 ? '오전' : '오후', h12 = h % 12 || 12;
    const ape = document.getElementById('homeAmpm');
    if (ape) ape.textContent = ap;
    te.textContent = `${String(h12).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }
  if (se) se.textContent = `:${String(n.getSeconds()).padStart(2, '0')}`;
}

// ===== HOME =====
function rHome() {
  const ne = document.getElementById('homeName');
  if (cur) {
    ne.innerHTML = `<span class="home-name-link" onclick="openModal('home')">${cur.n} <span class="home-name-arrow">▾</span></span>`;
  } else {
    ne.innerHTML = `<button class="home-select-btn" type="button" onclick="openModal('home')">기관사를 선택하세요 ▾</button>`;
  }

  // Alert banner
  renderAlertBanner();

  const el = document.getElementById('homeTodayCard');
  if (!cur) {
    el.innerHTML = `<div class="today-card"><div class="home-empty">
      <div class="he-icon">🚇</div>
      <div class="he-msg">기관사를 선택하면<br>오늘의 교번을 확인합니다</div>
      <button class="he-btn" type="button" onclick="openModal('home')">기관사 선택</button>
    </div></div>`;
    document.getElementById('homeWeek').innerHTML = '';
    document.getElementById('homeStatus').innerHTML = '';
    return;
  }

  // 미리보기 모드 or 오늘
  const today = td();
  const targetDate = weekPreviewDate ? new Date(weekPreviewDate + 'T00:00:00') : today;
  const dia = gDia(cur, targetDate), tp = gType(dia);
  const sc = gSched(dia, targetDate), hl = isH(targetDate) ? '휴일' : '평일';

  // 미리보기 배너
  let previewBannerH = '';
  if (weekPreviewDate) {
    const pd = new Date(weekPreviewDate + 'T00:00:00');
    const pdDow = DOW[pd.getDay()];
    previewBannerH = `<div class="preview-banner">
      <span class="preview-banner-text">👁 미리보기: ${pdDow}요일 (${pd.getDate()}일)</span>
      <button class="preview-banner-btn" type="button" onclick="resetToToday()">오늘로 돌아가기</button>
    </div>`;
  }

  // 배너 상태 계산 (오늘 + 실시간만, 미리보기는 항상 working)
  let bannerState = null;
  if (sc && !weekPreviewDate) {
    const nextShift = getNextShift(cur, today);
    bannerState = getBannerState(sc, nextShift, new Date());
  }

  let infoH = '';
  if (sc) {
    infoH = `<div class="tc-time-hero">
      <div class="tc-time-block">
        <div class="tc-time-label">출근</div>
        <div class="tc-time-val tc-time-start">${sc.s || '-'}</div>
      </div>
      <div class="tc-time-arrow">→</div>
      <div class="tc-time-block">
        <div class="tc-time-label">퇴근</div>
        <div class="tc-time-val">${sc.e || '-'}</div>
      </div>
      <div class="tc-time-block small">
        <div class="tc-time-label">근무시간</div>
        <div class="tc-time-val sm">${getWorkTime(sc)}</div>
      </div>
    </div>`;
    if (sc.m) {
      infoH += `<div class="tc-route">
        <div class="tc-route-label">🚇 운전행로</div>
        ${renderRouteVisual(sc.m, sc.s, sc.e, bannerState)}
      </div>`;
    }
  } else {
    const restMsg = weekPreviewDate ? '이 날은 비번입니다 😊' : '오늘은 비번입니다 😊';
    infoH = `<div class="tc-rest-msg">${restMsg}</div>`;
  }

  const cardLabel = weekPreviewDate
    ? `${DOW[targetDate.getDay()]}요일 교번 (미리보기)`
    : '오늘의 교번 · DIA';

  const shareBtn = weekPreviewDate ? '' : '<button class="tc-share-btn" type="button" onclick="shareSchedule()" title="오늘 교번 공유">📤</button>';
  el.innerHTML = `${previewBannerH}<div class="today-card">
    <div class="tc-header">
      <div class="tc-label">${cardLabel}</div>
      <div class="tc-header-right">${shareBtn}<span class="tc-badge ${tp}">${gLabel(dia)}</span></div>
    </div>
    <div class="tc-body">
      <div class="tc-dia ${tp}">${dia}</div>
      <div class="tc-type-name tc-type-bold">${gTypeName(tp)}</div>
    </div>${infoH}</div>`;

  // Week strip
  const we = document.getElementById('homeWeek');
  let wh = '<div class="section-label">이번주 근무</div><div class="week-strip">';
  const todayD = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - todayD);

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const di = gDia(cur, d), tt = gType(di), isT = d.getTime() === today.getTime();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const isPreview = weekPreviewDate === dateStr;
    const ss = gSched(di, d);
    let timeStr = '';
    if (ss && ss.s && !ss.s.startsWith('대') && ss.s !== '대휴') {
      timeStr = ss.s.replace('기', '');
    }
    let cls = 'week-day';
    if (isPreview) cls += ' is-preview';
    else if (isT && !weekPreviewDate) cls += ' is-today';
    wh += `<div class="${cls}" onclick="showWeekPreview('${dateStr}')" data-date="${dateStr}">
      <div class="wd-dow">${DOW[i]}</div>
      <div class="wd-date">${d.getDate()}</div>
      <div class="wd-dia ${tt}">${di === '~' ? '-' : di}</div>
      ${tt === 'rest' ? '<div class="wd-time rest-label">비번</div>' : (timeStr ? `<div class="wd-time">${timeStr}</div>` : '')}
    </div>`;
  }
  wh += '</div>';
  we.innerHTML = wh;

  // Status cards — 내일 근무 + 교번 구성
  const stEl = document.getElementById('homeStatus');
  const tmrw = new Date(today);
  tmrw.setDate(tmrw.getDate() + 1);
  const tmDia = gDia(cur, tmrw);
  const tmTp = gType(tmDia);
  const tmSc = gSched(tmDia, tmrw);
  const tmDow = DOW[tmrw.getDay()];
  const tmHl = isH(tmrw);

  let tmCard = '';
  if (tmTp === 'rest') {
    tmCard = `<div class="status-card">
      <div class="sc-label">내일 (${tmrw.getDate()}일 ${tmDow}요일)</div>
      <div class="sc-val sc-val-rest">비번 😊</div>
      <div class="sc-sub">${tmDia}</div>
    </div>`;
  } else {
    const tmTime = tmSc ? tmSc.s : '-';
    const tmTypeName = gTypeName(tmTp);
    const tmDir = tmSc ? getRouteDirection(tmSc.m) : null;
    const tmDirH = tmDir ? `<span class="sc-dir ${tmDir.dir}">${tmDir.dir === 'up' ? '▲상선' : tmDir.dir === 'down' ? '▼하선' : '🚇기지'}</span>` : '';
    tmCard = `<div class="status-card">
      <div class="sc-label">내일 (${tmrw.getDate()}일 ${tmDow}요일)</div>
      <div class="sc-val sc-val-start">${tmTime}</div>
      <div class="sc-sub">${tmDia} · ${tmTypeName} ${tmDirH}</div>
    </div>`;
  }

  // 모레 (day after tomorrow)
  const aftrw = new Date(today);
  aftrw.setDate(aftrw.getDate() + 2);
  const afDia = gDia(cur, aftrw);
  const afTp = gType(afDia);
  const afSc = gSched(afDia, aftrw);
  const afDow = DOW[aftrw.getDay()];

  let afCard = '';
  if (afTp === 'rest') {
    afCard = `<div class="status-card">
      <div class="sc-label">모레 (${aftrw.getDate()}일 ${afDow}요일)</div>
      <div class="sc-val sc-val-rest">비번 😊</div>
      <div class="sc-sub">${afDia}</div>
    </div>`;
  } else {
    const afTime = afSc ? afSc.s : '-';
    const afTypeName = gTypeName(afTp);
    const afDir = afSc ? getRouteDirection(afSc.m) : null;
    const afDirH = afDir ? `<span class="sc-dir ${afDir.dir}">${afDir.dir === 'up' ? '▲상선' : afDir.dir === 'down' ? '▼하선' : '🚇기지'}</span>` : '';
    afCard = `<div class="status-card">
      <div class="sc-label">모레 (${aftrw.getDate()}일 ${afDow}요일)</div>
      <div class="sc-val sc-val-start">${afTime}</div>
      <div class="sc-sub">${afDia} · ${afTypeName} ${afDirH}</div>
    </div>`;
  }

  // D-Day 카운터 + 월간 요약
  let ddayH = '';
  if (!weekPreviewDate) {
    const daysLeft = getDaysUntilRest(cur, today);
    if (daysLeft !== null && daysLeft > 0) {
      ddayH = `<div class="dday-pill">비번까지 <strong>${daysLeft}일</strong></div>`;
    } else if (daysLeft === 0) {
      ddayH = `<div class="dday-pill dday-today">오늘 비번 🎉</div>`;
    }
  }

  const ms = getMonthSummary(cur, today.getFullYear(), today.getMonth());
  const monthH = `<div class="month-summary">
    <div class="ms-title">${today.getMonth()+1}월 근무 요약</div>
    <div class="ms-grid">
      <div class="ms-cell"><div class="ms-num day">${ms.day}</div><div class="ms-label">주간</div></div>
      <div class="ms-cell"><div class="ms-num night">${ms.night}</div><div class="ms-label">야간</div></div>
      <div class="ms-cell"><div class="ms-num standby">${ms.standby}</div><div class="ms-label">대기</div></div>
      <div class="ms-cell"><div class="ms-num rest">${ms.rest}</div><div class="ms-label">비번</div></div>
    </div>
  </div>`;

  stEl.innerHTML = `<div class="status-bar">
    ${tmCard}
    ${afCard}
  </div>${ddayH}${monthH}`;
}

// D-Day: 다음 비번까지 남은 일수
function getDaysUntilRest(person, fromDate) {
  const todayType = gType(gDia(person, fromDate));
  if (todayType === 'rest') return 0;
  for (let i = 1; i <= 15; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    if (gType(gDia(person, d)) === 'rest') return i;
  }
  return null;
}

// 월간 요약: 해당 월의 근무 유형별 일수
function getMonthSummary(person, year, month) {
  const ld = new Date(year, month + 1, 0).getDate();
  let day = 0, night = 0, rest = 0, standby = 0;
  for (let d = 1; d <= ld; d++) {
    const dt = new Date(year, month, d);
    const tp = gType(gDia(person, dt));
    if (tp === 'day') day++;
    else if (tp === 'night') night++;
    else if (tp === 'standby') standby++;
    else rest++;
  }
  return { day, night, standby, rest };
}

// ===== WEEK PREVIEW =====
function showWeekPreview(dateStr) {
  const today = td();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  if (dateStr === todayStr) {
    // 오늘을 클릭하면 미리보기 해제
    resetToToday();
    return;
  }
  weekPreviewDate = dateStr;
  rHome();
  renderHomeExtras();
}

function resetToToday() {
  if (!weekPreviewDate) return;
  weekPreviewDate = null;
  rHome();
  renderHomeExtras();
}

// 페이지 복귀 시 미리보기 자동 해제
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && weekPreviewDate) resetToToday();
});

// ===== SUPABASE INIT =====
function initSupabase() {
  if (typeof supabase !== 'undefined') {
    sb = supabase.createClient(SB_URL, SB_KEY);
    subscribeAlerts();
  }
}

function subscribeAlerts() {
  if (!sb) return;
  sb.channel('alerts-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, payload => {
      const a = payload.new;
      const mapped = {
        id: a.id, station: a.station, message: a.message,
        severity: a.severity, ts: new Date(a.created_at).getTime(),
        createdBy: a.created_by, active: a.is_active, photo: a.photo || null, photos: a.photos || null
      };
      // 중복 방지 (내가 방금 등록한 것)
      if (!alerts.find(x => x.id === a.id)) {
        alerts.unshift(mapped);
        localStorage.setItem('diaAlerts', JSON.stringify(alerts));
        renderAlertList();
        renderAlertBanner();
        renderAlertBadge();
  updateAlertIndicators();
        // 다른 사람이 등록한 알림이면 브라우저 알림 + 인앱 팝업
        if (a.created_by !== (cur ? cur.n : '')) {
          sendNotification(`${a.station}역 장애 발생`, a.message);
          showAlertPopup(mapped);
        }
        renderHomeExtras();
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alerts' }, payload => {
      const a = payload.new;
      const idx = alerts.findIndex(x => x.id === a.id);
      if (idx >= 0) {
        alerts[idx].active = a.is_active;
        localStorage.setItem('diaAlerts', JSON.stringify(alerts));
        renderAlertList();
        renderAlertBanner();
        renderAlertBadge();
  updateAlertIndicators();
      }
    })
    .subscribe();
}

// ===== ALERT SYSTEM =====
async function loadAlerts() {
  if (!sb) {
    // 오프라인 폴백: localStorage
    try {
      const saved = localStorage.getItem('diaAlerts');
      alerts = saved ? JSON.parse(saved) : [];
    } catch (e) { alerts = []; }
    return;
  }

  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('alerts')
      .select('*')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    if (error) throw error;

    alerts = (data || []).map(a => ({
      id: a.id, station: a.station, message: a.message,
      severity: a.severity, ts: new Date(a.created_at).getTime(),
      createdBy: a.created_by, active: a.is_active, photo: a.photo || null, photos: a.photos || null
    }));
    // 오프라인용 캐시
    localStorage.setItem('diaAlerts', JSON.stringify(alerts));
  } catch (e) {
    // Supabase 실패 시 localStorage 폴백
    try {
      const saved = localStorage.getItem('diaAlerts');
      alerts = saved ? JSON.parse(saved) : [];
    } catch (e2) { alerts = []; }
  }
}

function getActiveAlerts() {
  return alerts.filter(a => a.active);
}

function renderAlertBanner() {
  const el = document.getElementById('homeAlertBanner');
  const active = getActiveAlerts();
  if (active.length === 0) {
    el.innerHTML = '';
    return;
  }
  const latest = active[0]; // Most recent
  const sevClass = `alert-banner-${latest.severity}`;
  const sevIcon = latest.severity === 'high' ? '🚨' : latest.severity === 'medium' ? '⚠️' : 'ℹ️';
  const countText = active.length > 1 ? `+${active.length - 1}건` : '';

  el.innerHTML = `<div class="alert-home-banner ${sevClass}" onclick="goTab('pageMore');setTimeout(()=>showSub('alertPanel'),100)">
    <div class="alert-banner-inner">
      <div class="alert-banner-icon">${sevIcon}</div>
      <div class="alert-banner-text">
        <div class="alert-banner-station">${latest.station}역 장애</div>
        <div class="alert-banner-msg">${latest.message}</div>
      </div>
      ${countText ? `<div class="alert-banner-count">${countText}</div>` : ''}
    </div>
  </div>`;
}

function renderAlertBadge() {
  const el = document.getElementById('alertBadge');
  const count = getActiveAlerts().length;
  if (count > 0) {
    el.textContent = count;
    el.classList.add('show');
  } else {
    el.classList.remove('show');
  }
}

function renderAlertList() {
  const el = document.getElementById('alertList');
  const active = getActiveAlerts();
  if (active.length === 0) {
    el.innerHTML = `<div class="alert-empty">
      <div class="alert-empty-icon">🛡️</div>
      <div class="alert-empty-msg">현재 장애 알림이 없습니다</div>
      <div class="alert-empty-sub">안전한 하루입니다!</div>
    </div>`;
    return;
  }

  let h = '';
  active.forEach(a => {
    const allPhotos = a.photos || (a.photo ? [a.photo] : []);
    let photoHtml = '';
    if (allPhotos.length > 0) {
      photoHtml = '<div class="alert-item-photos">';
      allPhotos.forEach((src, i) => {
        photoHtml += `<div class="alert-item-photo" onclick="viewAlertPhoto('${a.id}',${i})"><img src="${src}" alt="사진 ${i+1}"></div>`;
      });
      photoHtml += '</div>';
    }
    h += `<div class="alert-item">
      <div class="alert-item-header">
        <div class="alert-item-sev ${a.severity}"></div>
        <div class="alert-item-station">${a.station}역</div>
        <div class="alert-item-time">${timeAgo(a.ts)}</div>
      </div>
      <div class="alert-item-msg">${a.message}</div>
      ${photoHtml}
      <div class="alert-item-actions">
        <div class="alert-act-btn share" onclick="shareAlert('${a.id}')">📋 공유</div>
        <div class="alert-act-btn dismiss" onclick="dismissAlert('${a.id}')">해제</div>
      </div>
    </div>`;
  });
  el.innerHTML = h;
}

let alertPhotos = []; // Base64 배열 (최대 3장)
const MAX_PHOTOS = 3;
const ALL_STATIONS = [...LINE5_MAIN, ...LINE5_MACHEON, ...LINE5_HANAM];

function openAlertForm() {
  // PIN 인증 확인
  if (!alertAuthorized) {
    showPinModal();
    return;
  }
  document.getElementById('alertStationInput').value = '';
  document.getElementById('alertStation').value = '';
  document.getElementById('alertSuggest').innerHTML = '';
  document.getElementById('alertMessage').value = '';
  alertPhotos = [];
  renderPhotoGrid();
  alertSeverity = 'high';
  document.querySelectorAll('.af-sev-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.af-sev-btn.high').classList.add('active');
  const msgEl = document.getElementById('alertMessage');
  const countEl = document.getElementById('alertMsgCount');
  msgEl.oninput = () => {
    countEl.textContent = `${msgEl.value.length}/200`;
  };
  countEl.textContent = '0/200';

  document.getElementById('alertModalBg').classList.add('open');

  const input = document.getElementById('alertStationInput');
  let stationSearchTimer = null;
  input.oninput = () => {
    clearTimeout(stationSearchTimer);
    stationSearchTimer = setTimeout(() => {
      const q = input.value.trim();
      const suggest = document.getElementById('alertSuggest');
      if (!q) { suggest.innerHTML = ''; return; }
      const matches = ALL_STATIONS.filter(s => s.includes(q));
      if (matches.length === 0) {
        suggest.innerHTML = '<div class="af-suggest-empty">검색 결과 없음</div>';
      } else {
        suggest.innerHTML = matches.map(s =>
          `<div class="af-suggest-item" onclick="pickStation('${s}')">${s.replace(q, '<strong>' + q + '</strong>')}역</div>`
        ).join('');
      }
    }, 200);
  };
  input.onfocus = () => {
    if (!input.value.trim()) {
      const suggest = document.getElementById('alertSuggest');
      suggest.innerHTML = ALL_STATIONS.map(s =>
        `<div class="af-suggest-item" onclick="pickStation('${s}')">${s}역</div>`
      ).join('');
    }
  };
}

function pickStation(name) {
  document.getElementById('alertStationInput').value = name + '역';
  document.getElementById('alertStation').value = name;
  document.getElementById('alertSuggest').innerHTML = '';
  setTimeout(() => document.getElementById('alertMessage').focus(), 100);
}

function triggerPhotoInput() {
  if (alertPhotos.length >= MAX_PHOTOS) {
    showToast('사진은 최대 3장까지 가능합니다');
    return;
  }
  document.getElementById('alertPhotoInput').click();
}

function handleAlertPhotos(input) {
  const files = Array.from(input.files);
  if (!files.length) return;

  const remaining = MAX_PHOTOS - alertPhotos.length;
  const toProcess = files.slice(0, remaining);

  if (files.length > remaining) {
    showToast(`최대 3장 — ${files.length - remaining}장은 제외됨`);
  }

  let processed = 0;
  toProcess.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        alertPhotos.push(canvas.toDataURL('image/jpeg', 0.7));
        processed++;
        if (processed === toProcess.length) renderPhotoGrid();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function removeAlertPhoto(idx) {
  alertPhotos.splice(idx, 1);
  renderPhotoGrid();
}

function renderPhotoGrid() {
  const grid = document.getElementById('alertPhotoGrid');
  const placeholder = document.getElementById('alertPhotoPlaceholder');
  const area = document.getElementById('alertPhotoArea');

  if (alertPhotos.length === 0) {
    placeholder.style.display = '';
    grid.innerHTML = '';
    area.classList.remove('has-photos');
    return;
  }

  placeholder.style.display = 'none';
  area.classList.add('has-photos');

  let h = '';
  alertPhotos.forEach((src, i) => {
    h += `<div class="af-grid-item">
      <img src="${src}" alt="사진 ${i + 1}">
      <button class="af-grid-remove" type="button" onclick="event.stopPropagation();removeAlertPhoto(${i})">✕</button>
      <span class="af-grid-num">${i + 1}</span>
    </div>`;
  });

  if (alertPhotos.length < MAX_PHOTOS) {
    h += `<div class="af-grid-add" onclick="event.stopPropagation();triggerPhotoInput()">
      <span>+</span>
      <span class="af-grid-add-text">추가</span>
    </div>`;
  }

  grid.innerHTML = h;
}

function viewAlertPhoto(id, idx) {
  const a = alerts.find(x => x.id === id);
  if (!a) return;
  const photos = a.photos || (a.photo ? [a.photo] : []);
  if (!photos[idx]) return;
  let currentIdx = idx;

  const overlay = document.createElement('div');
  overlay.className = 'photo-overlay';

  function render() {
    const hasMulti = photos.length > 1;
    overlay.innerHTML = `
      <img src="${photos[currentIdx]}" alt="장애 사진">
      ${hasMulti ? `<div class="photo-overlay-counter">${currentIdx + 1} / ${photos.length}</div>` : ''}
      ${hasMulti && currentIdx > 0 ? '<div class="photo-overlay-nav left" onclick="event.stopPropagation()">‹</div>' : ''}
      ${hasMulti && currentIdx < photos.length - 1 ? '<div class="photo-overlay-nav right" onclick="event.stopPropagation()">›</div>' : ''}
    `;
    const navLeft = overlay.querySelector('.photo-overlay-nav.left');
    const navRight = overlay.querySelector('.photo-overlay-nav.right');
    if (navLeft) navLeft.onclick = e => { e.stopPropagation(); currentIdx--; render(); };
    if (navRight) navRight.onclick = e => { e.stopPropagation(); currentIdx++; render(); };
  }

  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
  render();
}

function closeAlertModal(e) {
  if (e.target === e.currentTarget)
    document.getElementById('alertModalBg').classList.remove('open');
}

function pickSeverity(sev, el) {
  alertSeverity = sev;
  document.querySelectorAll('.af-sev-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

async function postAlert() {
  const station = document.getElementById('alertStation').value;
  const message = document.getElementById('alertMessage').value.trim();
  if (!station) { showToast('역을 선택해 주세요'); return; }
  if (!message) { showToast('내용을 입력해 주세요'); return; }

  const creator = cur ? cur.n : '관리자';
  const photos = alertPhotos.length > 0 ? [...alertPhotos] : null;
  // 하위 호환: photo = 첫 번째 사진
  const photo = photos ? photos[0] : null;

  if (sb) {
    try {
      const insertData = { station, message, severity: alertSeverity, created_by: creator };
      if (photo) insertData.photo = photo;
      if (photos) insertData.photos = photos;
      const { data, error } = await sb.from('alerts').insert(insertData).select().single();

      if (error) throw error;

      alerts.unshift({
        id: data.id, station, message, severity: alertSeverity,
        ts: new Date(data.created_at).getTime(), createdBy: creator, active: true,
        photo, photos
      });
      localStorage.setItem('diaAlerts', JSON.stringify(alerts));
    } catch (e) {
      showToast('알림 등록 실패 — 네트워크를 확인해 주세요');
      return;
    }
  } else {
    alerts.unshift({
      id: 'local-' + Date.now(), station, message, severity: alertSeverity,
      ts: Date.now(), createdBy: creator, active: true, photo, photos
    });
    localStorage.setItem('diaAlerts', JSON.stringify(alerts));
  }

  alertPhotos = [];
  document.getElementById('alertModalBg').classList.remove('open');
  renderAlertList();
  renderAlertBanner();
  renderAlertBadge();
  updateAlertIndicators();
  showToast(`${station}역 장애 알림이 등록되었습니다`);
  sendNotification(`${station}역 장애 발생`, message);
}

async function dismissAlert(id) {
  if (sb && typeof id === 'string' && !id.startsWith('local-')) {
    try {
      const { error } = await sb.from('alerts').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    } catch (e) {
      showToast('알림 해제 실패 — 다시 시도해 주세요');
      return;
    }
  }

  const idx = alerts.findIndex(a => a.id === id);
  if (idx >= 0) {
    alerts[idx].active = false;
    localStorage.setItem('diaAlerts', JSON.stringify(alerts));
  }
  renderAlertList();
  renderAlertBanner();
  renderAlertBadge();
  updateAlertIndicators();
  showToast('알림이 해제되었습니다');
}

function shareAlert(id) {
  const a = alerts.find(x => x.id === id);
  if (!a) return;
  const sevLabel = { high: '긴급', medium: '주의', low: '참고' }[a.severity];
  const text = `[${sevLabel}] ${a.station}역 장애\n${a.message}\n- ${a.createdBy} (${new Date(a.ts).toLocaleString('ko-KR')})`;

  if (navigator.share) {
    navigator.share({ title: `${a.station}역 장애 알림`, text: text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('클립보드에 복사되었습니다'));
  } else {
    showToast('공유 기능을 사용할 수 없습니다');
  }
}

// ===== NOTIFICATIONS (필수) =====
function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  // 허용될 때까지 매번 표시
  if (Notification.permission === 'default') {
    document.getElementById('notiPrompt').classList.add('show');
  }
}

function allowNotifications() {
  document.getElementById('notiPrompt').classList.remove('show');
  if ('Notification' in window) {
    Notification.requestPermission().then(p => {
      if (p === 'granted') {
        showToast('알림이 활성화되었습니다');
      } else if (p === 'denied') {
        showToast('브라우저 설정에서 알림을 허용해 주세요');
      }
      updateNotiSetting();
    });
  }
}

function updateNotiSetting() {
  const statusEl = document.getElementById('notiStatus');
  const itemEl = document.getElementById('notiSettingItem');
  if (!statusEl || !itemEl) return;

  if (!('Notification' in window)) {
    statusEl.textContent = '미지원';
    statusEl.className = 'set-v';
    itemEl.onclick = null;
    return;
  }

  const perm = Notification.permission;
  if (perm === 'granted') {
    statusEl.textContent = '사용 중';
    statusEl.className = 'set-v noti-on';
    itemEl.onclick = null;
    itemEl.style.cursor = 'default';
  } else if (perm === 'denied') {
    statusEl.textContent = 'OFF · 설정에서 허용 ›';
    statusEl.className = 'set-v noti-off';
    itemEl.onclick = showNotiHelp;
    itemEl.style.cursor = 'pointer';
  } else {
    statusEl.textContent = '허용하기 ›';
    statusEl.className = 'set-v noti-ask';
    itemEl.onclick = requestNotiFromSetting;
    itemEl.style.cursor = 'pointer';
  }
}

function requestNotiFromSetting() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') showToast('알림이 활성화되었습니다');
      else if (p === 'denied') showToast('알림이 차단되었습니다');
      updateNotiSetting();
    });
  }
}

function showNotiHelp() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  let msg = '';
  if (isIOS) {
    msg = '① Safari 설정 → 이 웹사이트 → 알림 허용\n② 또는: iPhone 설정 → Safari → 알림';
  } else if (isAndroid) {
    msg = '① 주소창 왼쪽 🔒 아이콘 탭\n② "알림" → 허용으로 변경';
  } else {
    msg = '① 주소창 왼쪽 🔒 아이콘 클릭\n② "알림" → 허용으로 변경';
  }
  showToast(msg, 5000);
}

function sendNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body: body, icon: 'logo.png', badge: 'logo.png' });
  }
}

// ===== PWA INSTALL =====
let deferredInstallPrompt = null;

function isPWAInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function showPWAPrompt() {
  if (isPWAInstalled()) return; // 이미 설치됨

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const stepsEl = document.getElementById('pwaSteps');
  const installBtn = document.getElementById('pwaInstallBtn');
  const descEl = document.getElementById('pwaDesc');

  if (isIOS) {
    descEl.textContent = '홈 화면에 추가하면 앱처럼 사용할 수 있습니다';
    stepsEl.innerHTML = '<div class="pwa-steps">① 하단 <strong>공유 버튼</strong> (□↑) 탭<br>② <strong>"홈 화면에 추가"</strong> 선택<br>③ <strong>"추가"</strong> 탭</div>';
    installBtn.textContent = '확인했어요';
    installBtn.onclick = dismissPWA;
  } else if (deferredInstallPrompt) {
    // 안드로이드 — 자동 설치 가능
    descEl.textContent = '홈 화면에 추가하면 앱처럼 사용할 수 있습니다';
    stepsEl.innerHTML = '';
    installBtn.textContent = '설치하기';
    installBtn.onclick = installPWA;
  } else {
    // beforeinstallprompt 미도착 — 수동 안내
    descEl.textContent = '홈 화면에 추가하면 앱처럼 사용할 수 있습니다';
    stepsEl.innerHTML = '<div class="pwa-steps">① 브라우저 <strong>메뉴(⋮)</strong> 탭<br>② <strong>"홈 화면에 추가"</strong> 선택</div>';
    installBtn.textContent = '확인했어요';
    installBtn.onclick = dismissPWA;
  }

  document.getElementById('pwaPrompt').classList.add('show');
}

function installPWA() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') {
        showToast('앱이 설치되었습니다!');
      }
      deferredInstallPrompt = null;
    });
  }
  dismissPWA();
}

function dismissPWA() {
  document.getElementById('pwaPrompt').classList.remove('show');
  localStorage.setItem('pwaPromptShown', '1');
  // PWA 닫힌 후 알림 프롬프트 표시
  setTimeout(requestNotificationPermission, 500);
}

// ===== FAB & TAB BADGE =====
function updateAlertIndicators() {
  const count = getActiveAlerts().length;

  // FAB: 알림 있을 때만 표시 + 탭하면 알림 목록으로
  const fab = document.getElementById('fabAlert');
  const fabCount = document.getElementById('fabCount');
  if (count > 0) {
    fab.classList.remove('fab-hidden');
    fabCount.textContent = count;
    fabCount.classList.add('show');
  } else {
    fab.classList.add('fab-hidden');
    fabCount.classList.remove('show');
  }

  // 홈 탭 빨간 점
  const tabDot = document.getElementById('tabHomeDot');
  if (tabDot) {
    if (count > 0) tabDot.classList.add('show');
    else tabDot.classList.remove('show');
  }
}

// ===== TABS =====
const TAB_ORDER = ['pageHome', 'pageCal', 'pageLine', 'pageCmp', 'pageContacts', 'pageMore'];
let prevTabIdx = 0;

function goTab(id, el) {
  if (id === 'pageHome' && weekPreviewDate) resetToToday();
  const nextIdx = TAB_ORDER.indexOf(id);
  const dir = nextIdx >= prevTabIdx ? 'right' : 'left';
  prevTabIdx = nextIdx >= 0 ? nextIdx : prevTabIdx;

  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); p.removeAttribute('data-slide'); });
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const page = document.getElementById(id);
  page.classList.add('active');
  page.setAttribute('data-slide', dir);
  if (el) el.classList.add('active');
  else {
    const tabs = document.querySelectorAll('.tab');
    const i = TAB_ORDER.indexOf(id);
    if (i >= 0 && tabs[i]) tabs[i].classList.add('active');
  }
  if (id === 'pageHome') rHome();
  if (id === 'pageLine') initLine5();
  if (id === 'pageContacts') rContacts();
  if (id === 'pageMore') rMore();
}

// ===== CALENDAR =====
function initCal() {
  const n = new Date();
  calY = n.getFullYear();
  calM = n.getMonth();
  selDate = td();
  rCal();
}

function chgMonth(d) {
  calM += d;
  if (calM > 11) { calM = 0; calY++; }
  if (calM < 0) { calM = 11; calY--; }
  rCal();
}

function rCal() {
  document.getElementById('calMonth').textContent = `${calY}년 ${calM + 1}월`;
  if (cur) document.getElementById('calPersonName').textContent = cur.n;

  // 기관사 미선택 시 빈 상태 가이드
  const detailEl = document.getElementById('schedDetail');
  if (!cur) {
    detailEl.innerHTML = `<div class="cal-empty-guide">
      <div class="cal-empty-icon">📅</div>
      <div class="cal-empty-text">기관사를 선택하면<br>교번이 달력에 표시됩니다</div>
      <button class="he-btn" type="button" onclick="openModal('home')">기관사 선택</button>
    </div>`;
  }

  const g = document.getElementById('calGrid');
  const fd = new Date(calY, calM, 1).getDay();
  const ld = new Date(calY, calM + 1, 0).getDate();
  const pld = new Date(calY, calM, 0).getDate();
  const todayS = td().getTime();

  let h = DOW.map(d => `<div class="cal-hd">${d}</div>`).join('');

  for (let i = fd - 1; i >= 0; i--)
    h += `<div class="cal-c other"><div class="cd">${pld - i}</div></div>`;

  for (let d = 1; d <= ld; d++) {
    const dt = new Date(calY, calM, d), dw = dt.getDay();
    const isT = dt.getTime() === todayS;
    const isSel = selDate && selDate.getTime() === dt.getTime() && !isT;
    const hl = isH(dt);
    let di = '', dc = '';
    if (cur) {
      di = gDia(cur, dt);
      if (di !== '~') dc = gType(di);
    }
    let cls = 'cal-c';
    if (isT) cls += ' today';
    else if (isSel) cls += ' sel';
    if (dw === 0) cls += ' sun';
    if (dw === 6) cls += ' sat';
    if (hl && dw !== 0) cls += ' hol';

    const memoKey = `${calY}-${String(calM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasMemo = getMemo(memoKey);
    h += `<div class="${cls}" onclick="pickDate(${d})">
      <div class="cd">${d}</div>
      ${di && di !== '~' ? `<div class="cdia ${dc}">${di}</div>` : ''}
      ${hl && dw !== 0 ? '<div class="cal-hol-dot"></div>' : ''}
      ${hasMemo ? '<div class="cal-memo-dot"></div>' : ''}
    </div>`;
  }

  const rem = (7 - (fd + ld) % 7) % 7;
  for (let i = 1; i <= rem; i++)
    h += `<div class="cal-c other"><div class="cd">${i}</div></div>`;

  g.innerHTML = h;
  rSchedDetail();
}

function pickDate(d) {
  selDate = new Date(calY, calM, d);
  rCal();
}

function rSchedDetail() {
  const el = document.getElementById('schedDetail');
  if (!cur || !selDate) { el.innerHTML = ''; return; }
  const dia = gDia(cur, selDate), tp = gType(dia);
  const sc = gSched(dia, selDate), dw = DOW[selDate.getDay()];
  const hl = isH(selDate) ? '휴일' : '평일';
  let sh = '';
  if (sc) {
    sh = `<div class="sd-body">
      <div class="sd-dia ${tp}">${dia}</div>
      <div class="sd-row"><span class="sd-rl">출근</span><span class="sd-rv">${sc.s || '-'}</span></div>
      <div class="sd-row"><span class="sd-rl">퇴근</span><span class="sd-rv">${sc.e || '-'}</span></div>
      <div class="sd-row"><span class="sd-rl">근무시간</span><span class="sd-rv">${getWorkTime(sc)}</span></div>
      ${sc.m ? `<div class="sd-route">${sc.m}</div>` : ''}
    </div>`;
  } else {
    sh = `<div class="sd-body">
      <div class="sd-dia ${tp}">${dia}</div>
      <div class="sd-rest-text">
        ${dia === '~' ? '비순환 (근무 없음)' : '비번'}
      </div>
    </div>`;
  }
  const dateStr = `${selDate.getFullYear()}-${String(selDate.getMonth()+1).padStart(2,'0')}-${String(selDate.getDate()).padStart(2,'0')}`;
  const memo = getMemo(dateStr);
  const memoH = `<div class="sd-memo">
    <textarea class="sd-memo-input" placeholder="메모 (이 날짜에 대한 간단한 기록)" maxlength="200" oninput="setMemo('${dateStr}', this.value)">${memo}</textarea>
  </div>`;
  el.innerHTML = `<div class="sched-detail">
    <div class="sd-top">
      <div class="sd-date">${selDate.getMonth() + 1}월 ${selDate.getDate()}일 (${dw}) · ${hl}</div>
      <span class="sd-badge tc-badge ${tp}">${gLabel(dia)}</span>
    </div>${sh}${memoH}</div>`;
}

// ===== COMPARE =====
function initCmp() {
  const n = new Date();
  cmpY = n.getFullYear();
  cmpM = n.getMonth();
  document.getElementById('cmpMonth').textContent = `${cmpY}년 ${cmpM + 1}월`;
}

function chgCmpMonth(d) {
  cmpM += d;
  if (cmpM > 11) { cmpM = 0; cmpY++; }
  if (cmpM < 0) { cmpM = 11; cmpY--; }
  document.getElementById('cmpMonth').textContent = `${cmpY}년 ${cmpM + 1}월`;
  rCmp();
}

function rCmp() {
  document.getElementById('cmpMonth').textContent = `${cmpY}년 ${cmpM + 1}월`;
  const el = document.getElementById('cmpResult');
  if (!c1 || !c2) {
    el.innerHTML = `<div class="cmp-onboard">
      <div class="cmp-onboard-icon">👥</div>
      <div class="cmp-onboard-text">위에서 기관사 2명을 선택하면<br>교번을 나란히 비교할 수 있습니다</div>
      <div class="cmp-onboard-hint">같은 날 일정이 같으면 초록 표시</div>
    </div>`;
    return;
  }
  const ld = new Date(cmpY, cmpM + 1, 0).getDate();
  let h = '';
  for (let d = 1; d <= ld; d++) {
    const dt = new Date(cmpY, cmpM, d), dw = DOW[dt.getDay()], hl = isH(dt);
    const d1 = gDia(c1, dt), d2 = gDia(c2, dt);
    const s1 = gSched(d1, dt), s2 = gSched(d2, dt);
    const t1 = gType(d1), t2 = gType(d2);
    const hlIcon = hl ? '🔴' : '';
    const sameType = t1 === t2;
    const bothRest = t1 === 'rest' && t2 === 'rest';
    const syncCls = sameType ? (bothRest ? 'cmp-sync cmp-sync-rest' : 'cmp-sync') : '';

    h += `<div class="cmp-row-card ${syncCls}"><div class="cmp-pair">
      <div class="cmp-card cmp-card-${t1}">
        <div class="cmp-cd-date">${d}일 (${dw}) ${hlIcon}</div>
        <div class="cmp-cd-name cmp-name-1">${c1.n}</div>
        <div class="cmp-cd-dia ${t1}">${d1}</div>
        ${s1 ? `<div class="cmp-info-row"><span class="cir-l">출근</span><span class="cir-v">${s1.s || '-'}</span></div>
        <div class="cmp-info-row"><span class="cir-l">퇴근</span><span class="cir-v">${s1.e || '-'}</span></div>
        <div class="cmp-cd-route">${s1.m || ''}</div>` : `<div class="cmp-rest-text">비번</div>`}
      </div>
      <div class="cmp-card cmp-card-${t2}">
        <div class="cmp-cd-date">${d}일 (${dw}) ${hlIcon}</div>
        <div class="cmp-cd-name cmp-name-2">${c2.n}</div>
        <div class="cmp-cd-dia ${t2}">${d2}</div>
        ${s2 ? `<div class="cmp-info-row"><span class="cir-l">출근</span><span class="cir-v">${s2.s || '-'}</span></div>
        <div class="cmp-info-row"><span class="cir-l">퇴근</span><span class="cir-v">${s2.e || '-'}</span></div>
        <div class="cmp-cd-route">${s2.m || ''}</div>` : `<div class="cmp-rest-text">비번</div>`}
      </div>
    </div></div>`;
  }
  el.innerHTML = h;
}

// ===== LINE 5 REAL-TIME =====
let line5Initialized = false;

function initLine5() {
  if (!line5Initialized) {
    renderLine5();
    line5Initialized = true;
    // 이미 프리페치로 데이터가 있으면 즉시 렌더링
    if (trainData.length > 0) {
      renderLine5();
      if (lineViewMode === 'map') renderLine5Map();
    } else {
      fetchTrains();
    }
    startTrainPolling();
    startUpdateCounter();
    initMapPinchZoom();
  } else if (trainData.length > 0) {
    // 탭 재진입 시 기존 데이터로 즉시 렌더
    renderLine5();
    if (lineViewMode === 'map') renderLine5Map();
  }
}

function startTrainPolling() {
  stopTrainPolling();
  trainTimer = setInterval(() => {
    // 탭이 보이는 동안만 폴링 (API 호출 절약)
    if (!document.hidden) fetchTrains();
  }, TRAIN_POLL_MS);
}

function stopTrainPolling() {
  if (trainTimer) { clearInterval(trainTimer); trainTimer = null; }
}

function switchBranch(branch, el) {
  lineBranch = branch;
  document.querySelectorAll('.line-branch-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderLine5();
}

function getStationsForBranch() {
  if (lineBranch === 'macheon') return ['강동', ...LINE5_MACHEON];
  if (lineBranch === 'hanam') return ['강동', ...LINE5_HANAM];
  return LINE5_MAIN;
}

function renderLine5() {
  const stations = getStationsForBranch();
  const el = document.getElementById('lineTrackList');

  // Direction header
  const firstSt = stations[0];
  const lastSt = stations[stations.length - 1];
  let h = `<div class="tk-dir-header">
    <div class="tk-dir up">▲ ${firstSt} 방면</div>
    <div class="tk-dir down">${lastSt} 방면 ▼</div>
  </div>`;

  stations.forEach((name, i) => {
    const isFirst = i === 0;
    const isLast = i === stations.length - 1;
    const isDapsimni = name === '답십리';
    const transfers = LINE5_TRANSFERS[name];
    const hasRealTransfer = transfers && !transfers.some(t => t.includes('지선'));

    // Find trains at this station
    const trainsHere = trainData.filter(t =>
      t.statnNm === name || t.statnNm === name + '역'
    );
    const upTrains = trainsHere.filter(t => t.updnLine === '0' || t.updnLine === '상행');
    const downTrains = trainsHere.filter(t => t.updnLine === '1' || t.updnLine === '하행');

    // Track classes
    let trackCls = 'tk-track';
    if (isFirst) trackCls += ' first';
    if (isLast) trackCls += ' last';

    // Dot class
    let dotCls = 'tk-dot';
    if (isDapsimni) dotCls += ' dapsimni';
    else if (hasRealTransfer) dotCls += ' transfer';

    // Left: up trains (방화 방면)
    let leftH = '';
    upTrains.forEach(t => {
      const status = t.trainSttus === '0' ? ' arriving' : '';
      leftH += `<div class="tk-train-box up${status}">
        <span class="tk-capsule up"></span>
        <span class="tk-train-no">${t.trainNo}</span>
      </div>`;
    });

    // Transfer tags
    let transferH = '';
    if (hasRealTransfer) {
      transferH = '<div class="tk-transfers">';
      transfers.forEach(t => {
        const c = LINE_COLORS[t] || '#888';
        transferH += `<span class="tk-transfer-tag" style="background:${c};color:#fff">${t}</span>`;
      });
      transferH += '</div>';
    }

    // Right: down trains
    let downH = '';
    downTrains.forEach(t => {
      const status = t.trainSttus === '0' ? ' arriving' : '';
      downH += `<div class="tk-train-box down${status}">
        <span class="tk-train-no">${t.trainNo}</span>
        <span class="tk-capsule down"></span>
      </div>`;
    });

    h += `<div class="tk-row${isDapsimni ? ' highlight' : ''}">
      <div class="tk-left">${leftH}</div>
      <div class="${trackCls}">
        <div class="${dotCls}"></div>
      </div>
      <div class="tk-right">
        <div class="tk-name${isDapsimni ? ' dapsimni' : ''}">${name}${isDapsimni ? ' ★' : ''}</div>
        ${transferH}
        ${downH}
      </div>
    </div>`;
  });

  el.innerHTML = h;

  // Auto-scroll to 답십리
  requestAnimationFrame(() => {
    const dapRow = el.querySelector('.tk-row.highlight');
    if (dapRow) {
      dapRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

// ===== MAP VIEW =====
function toggleLineView() {
  lineViewMode = lineViewMode === 'list' ? 'map' : 'list';
  const isMap = lineViewMode === 'map';
  document.getElementById('lineTrackWrap').style.display = isMap ? 'none' : 'block';
  document.getElementById('lineMapWrap').style.display = isMap ? 'block' : 'none';
  document.getElementById('lineBranchBar').style.display = isMap ? 'none' : 'flex';

  const btn = document.getElementById('lineViewToggle');
  btn.innerHTML = isMap
    ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'
    : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>';
  btn.title = isMap ? '목록 보기' : '노선도 보기';

  if (isMap) renderLine5Map();
}

// 열차 상태 코드 → 한글
const TRAIN_STATUS = { '0': '도착', '1': '출발', '2': '진입', '3': '전역출발' };

let mapZoomLevel = 1;
let mapIsFullscreen = false;

function renderLine5Map() {
  const coords = LINE5_MAP;
  const routes = LINE5_ROUTES;
  const nameMap = { '동대문역사문화공원': '동대문역사' };

  let svg = '<defs>';
  svg += '<filter id="mapGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  svg += '<filter id="trainGl"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  svg += '<filter id="trainBoxShadow"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#000" flood-opacity="0.5"/></filter>';
  svg += '</defs>';

  // Background grid (subtle)
  for (let gx = 0; gx < 960; gx += 40) {
    svg += `<line x1="${gx}" y1="0" x2="${gx}" y2="580" stroke="rgba(255,255,255,0.015)" stroke-width="0.5"/>`;
  }
  for (let gy = 0; gy < 580; gy += 40) {
    svg += `<line x1="0" y1="${gy}" x2="960" y2="${gy}" stroke="rgba(255,255,255,0.015)" stroke-width="0.5"/>`;
  }

  // Route lines — 두꺼운 글로우 + 메인 라인 + 점선 테두리
  ['main', 'macheon', 'hanam'].forEach(branch => {
    const stns = routes[branch];
    let d = stns.map((name, i) => {
      const [x, y] = coords[name];
      return (i === 0 ? 'M' : 'L') + x + ',' + y;
    }).join(' ');
    svg += `<path d="${d}" fill="none" stroke="rgba(139,92,246,0.12)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" class="map-route-glow"/>`;
    svg += `<path d="${d}" fill="none" stroke="#8B5CF6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    svg += `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  });

  // Direction labels
  svg += '<text x="50" y="22" fill="rgba(255,255,255,0.25)" font-size="11" font-weight="700" font-family="system-ui,sans-serif">← 방화</text>';
  svg += '<text x="910" y="350" fill="rgba(255,255,255,0.25)" font-size="11" font-weight="700" text-anchor="end" font-family="system-ui,sans-serif">강동 →</text>';
  svg += '<text x="400" y="465" fill="rgba(255,255,255,0.25)" font-size="11" font-weight="700" text-anchor="middle" font-family="system-ui,sans-serif">← 마천</text>';
  svg += '<text x="260" y="540" fill="rgba(255,255,255,0.25)" font-size="11" font-weight="700" text-anchor="middle" font-family="system-ui,sans-serif">← 하남검단산</text>';

  // Station dots and labels
  Object.entries(coords).forEach(([name, [x, y]]) => {
    const isDapsimni = name === '답십리';
    const transfers = LINE5_TRANSFERS[name];
    const isTransfer = transfers && !transfers.some(t => t.includes('지선'));

    // Transfer outer ring
    if (isTransfer) {
      svg += `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
    }

    // Station dot
    if (isDapsimni) {
      svg += `<circle cx="${x}" cy="${y}" r="9" fill="rgba(251,191,36,0.15)" class="map-pulse"/>`;
      svg += `<circle cx="${x}" cy="${y}" r="7" fill="#FBBF24" filter="url(#mapGlow)"/>`;
      svg += `<text x="${x}" y="${y + 4}" text-anchor="middle" fill="#000" font-size="8" font-weight="900" font-family="system-ui">★</text>`;
    } else {
      const r = isTransfer ? 5 : 3.5;
      svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="${isTransfer ? '#fff' : 'rgba(255,255,255,0.7)'}"/>`;
    }

    // Station name
    const displayName = nameMap[name] || name;
    const labelCls = isDapsimni ? 'map-label-dap' : 'map-label';
    svg += `<text x="${x}" y="${y + 18}" text-anchor="middle" class="${labelCls}">${displayName}</text>`;

    // Transfer line color chips
    if (isTransfer) {
      let tx = x - ((transfers.length - 1) * 22);
      transfers.forEach((t, i) => {
        const c = LINE_COLORS[t] || '#888';
        const cx = tx + i * 44;
        svg += `<rect x="${cx - 18}" y="${y + 20}" width="36" height="12" rx="3" fill="${c}" opacity="0.85"/>`;
        svg += `<text x="${cx}" y="${y + 29}" text-anchor="middle" fill="#fff" font-size="7" font-weight="600" font-family="system-ui,sans-serif">${t}</text>`;
      });
    }
  });

  // Train markers — 박스형 (원본 참고)
  const trainsByStation = {};
  trainData.forEach(t => {
    const stn = t.statnNm.replace(/역$/, '').replace(/\(.*\)/, '');
    if (!trainsByStation[stn]) trainsByStation[stn] = [];
    trainsByStation[stn].push(t);
  });

  Object.entries(trainsByStation).forEach(([stn, trains]) => {
    const pos = coords[stn];
    if (!pos) return;
    const [sx, sy] = pos;
    let upIdx = 0, downIdx = 0;

    trains.forEach(t => {
      const isUp = t.updnLine === '0' || t.updnLine === '상행';
      const idx = isUp ? upIdx++ : downIdx++;
      const offsetY = isUp ? -(32 + idx * 48) : (30 + idx * 48);
      const dest = (t.statnTnm || '').replace(/역$/, '');
      const no = t.trainNo || '';
      const status = TRAIN_STATUS[t.trainSttus] || '';
      const arriving = t.trainSttus === '0' || t.trainSttus === '2';
      const dirColor = isUp ? '#22C55E' : '#F97316';
      const boxW = 72, boxH = 40;
      const bx = -boxW / 2;

      svg += `<g transform="translate(${sx},${sy + offsetY})" filter="url(#trainBoxShadow)" class="${arriving ? 'map-train-arrive' : ''}">`;
      // Box background
      svg += `<rect x="${bx}" y="${-boxH/2}" width="${boxW}" height="${boxH}" rx="5" fill="rgba(30,30,40,0.92)" stroke="${dirColor}" stroke-width="1.5"/>`;
      // Direction indicator dot
      svg += `<circle cx="${bx + 8}" cy="${-boxH/2 + 8}" r="3.5" fill="${dirColor}"/>`;
      // Direction name (행선지)
      svg += `<text x="${bx + 15}" y="${-boxH/2 + 11}" fill="${dirColor}" font-size="8" font-weight="700" font-family="system-ui,sans-serif">${dest}</text>`;
      // Train number
      svg += `<text x="0" y="3" text-anchor="middle" fill="#fff" font-size="12" font-weight="800" font-family="system-ui,sans-serif">${no}</text>`;
      // Status text
      svg += `<text x="0" y="${boxH/2 - 5}" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="7.5" font-weight="500" font-family="system-ui,sans-serif">${stn} ${status}</text>`;
      // Train icon (small)
      svg += `<text x="${bx + boxW - 10}" y="${-boxH/2 + 12}" fill="rgba(255,255,255,0.3)" font-size="8">🚇</text>`;
      svg += '</g>';
    });
  });

  document.getElementById('lineMapContent').innerHTML =
    `<svg viewBox="-30 -10 1020 620" class="line-map-svg" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;

  applyMapZoom();

  // Auto-scroll to 답십리
  setTimeout(() => {
    const scroll = document.getElementById('lineMapScroll');
    if (!scroll) return;
    const svgEl = scroll.querySelector('.line-map-svg');
    if (!svgEl) return;
    const svgW = svgEl.getBoundingClientRect().width;
    const svgH = svgEl.getBoundingClientRect().height;
    const ratioX = (470 + 30) / 1020;
    const ratioY = (360 + 10) / 620;
    scroll.scrollLeft = Math.max(0, svgW * ratioX - scroll.clientWidth / 2);
    scroll.scrollTop = Math.max(0, svgH * ratioY - scroll.clientHeight / 2);
  }, 100);
}

// ===== MAP ZOOM =====
function applyMapZoom() {
  const svgEl = document.querySelector('.line-map-svg');
  if (!svgEl) return;
  const w = Math.round(1100 * mapZoomLevel);
  const h = Math.round(669 * mapZoomLevel);
  svgEl.style.width = w + 'px';
  svgEl.style.height = h + 'px';
  const label = document.getElementById('mapZoomLevel');
  if (label) label.textContent = Math.round(mapZoomLevel * 100) + '%';
}

function mapZoom(dir) {
  const steps = [0.6, 0.8, 1, 1.3, 1.6, 2, 2.5];
  const cur = steps.findIndex(s => Math.abs(s - mapZoomLevel) < 0.05);
  const next = Math.max(0, Math.min(steps.length - 1, (cur >= 0 ? cur : 2) + dir));
  mapZoomLevel = steps[next];
  applyMapZoom();
}

// ===== MAP FULLSCREEN =====
function toggleMapFullscreen() {
  const wrap = document.getElementById('lineMapWrap');
  const btn = document.getElementById('mapFullscreenBtn');
  mapIsFullscreen = !mapIsFullscreen;

  if (mapIsFullscreen) {
    wrap.classList.add('map-fullscreen');
    btn.textContent = '✕';
    btn.title = '전체화면 닫기';
    document.body.style.overflow = 'hidden';
  } else {
    wrap.classList.remove('map-fullscreen');
    btn.textContent = '⛶';
    btn.title = '전체화면';
    document.body.style.overflow = '';
  }
}

// 핀치 줌 (터치)
function initMapPinchZoom() {
  const scroll = document.getElementById('lineMapScroll');
  if (!scroll) return;
  let startDist = 0, startZoom = 1;

  scroll.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      startDist = Math.hypot(dx, dy);
      startZoom = mapZoomLevel;
    }
  }, { passive: false });

  scroll.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / startDist;
      mapZoomLevel = Math.max(0.5, Math.min(3, startZoom * scale));
      applyMapZoom();
    }
  }, { passive: false });

  // 더블탭 줌
  let lastTap = 0;
  scroll.addEventListener('touchend', e => {
    if (e.touches.length > 0) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      mapZoomLevel = mapZoomLevel > 1.2 ? 1 : 1.6;
      applyMapZoom();
    }
    lastTap = now;
  });
}

function startUpdateCounter() {
  clearInterval(updateCounterTimer);
  updateCounterTimer = setInterval(() => {
    if (!lastTrainFetch) return;
    const el = document.getElementById('lineUpdateTime');
    const diff = Math.floor((Date.now() - lastTrainFetch) / 1000);
    const dotClass = diff < 120 ? 'success' : 'stale';
    const dot = `<span class="line-dot ${dotClass}" id="lineDot"></span>`;
    if (diff < 5) el.innerHTML = dot + '실시간 · 방금 갱신';
    else if (diff < 60) el.innerHTML = dot + `실시간 · ${diff}초 전 갱신`;
    else el.innerHTML = dot + `실시간 · ${Math.floor(diff / 60)}분 전 갱신`;
  }, 1000);
}

const TRAIN_API_PATH = '/api/subway/' + API_KEY + '/json/realtimePosition/0/100/5호선';
const TRAIN_API_URLS = [
  'https://dia-proxy.jinho2209.workers.dev' + TRAIN_API_PATH,
  'http://swopenAPI.seoul.go.kr' + TRAIN_API_PATH
];

function fetchTrainAPI() {
  // Cloudflare Worker 프록시 우선, 실패 시 직접 호출 폴백
  return fetch(TRAIN_API_URLS[0], { signal: AbortSignal.timeout(8000) })
    .then(r => r.json())
    .catch(() => fetch(TRAIN_API_URLS[1], { signal: AbortSignal.timeout(8000) }).then(r => r.json()));
}

function setLineDot(state) {
  const dot = document.getElementById('lineDot');
  if (!dot) return;
  dot.className = 'line-dot ' + state; // loading, success, error, idle
}

function fetchTrains() {
  const btn = document.getElementById('lineRefreshBtn');
  const statusEl = document.getElementById('lineUpdateTime');
  btn.classList.add('spinning');
  setLineDot('loading');
  statusEl.innerHTML = '<span class="line-dot loading" id="lineDot"></span>불러오는 중...';

  fetchTrainAPI()
    .then(data => {
      btn.classList.remove('spinning');
      if (data.realtimePositionList) {
        trainData = data.realtimePositionList;
        lastTrainFetch = Date.now();
        setLineDot('success');
        renderLine5();
        if (lineViewMode === 'map') renderLine5Map();
      } else if (data.errorMessage) {
        trainData = [];
        renderLine5();
        const h = new Date().getHours();
        setLineDot('idle');
        statusEl.innerHTML = '<span class="line-dot idle" id="lineDot"></span>' +
          ((h >= 1 && h < 5) ? '심야 운행 종료 (05시 재개)' : '열차 데이터 없음');
      } else {
        setLineDot('error');
        statusEl.innerHTML = '<span class="line-dot error" id="lineDot"></span>데이터 오류 — 다시 시도해주세요';
      }
    })
    .catch(() => {
      btn.classList.remove('spinning');
      setLineDot('error');
      statusEl.innerHTML = '<span class="line-dot error" id="lineDot"></span>서버 연결 실패 — 다시 시도해주세요';
    });
}

function prefetchTrains() {
  fetchTrainAPI()
    .then(data => {
      if (data.realtimePositionList) {
        trainData = data.realtimePositionList;
        lastTrainFetch = Date.now();
      }
    })
    .catch(() => {});
}

// ===== CONTACTS TAB =====
function rContacts() {
  const el = document.getElementById('contactsContent');
  let h = '';

  // 관제 (긴급 스타일)
  h += '<div class="ct-section"><div class="ct-section-title">🚨 관제</div>';
  CPH_CTRL.forEach(c => {
    h += `<div class="ct-card ct-ctrl ct-emergency">
      <div class="ct-name">${c.n}</div>
      <div class="ct-nums">
        <a class="ct-num ct-num-emergency" href="tel:${c.a.replace(/-/g, '')}"><span class="ct-num-icon">📞</span>${c.a}<span class="ct-call-hint">터치하여 전화</span></a>
        <a class="ct-num ct-num-emergency" href="tel:${c.b.replace(/-/g, '')}"><span class="ct-num-icon">📞</span>${c.b}<span class="ct-call-hint">터치하여 전화</span></a>
      </div>
    </div>`;
  });
  h += '</div>';

  // 승무운용 · 신호취급실
  h += '<div class="ct-section"><div class="ct-section-title">🏢 승무운용 · 신호취급실</div>';
  CPH.forEach(c => {
    h += `<div class="ct-card">
      <div class="ct-name">${c.n}</div>
      <div class="ct-nums">
        <a class="ct-num" href="tel:${c.a.replace(/-/g, '')}"><span class="ct-num-icon">📞</span>${c.a}</a>
        <a class="ct-num" href="tel:${c.b.replace(/-/g, '')}"><span class="ct-num-icon">📞</span>${c.b}</a>
      </div>
    </div>`;
  });
  h += '</div>';

  el.innerHTML = h;
}

// ===== MORE =====
function rMore() {

  if (cur) {
    document.getElementById('setName').textContent = cur.n;
    document.getElementById('morePersonInfo').textContent = `${cur.n} · 오늘: ${gDia(cur, td())}`;
  }

  renderAlertBadge();
  updateAlertIndicators();
  updateNotiSetting();
}

function showSub(id) {
  document.getElementById('moreMain').classList.add('hidden');
  document.getElementById(id).classList.add('active');
  if (id === 'sopPanel') rSopList();
  if (id === 'alertPanel') renderAlertList();
}

function hideSub(id) {
  document.getElementById(id).classList.remove('active');
  document.getElementById('moreMain').classList.remove('hidden');
}

// ===== SOP =====
function getSopIcon(title) {
  if (/화재/.test(title)) return '🔴';
  if (/탈선/.test(title)) return '🔴';
  if (/충돌|추돌/.test(title)) return '🔴';
  if (/침수|매몰/.test(title)) return '🟡';
  if (/독가스|화생방/.test(title)) return '🟡';
  return '🟠';
}

function rSopList() {
  const el = document.getElementById('sopList');
  // 내용 기반 분류: ◆ 또는 번호(1〕/1)) 포함 → 이례상황, 나머지 → 방송문안
  const isEmergency = s => /[◆◈]|^\d[〕\)]|\n\d[〕\)]/m.test(s.c || '');
  const em = SOP.filter(isEmergency);
  const bc = SOP.filter(s => !isEmergency(s));
  let h = '<div class="section-label sop-section-label">이례상황 조치</div>';
  em.forEach(s => {
    const i = SOP.indexOf(s);
    const icon = getSopIcon(s.t);
    h += `<div class="sop-card" onclick="showSopD(${i})">
      <div class="sop-t">${icon} ${s.t}</div>
    </div>`;
  });
  h += '<div class="section-label sop-section-label">방송문안</div>';
  bc.forEach(s => {
    const i = SOP.indexOf(s);
    h += `<div class="sop-card" onclick="showSopD(${i})">
      <div class="sop-t">📢 ${s.t}</div>
    </div>`;
  });
  el.innerHTML = h;
}

function showSopD(i) {
  sopIdx = i;
  document.getElementById('sopPanel').classList.remove('active');
  document.getElementById('sopDetailPanel').classList.add('active');
  const s = SOP[i], el = document.getElementById('sopDetailContent');
  let h = `<div class="sop-detail-panel"><div class="sop-dp"><h3>${s.t}</h3>`;
  if (s.c) h += `<div class="sop-sec"><div class="sop-sec-b">${s.c.replace(/\n/g, '<br>')}</div></div>`;
  h += '</div></div>';
  el.innerHTML = h;
}

function backToSopList() {
  document.getElementById('sopDetailPanel').classList.remove('active');
  document.getElementById('sopPanel').classList.add('active');
  rSopList();
}

// ===== MODAL =====
function openModal(t) {
  mTarget = t;
  document.getElementById('mSearch').value = '';
  rList('');
  document.getElementById('modalBg').classList.add('open');
  setTimeout(() => document.getElementById('mSearch').focus(), 300);
}

function closeModal(e) {
  if (e.target === e.currentTarget)
    document.getElementById('modalBg').classList.remove('open');
}

function filterList() {
  rList(document.getElementById('mSearch').value);
}

function rList(q) {
  const el = document.getElementById('mList');
  const qq = q.trim().toLowerCase();
  const f = qq ? P.filter(p => p.n.toLowerCase().includes(qq)) : P.filter(p => p.d !== '~');
  f.sort((a, b) => a.n.localeCompare(b.n, 'ko'));
  let h = '';
  f.forEach(p => {
    const tdia = gDia(p, td());
    const picked = (mTarget === 'main' || mTarget === 'setting' || mTarget === 'home') && cur && cur.I === p.I;
    h += `<div class="modal-person ${picked ? 'picked' : ''}" onclick="pick('${p.I}')">
      <span class="mp-name">${p.n}</span>
      <span class="mp-dia">${tdia}</span>
    </div>`;
  });
  el.innerHTML = h || '<div class="empty-msg">검색 결과 없음</div>';
}

function pick(id) {
  const p = P.find(x => x.I === id);
  if (!p) return;
  if (mTarget === 'main' || mTarget === 'setting' || mTarget === 'home') {
    cur = p;
    localStorage.setItem('dp', id);
    document.getElementById('calPersonName').textContent = p.n;
    document.getElementById('setName').textContent = p.n;
    rHome();
    rCal();
  } else if (mTarget === 'c1') {
    c1 = p;
    document.getElementById('c1Icon').textContent = p.n.charAt(0);
    document.getElementById('c1Name').textContent = p.n;
    document.getElementById('c1Sub').textContent = '오늘: ' + gDia(p, td());
    document.getElementById('cmpSel1').classList.add('filled');
    rCmp();
  } else if (mTarget === 'c2') {
    c2 = p;
    document.getElementById('c2Icon').textContent = p.n.charAt(0);
    document.getElementById('c2Name').textContent = p.n;
    document.getElementById('c2Sub').textContent = '오늘: ' + gDia(p, td());
    document.getElementById('cmpSel2').classList.add('filled');
    rCmp();
  }
  document.getElementById('modalBg').classList.remove('open');
}

// ===== DARK MODE =====
function toggleDark() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark ? '1' : '0');
  document.getElementById('darkToggle').classList.toggle('on', isDark);
  document.querySelector('meta[name="theme-color"]').content = isDark ? '#1F2937' : '#1A56DB';
}

function initDark() {
  // <head>에서 이미 html.dark 클래스 적용됨 — 토글 UI만 동기화
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
    document.getElementById('darkToggle').classList.add('on');
    document.querySelector('meta[name="theme-color"]').content = '#1F2937';
  }
}

// ===== SPLASH =====
function dismissSplash() {
  const splash = document.getElementById('splash');
  splash.classList.add('hide');
  document.body.classList.remove('splash-active');
  setTimeout(() => splash.remove(), 600);
}

// ===== PWA =====
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  // 이미 프롬프트가 열려 있으면 → 자동 설치 버튼으로 교체
  const prompt = document.getElementById('pwaPrompt');
  if (prompt && prompt.classList.contains('show')) {
    const stepsEl = document.getElementById('pwaSteps');
    const installBtn = document.getElementById('pwaInstallBtn');
    stepsEl.innerHTML = '';
    installBtn.textContent = '설치하기';
    installBtn.onclick = installPWA;
  }
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  dismissPWA();
  showToast('앱이 설치되었습니다!');
});

function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'activated') {
            document.getElementById('updateBanner').classList.add('show');
          }
        });
      });
    });
  }
}

// ===== KEYBOARD =====
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (mapIsFullscreen) { toggleMapFullscreen(); return; }
    const modal = document.getElementById('modalBg');
    const alertModal = document.getElementById('alertModalBg');
    if (alertModal.classList.contains('open')) {
      alertModal.classList.remove('open');
    } else if (modal.classList.contains('open')) {
      modal.classList.remove('open');
    }
  }
  // Enter/Done → 키보드 내리기 (textarea 제외)
  if (e.key === 'Enter' && document.activeElement) {
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT') {
      e.preventDefault();
      document.activeElement.blur();
    }
  }
});

// 인풋 바깥 탭 → 키보드 내리기
document.addEventListener('touchstart', e => {
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
    if (!ae.contains(e.target) && e.target !== ae) {
      // 자동완성 목록 클릭은 무시 (af-suggest)
      if (e.target.closest && e.target.closest('.af-suggest')) return;
      ae.blur();
    }
  }
});

// 인풋 포커스 시 화면 스크롤 보정 (모바일 키보드 대응)
document.addEventListener('focusin', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }
});

// VisualViewport 리사이즈 대응 (모바일 키보드 열릴 때 모달 높이 조정)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const vvh = window.visualViewport.height;
    document.documentElement.style.setProperty('--vvh', vvh + 'px');
  });
  // 초기값
  document.documentElement.style.setProperty('--vvh', window.visualViewport.height + 'px');
}

// ===== DAILY TIP + QUIZ + WEATHER =====
function getDayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 864e5);
}

function getDailyTip() {
  if (typeof DAILY_TIPS === 'undefined' || !DAILY_TIPS.length) return null;
  return DAILY_TIPS[getDayOfYear() % DAILY_TIPS.length];
}

// 퀴즈 상태 (연속 풀기)
let quizState = null;

function initQuizState() {
  if (typeof QUIZ === 'undefined' || !QUIZ.length) return;
  const day = getDayOfYear();
  try {
    const saved = localStorage.getItem('quizState');
    if (saved) {
      const s = JSON.parse(saved);
      if (s.day === day) { quizState = s; return; }
    }
  } catch(e) {}
  // 새 날 — 셔플 순서 생성 (시드 기반)
  const indices = Array.from({length: QUIZ.length}, (_, i) => i);
  let seed = day * 2654435761;
  for (let i = indices.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  quizState = { day, order: indices, idx: 0, correct: 0, total: 0, answered: false };
  saveQuizState();
}

function saveQuizState() {
  if (quizState) localStorage.setItem('quizState', JSON.stringify(quizState));
}

function renderHomeExtras() {
  const el = document.getElementById('homeExtras');
  if (!el) return;
  let h = '';

  // 중요 알림 카드 (장애 알림 목록 — 오늘의 한마디 위)
  const active = getActiveAlerts();
  if (active.length > 0) {
    h += '<div class="home-alert-section">';
    h += '<div class="section-label">🚨 장애 알림</div>';
    active.slice(0, 3).forEach(a => {
      const sevIcon = a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟠' : '🟡';
      h += `<div class="home-alert-card ${a.severity}" onclick="goTab('pageMore');setTimeout(()=>showSub('alertPanel'),100)">
        <div class="ha-icon">${sevIcon}</div>
        <div class="ha-body">
          <div class="ha-station">${a.station}역</div>
          <div class="ha-msg">${a.message}</div>
        </div>
        <div class="ha-time">${timeAgo(a.ts)}</div>
      </div>`;
    });
    if (active.length > 3) {
      h += `<div class="ha-more" onclick="goTab('pageMore');setTimeout(()=>showSub('alertPanel'),100)">+${active.length - 3}건 더보기 ›</div>`;
    }
    h += '</div>';
  }

  // 오늘의 한마디
  const tip = getDailyTip();
  if (tip) {
    h += `<div class="daily-tip-card">
      <div class="dt-icon">${tip.icon}</div>
      <div class="dt-content">
        <div class="dt-label">오늘의 한마디</div>
        <div class="dt-msg">${tip.text}</div>
      </div>
    </div>`;
  }

  // 퀴즈 컨테이너
  h += '<div id="quizContainer"></div>';

  // 날씨 링크
  h += `<a class="weather-link-card" href="https://weather.naver.com/" target="_blank" rel="noopener">
    <span class="weather-link-icon">🌤</span>
    <span class="weather-link-text">오늘의 날씨 확인</span>
    <span class="weather-link-arrow">›</span>
  </a>`;

  el.innerHTML = h;
  initQuizState();
  renderQuiz();
}

function renderQuiz() {
  const container = document.getElementById('quizContainer');
  if (!container || !quizState) return;

  const total = QUIZ.length;
  const { order, idx, correct, total: answered } = quizState;

  // 모든 문제 완료
  if (idx >= total) {
    const pct = Math.round((correct / answered) * 100);
    container.innerHTML = `<div class="quiz-card">
      <div class="quiz-header">
        <div class="quiz-title">🧠 기관사 퀴즈</div>
        <div class="quiz-streak">${correct}/${answered} (${pct}%)</div>
      </div>
      <div class="quiz-done">
        <div class="quiz-done-icon">🏆</div>
        모든 문제를 풀었습니다!<br>
        <span class="quiz-done-sub">내일 다시 셔플됩니다</span>
      </div>
      <button class="quiz-opt quiz-reset-btn" type="button" onclick="resetQuiz()">🔄 처음부터 다시 풀기</button>
      <div class="quiz-disclaimer">이 퀴즈는 참고용입니다</div>
    </div>`;
    return;
  }

  const quiz = QUIZ[order[idx]];
  const num = idx + 1;

  container.innerHTML = `<div class="quiz-card" id="quizCardLive">
    <div class="quiz-header">
      <div class="quiz-title">🧠 기관사 퀴즈</div>
      <div class="quiz-streak">${num}/${total}</div>
    </div>
    ${answered > 0 ? `<div class="quiz-score">✅ ${correct}개 정답 / ${answered}문제</div>` : ''}
    <div class="quiz-question">${quiz.q}</div>
    <div class="quiz-options" id="quizOptions">
      ${quiz.a.map((opt, i) => `<button class="quiz-opt" type="button" onclick="answerQuiz(${i})">${opt}</button>`).join('')}
    </div>
    <div class="quiz-disclaimer">이 퀴즈는 참고용입니다</div>
  </div>`;
}

function answerQuiz(idx) {
  if (!quizState || quizState.answered) return;
  const quiz = QUIZ[quizState.order[quizState.idx]];
  const correct = quiz.correct;
  const isCorrect = idx === correct;

  quizState.answered = true;
  quizState.total++;
  if (isCorrect) quizState.correct++;
  saveQuizState();

  // 버튼 상태
  const buttons = document.querySelectorAll('#quizOptions .quiz-opt');
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) btn.classList.add(i === idx ? 'correct' : 'reveal-correct');
    if (i === idx && !isCorrect) btn.classList.add('wrong');
  });

  // 결과 + 다음 문제 버튼
  const card = document.getElementById('quizCardLive');
  if (card) {
    let resultH = `<div class="quiz-result ${isCorrect ? 'pass' : 'fail'}">`;
    resultH += isCorrect ? '🎉 정답!' : `정답: "${quiz.a[correct]}"`;
    resultH += '</div>';
    resultH += `<button class="quiz-next-btn" type="button" onclick="nextQuiz()">다음 문제 →</button>`;
    card.querySelector('.quiz-options').insertAdjacentHTML('afterend', resultH);
  }
}

function nextQuiz() {
  if (!quizState) return;
  quizState.idx++;
  quizState.answered = false;
  saveQuizState();
  renderQuiz();
  // 스크롤을 퀴즈 카드로
  const c = document.getElementById('quizContainer');
  if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetQuiz() {
  if (!quizState) return;
  quizState.idx = 0;
  quizState.correct = 0;
  quizState.total = 0;
  quizState.answered = false;
  saveQuizState();
  renderQuiz();
}

// ===== SHAKE TO SHARE =====
let lastShake = 0;
function initShake() {
  if (!('DeviceMotionEvent' in window)) return;
  let lastX = 0, lastY = 0, lastZ = 0, lastTime = 0;
  const handler = e => {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    const now = Date.now();
    if (now - lastTime < 100) return;
    const total = Math.abs(a.x - lastX) + Math.abs(a.y - lastY) + Math.abs(a.z - lastZ);
    if (total > 35 && now - lastShake > 3000) {
      lastShake = now;
      shareSchedule();
    }
    lastX = a.x; lastY = a.y; lastZ = a.z; lastTime = now;
  };
  // iOS 13+ 권한 요청은 사용자 제스처 필요 — 첫 터치 시 등록
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    document.addEventListener('touchstart', function reqPerm() {
      DeviceMotionEvent.requestPermission().then(r => {
        if (r === 'granted') window.addEventListener('devicemotion', handler);
      }).catch(() => {});
      document.removeEventListener('touchstart', reqPerm);
    }, { once: true });
  } else {
    window.addEventListener('devicemotion', handler);
  }
}

function shareSchedule() {
  if (!cur) { showToast('기관사를 먼저 선택하세요'); return; }
  const today = td();
  const dia = gDia(cur, today), tp = gType(dia), sc = gSched(dia, today);
  const dow = DOW[today.getDay()];
  let text = `[기관사 DIA] ${cur.n}\n${today.getMonth()+1}/${today.getDate()} (${dow})\n교번: ${dia} (${gLabel(dia)})`;
  if (sc) text += `\n출근: ${sc.s || '-'} / 퇴근: ${sc.e || '-'}`;
  if (sc && sc.m) text += `\n행로: ${sc.m}`;
  if (navigator.share) {
    navigator.share({ title: '오늘의 교번', text }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('클립보드에 복사됨 📋'));
  } else {
    showToast('공유 기능을 지원하지 않는 브라우저입니다');
  }
}

// ===== DAY MEMO =====
function getMemo(dateStr) {
  try { return JSON.parse(localStorage.getItem('diaMemos') || '{}')[dateStr] || ''; }
  catch(e) { return ''; }
}
function setMemo(dateStr, text) {
  try {
    const m = JSON.parse(localStorage.getItem('diaMemos') || '{}');
    if (text.trim()) m[dateStr] = text.trim(); else delete m[dateStr];
    localStorage.setItem('diaMemos', JSON.stringify(m));
  } catch(e) {}
}
function cleanOldMemos() {
  try {
    const m = JSON.parse(localStorage.getItem('diaMemos') || '{}');
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 6);
    let changed = false;
    for (const k of Object.keys(m)) {
      if (new Date(k) < cutoff) { delete m[k]; changed = true; }
    }
    if (changed) localStorage.setItem('diaMemos', JSON.stringify(m));
  } catch(e) {}
}

// ===== COMMUTE (출퇴근) =====
const LINE_COLORS = {
  '1001':'#0052A4','1002':'#00A84D','1003':'#EF7C1C','1004':'#00A5DE',
  '1005':'#996CAC','1006':'#CD7C2F','1007':'#747F00','1008':'#E6186C',
  '1009':'#BDB092','1063':'#77C4A3','1065':'#0090D2','1067':'#178C72',
  '1075':'#F5A200','1077':'#D4003B','1092':'#B7C452'
};
const LINE_NAMES = {
  '1001':'1호선','1002':'2호선','1003':'3호선','1004':'4호선',
  '1005':'5호선','1006':'6호선','1007':'7호선','1008':'8호선',
  '1009':'9호선','1063':'경의중앙','1065':'공항철도','1067':'경춘선',
  '1075':'수인분당','1077':'신분당선','1092':'우이신설'
};
const COMMUTE_PROXY = 'https://dia-proxy.jinho2209.workers.dev';
let commuteAlarmTimer = null;
let commuteAlarmInfo = null;

function openCommute() {
  document.getElementById('commutePage').classList.add('open');
  document.getElementById('tabBar').classList.add('hidden');
  loadFavStations();
  // 즐겨찾기 첫 번째 역 자동 조회
  const favs = getFavStations();
  if (favs.length > 0) searchStation(favs[0]);
}

function closeCommute() {
  document.getElementById('commutePage').classList.remove('open');
  document.getElementById('tabBar').classList.remove('hidden');
}

function refreshCommute() {
  const input = document.getElementById('cmSearchInput');
  if (input.value.trim()) searchStation(input.value.trim());
  else {
    const favs = getFavStations();
    if (favs.length > 0) searchStation(favs[0]);
  }
}

function getFavStations() {
  try { return JSON.parse(localStorage.getItem('cmFavStations') || '[]'); }
  catch(e) { return []; }
}

function saveFavStations(list) {
  localStorage.setItem('cmFavStations', JSON.stringify(list));
}

function addFavStation(name) {
  const favs = getFavStations();
  if (!favs.includes(name)) {
    favs.unshift(name);
    if (favs.length > 10) favs.pop();
    saveFavStations(favs);
  }
  loadFavStations();
}

function removeFavStation(name) {
  const favs = getFavStations().filter(f => f !== name);
  saveFavStations(favs);
  loadFavStations();
}

function loadFavStations() {
  const wrap = document.getElementById('cmFavList');
  const favs = getFavStations();
  if (favs.length === 0) {
    wrap.innerHTML = '<div class="cm-fav-empty">★ 검색 후 역을 즐겨찾기에 추가하세요</div>';
    return;
  }
  wrap.innerHTML = favs.map(name =>
    `<div class="cm-fav-chip" onclick="searchStation('${name}')">
      <span class="cm-fav-star">★</span> ${name}
      <button class="cm-fav-del" type="button" onclick="event.stopPropagation();removeFavStation('${name}')">×</button>
    </div>`
  ).join('');
}

function searchStation(name) {
  if (!name) {
    name = document.getElementById('cmSearchInput').value.trim();
  }
  if (!name) { showToast('역 이름을 입력하세요'); return; }
  document.getElementById('cmSearchInput').value = name;

  const results = document.getElementById('cmResults');
  results.innerHTML = '<div class="cm-loading">불러오는 중...</div>';

  const url = COMMUTE_PROXY + '/api/subway/' + API_KEY + '/json/realtimeStationArrival/0/30/' + encodeURIComponent(name);
  fetch(url, { signal: AbortSignal.timeout(10000) })
    .then(r => r.json())
    .then(data => {
      if (data.realtimeArrivalList) {
        renderArrivals(data.realtimeArrivalList, name);
      } else {
        results.innerHTML = '<div class="cm-empty">도착 정보가 없습니다<br><small>역 이름을 확인해주세요 (예: 강남, 신도림)</small></div>';
      }
    })
    .catch(() => {
      results.innerHTML = '<div class="cm-empty">서버 연결 실패 — 다시 시도해주세요</div>';
    });
}

function renderArrivals(list, stationName) {
  const results = document.getElementById('cmResults');
  const favs = getFavStations();
  const isFav = favs.includes(stationName);

  // 노선별 그룹핑
  const groups = {};
  list.forEach(item => {
    const lineId = item.subwayId;
    if (!groups[lineId]) groups[lineId] = [];
    groups[lineId].push(item);
  });

  let html = `<div class="cm-station-header">
    <div class="cm-station-name">${stationName}</div>
    <button class="cm-fav-btn ${isFav ? 'active' : ''}" type="button"
      onclick="${isFav ? `removeFavStation('${stationName}')` : `addFavStation('${stationName}')`};searchStation('${stationName}')">
      ${isFav ? '★' : '☆'}
    </button>
  </div>`;

  for (const lineId of Object.keys(groups).sort()) {
    const color = LINE_COLORS[lineId] || '#888';
    const lineName = LINE_NAMES[lineId] || lineId;
    const trains = groups[lineId];

    // 방향별 분리
    const dirs = {};
    trains.forEach(t => {
      const dir = t.updnLine || '기타';
      if (!dirs[dir]) dirs[dir] = [];
      dirs[dir].push(t);
    });

    html += `<div class="cm-line-group">
      <div class="cm-line-badge" style="background:${color}">${lineName}</div>`;

    for (const dir of Object.keys(dirs)) {
      html += `<div class="cm-dir-label">${dir}</div>`;
      dirs[dir].forEach(t => {
        const arrMsg = t.arvlMsg2 || '';
        const destParts = (t.trainLineNm || '').split(' - ');
        const dest = destParts[0] || t.bstatnNm || '';
        const via = destParts[1] || '';
        const isExpress = t.btrainSttus === '급행';
        const isLast = t.lstcarAt === '1';
        const trainNo = t.btrainNo || '';
        const sec = parseInt(t.barvlDt) || 0;
        const minText = sec > 0 ? Math.floor(sec / 60) + '분' + (sec % 60 > 0 ? ' ' + (sec % 60) + '초' : '') : '';

        html += `<div class="cm-train-row">
          <div class="cm-train-info">
            <div class="cm-train-dest">
              ${dest}
              ${via ? `<span class="cm-train-via">${via}</span>` : ''}
              ${isExpress ? '<span class="cm-badge express">급행</span>' : ''}
              ${isLast ? '<span class="cm-badge last">막차</span>' : ''}
            </div>
            <div class="cm-train-msg">${arrMsg}${minText && !arrMsg.includes('분') ? ' (' + minText + ')' : ''}</div>
          </div>
          <button class="cm-alarm-btn" type="button" onclick="setCommuteAlarm('${stationName}','${dest}','${arrMsg}',${sec},'${trainNo}')" title="하차 알람">
            🔔
          </button>
        </div>`;
      });
    }
    html += '</div>';
  }

  results.innerHTML = html;
}

function setCommuteAlarm(station, dest, msg, delaySec, trainNo) {
  // 기존 알람 취소
  if (commuteAlarmTimer) clearTimeout(commuteAlarmTimer);

  // 알람 시간: 도착 예상 시간의 80% 지점 (1정거장 전 근사)
  const alarmSec = Math.max(Math.floor(delaySec * 0.8), delaySec - 120);
  const alarmMs = Math.max(alarmSec * 1000, 10000); // 최소 10초

  commuteAlarmInfo = { station, dest, trainNo };

  commuteAlarmTimer = setTimeout(function() {
    // 진동
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
    // 알림
    showToast('🔔 곧 도착! ' + dest + ' 방면 — 하차 준비하세요');
    // Web Notification
    if (Notification && Notification.permission === 'granted') {
      new Notification('하차 알람 🔔', {
        body: dest + ' 방면 열차가 곧 도착합니다. 하차 준비하세요!',
        icon: 'logo.png',
        vibrate: [300, 100, 300]
      });
    }
    // 알람 바 업데이트
    document.getElementById('cmAlarmBar').classList.add('hidden');
    commuteAlarmTimer = null;
    commuteAlarmInfo = null;
  }, alarmMs);

  // 알람 바 표시
  const bar = document.getElementById('cmAlarmBar');
  const alarmMin = Math.ceil(alarmSec / 60);
  document.getElementById('cmAlarmText').textContent =
    dest + ' 방면 · 약 ' + alarmMin + '분 후 알림';
  bar.classList.remove('hidden');
  showToast('🔔 알람 설정 완료 — 약 ' + alarmMin + '분 후 알려드릴게요');
}

function cancelCommuteAlarm() {
  if (commuteAlarmTimer) {
    clearTimeout(commuteAlarmTimer);
    commuteAlarmTimer = null;
    commuteAlarmInfo = null;
  }
  document.getElementById('cmAlarmBar').classList.add('hidden');
  showToast('알람이 취소되었습니다');
}

function updateHomeCommuteCard() {
  const sub = document.getElementById('hcNextTrain');
  if (!sub) return;
  const favs = getFavStations();
  if (favs.length === 0) {
    sub.textContent = '역을 즐겨찾기하면 실시간 도착정보를 볼 수 있어요';
    return;
  }
  // 첫 즐겨찾기 역의 도착정보 미리보기
  const url = COMMUTE_PROXY + '/api/subway/' + API_KEY + '/json/realtimeStationArrival/0/3/' + encodeURIComponent(favs[0]);
  fetch(url, { signal: AbortSignal.timeout(5000) })
    .then(r => r.json())
    .then(data => {
      if (data.realtimeArrivalList && data.realtimeArrivalList.length > 0) {
        const t = data.realtimeArrivalList[0];
        const lineName = LINE_NAMES[t.subwayId] || '';
        sub.textContent = favs[0] + ' · ' + lineName + ' ' + (t.arvlMsg2 || '');
      } else {
        sub.textContent = favs[0] + ' · 실시간 정보 없음';
      }
    })
    .catch(() => {
      sub.textContent = favs[0] + ' · 탭하여 확인';
    });
}

// cmSearchInput Enter키 지원
document.addEventListener('DOMContentLoaded', function() {
  const cmInput = document.getElementById('cmSearchInput');
  if (cmInput) {
    cmInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); searchStation(); }
    });
  }
});

// ===== INIT =====
(function () {
  document.body.classList.add('splash-active');

  try {
    // Restore state
    const sv = localStorage.getItem('dp');
    if (sv) {
      const p = P.find(x => x.I === sv);
      if (p) {
        cur = p;
        document.getElementById('calPersonName').textContent = p.n;
        document.getElementById('setName').textContent = p.n;
      }
    }

    // Supabase 초기화
    initSupabase();

    // 즉시 localStorage 캐시로 UI 표시
    try {
      const saved = localStorage.getItem('diaAlerts');
      alerts = saved ? JSON.parse(saved) : [];
    } catch (e) { alerts = []; }

    initDark();
    tick();
    setInterval(tick, 1000);
    rHome();
    // 배너 상태 자동 전환 — 1분마다 홈 갱신
    setInterval(function() {
      if (!weekPreviewDate && cur) rHome();
    }, 60000);
    initCal();
    initCmp();
    rMore();
    renderHomeExtras();
    initPWA();

    // Supabase에서 최신 알림 비동기 로드
    loadAlerts().then(() => {
      renderAlertList();
      renderAlertBanner();
      renderAlertBadge();
      updateAlertIndicators();
    });

    // 열차 데이터 프리페치 — 노선 탭 들어가기 전에 미리 로드
    prefetchTrains();
    initShake();
    cleanOldMemos();
    updateHomeCommuteCard();
  } catch (e) {
    // 초기화 실패 시에도 앱을 표시 (디버그용 콘솔 출력)
    try { showToast('초기화 중 오류가 발생했습니다'); } catch(_) {}
    window.__diaErrors = window.__diaErrors || []; window.__diaErrors.push(e);
  }

  // Dismiss splash — 에러 발생해도 항상 실행
  setTimeout(dismissSplash, 1200);

  // 스플래시 후: PWA 미설치면 설치 유도 → 알림 허용
  // 3초 대기 — beforeinstallprompt 이벤트가 도착할 시간 확보
  setTimeout(() => {
    try {
      if (!isPWAInstalled()) {
        showPWAPrompt();
      } else {
        requestNotificationPermission();
      }
    } catch (e) { /* ignore */ }
  }, 3000);
})();
