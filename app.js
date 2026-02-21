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
let trainData = [], trainTimer = null;
let lineViewMode = 'list', lastTrainFetch = 0, updateCounterTimer = null;

// ===== UTILITY =====
function td() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function isH(d) {
  if (d.getDay() === 0) return true;
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
  if (n >= 61 && n <= 91) return 'night';
  if (n >= 1 && n <= 43) return 'day';
  return 'rest';
}

function gSched(dia, date) {
  if (dia === '~' || dia.startsWith('휴')) return null;
  const h = isH(date);
  const tm = new Date(date);
  tm.setDate(tm.getDate() + 1);
  const th = isH(tm);
  const tp = gType(dia);
  let t;
  if (tp === 'day' || tp === 'standby') {
    t = h ? S.p_hol : S.p_ord;
  } else if (tp === 'night') {
    if (h && th) t = S.p_holhol;
    else if (h && !th) t = S.p_holord;
    else if (!h && th) t = S.p_ordhol;
    else t = S.p_ordord;
  } else return null;
  return t[dia] || null;
}

function gLabel(d) {
  if (d === '~') return '비순환';
  if (d.startsWith('휴')) return '휴무';
  if (d.startsWith('대')) return '대기';
  const n = parseInt(d);
  return n >= 61 ? '야간' : '주간';
}

function gTypeName(tp) {
  return { day: '주간 근무', night: '야간 근무', standby: '대기 근무', rest: '휴무' }[tp] || '휴무';
}

function gColor(t) {
  return { day: 'var(--blue)', night: 'var(--purple)', rest: 'var(--gray)', standby: 'var(--orange)' }[t] || 'var(--gray)';
}

function expandRoute(m) {
  if (!m) return '';
  // Split by comma, expand each segment
  const parts = m.split(',');
  const segments = [];
  let timeCode = '';
  parts.forEach(p => {
    const trimmed = p.trim();
    // Check if it's a 4-digit time code (e.g., "1648")
    if (/^\d{4}$/.test(trimmed)) {
      const hh = trimmed.slice(0, 2), mm = trimmed.slice(2);
      timeCode = `${hh}:${mm}`;
    } else {
      // Expand station abbreviations
      let expanded = '';
      for (const ch of trimmed) {
        expanded += STATION_ABBR[ch] || ch;
        expanded += '→';
      }
      expanded = expanded.replace(/→$/, ''); // remove trailing arrow
      segments.push(expanded);
    }
  });
  let html = segments.map(s => `<span class="tc-route-seg">${s}</span>`).join('<br>');
  if (timeCode) {
    html += `<span class="tc-route-time">교대 ${timeCode}</span>`;
  }
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

// ===== CLOCK =====
function tick() {
  const n = new Date();
  const de = document.getElementById('homeDate');
  const te = document.getElementById('homeTime');
  const se = document.getElementById('homeSec');
  if (de) de.textContent = `${n.getFullYear()}년 ${n.getMonth() + 1}월 ${n.getDate()}일 ${DOW[n.getDay()]}요일`;
  if (te) {
    const h = n.getHours(), ap = h < 12 ? '오전' : '오후', h12 = h % 12 || 12;
    te.textContent = `${ap} ${String(h12).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  }
  if (se) se.textContent = `:${String(n.getSeconds()).padStart(2, '0')}`;
}

// ===== HOME =====
function rHome() {
  const ne = document.getElementById('homeName');
  if (cur) {
    ne.innerHTML = `<span style="cursor:pointer" onclick="openModal('home')">${cur.n} <span style="opacity:.6;font-size:18px;">▾</span></span>`;
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

  const today = td(), dia = gDia(cur, today), tp = gType(dia);
  const sc = gSched(dia, today), hl = isH(today) ? '휴일' : '평일';
  let infoH = '';
  if (sc) {
    infoH = `<div class="tc-time-hero">
      <div class="tc-time-block">
        <div class="tc-time-label">출근</div>
        <div class="tc-time-val">${sc.s || '-'}</div>
      </div>
      <div class="tc-time-arrow">→</div>
      <div class="tc-time-block">
        <div class="tc-time-label">퇴근</div>
        <div class="tc-time-val">${sc.e || '-'}</div>
      </div>
      <div class="tc-time-block small">
        <div class="tc-time-label">근무</div>
        <div class="tc-time-val sm">${sc.t || '-'}</div>
      </div>
    </div>`;
    if (sc.m) {
      infoH += `<div class="tc-route">
        <div class="tc-route-label">🚇 운전행로</div>
        <div class="tc-route-text">${expandRoute(sc.m)}</div>
      </div>`;
    }
  } else {
    infoH = `<div class="tc-rest-msg">오늘은 휴무입니다 😊</div>`;
  }

  el.innerHTML = `<div class="today-card">
    <div class="tc-header">
      <div class="tc-label">오늘의 교번 · ${hl}</div>
      <span class="tc-badge ${tp}">${gLabel(dia)}</span>
    </div>
    <div class="tc-body">
      <div class="tc-dia ${tp}">${dia}</div>
      <div class="tc-type-name">${gTypeName(tp)}</div>
    </div>${infoH}</div>`;

  // Week preview
  const we = document.getElementById('homeWeek');
  let wh = '<div class="section-label">이번 주 일정</div><div class="week-strip">';
  const todayD = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - todayD);

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const di = gDia(cur, d), tt = gType(di), isT = d.getTime() === today.getTime();
    const ss = gSched(di, d);
    let timeStr = '';
    if (ss && ss.s && !ss.s.startsWith('대') && ss.s !== '대휴') {
      timeStr = ss.s.replace('기', '');
    }
    wh += `<div class="week-day ${isT ? 'is-today' : ''}">
      <div class="wd-dow">${DOW[i]}</div>
      <div class="wd-date">${d.getDate()}</div>
      <div class="wd-dia ${tt}">${di === '~' ? '-' : di}</div>
      ${timeStr ? `<div class="wd-time">${timeStr}</div>` : ''}
    </div>`;
  }
  wh += '</div>';
  we.innerHTML = wh;

  // Status cards
  const stEl = document.getElementById('homeStatus');
  let restIn = 0;
  for (let i = 1; i <= 128; i++) {
    const fd = new Date(today);
    fd.setDate(fd.getDate() + i);
    const fdia = gDia(cur, fd);
    if (gType(fdia) === 'rest') { restIn = i; break; }
  }

  let nextWork = '';
  if (tp === 'rest' || tp === 'standby') {
    for (let i = 1; i <= 128; i++) {
      const fd = new Date(today);
      fd.setDate(fd.getDate() + i);
      const fdia = gDia(cur, fd);
      const ftp = gType(fdia);
      if (ftp === 'day' || ftp === 'night') {
        const fsc = gSched(fdia, fd);
        nextWork = `<div class="status-card">
          <div class="sc-label">다음 근무</div>
          <div class="sc-val" style="font-size:16px;line-height:1.6">
            ${i}일 후 · ${gTypeName(ftp)}<br>
            ${fsc ? fsc.s + ' 출근' : ''}
          </div>
        </div>`;
        break;
      }
    }
  }

  const restDate = new Date(today);
  restDate.setDate(restDate.getDate() + restIn);
  const restDateStr = `${restDate.getMonth() + 1}/${restDate.getDate()} (${DOW[restDate.getDay()]})`;
  const restColor = restIn <= 1 ? 'var(--green)' : 'var(--blue)';
  const restText = restIn === 0 ? '오늘 휴무!' : `${restIn}일 뒤`;

  stEl.innerHTML = `<div class="status-bar">
    <div class="status-card">
      <div class="sc-label">다음 쉬는 날</div>
      <div class="sc-val" style="color:${restColor}">${restText}</div>
      <div class="sc-sub">${restDateStr}</div>
    </div>
    ${nextWork || `<div class="status-card">
      <div class="sc-label">128일 주기</div>
      <div class="sc-val" style="font-size:14px;line-height:1.8">주간 43일 · 야간 31일<br>대기 13일 · 휴무 41일</div>
    </div>`}
  </div>`;
}

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
        createdBy: a.created_by, active: a.is_active, photo: a.photo || null
      };
      // 중복 방지 (내가 방금 등록한 것)
      if (!alerts.find(x => x.id === a.id)) {
        alerts.unshift(mapped);
        localStorage.setItem('diaAlerts', JSON.stringify(alerts));
        renderAlertList();
        renderAlertBanner();
        renderAlertBadge();
  updateAlertIndicators();
        // 다른 사람이 등록한 알림이면 브라우저 알림
        if (a.created_by !== (cur ? cur.n : '')) {
          sendNotification(`${a.station}역 장애 발생`, a.message);
        }
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
      createdBy: a.created_by, active: a.is_active, photo: a.photo || null
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
      <div class="alert-empty-icon">✅</div>
      <div class="alert-empty-msg">현재 장애 알림이 없습니다</div>
    </div>`;
    return;
  }

  let h = '';
  active.forEach(a => {
    const photoHtml = a.photo ? `<div class="alert-item-photo" onclick="viewAlertPhoto('${a.id}')"><img src="${a.photo}" alt="장애 사진"></div>` : '';
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

let alertPhotoData = null;
const ALL_STATIONS = [...LINE5_MAIN, ...LINE5_MACHEON, ...LINE5_HANAM];

function openAlertForm() {
  document.getElementById('alertStationInput').value = '';
  document.getElementById('alertStation').value = '';
  document.getElementById('alertSuggest').innerHTML = '';
  document.getElementById('alertMessage').value = '';
  document.getElementById('alertPhotoPreview').innerHTML = '';
  alertPhotoData = null;
  alertSeverity = 'high';
  document.querySelectorAll('.af-sev-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.af-sev-btn.high').classList.add('active');
  document.getElementById('alertModalBg').classList.add('open');

  // 역 검색 이벤트
  const input = document.getElementById('alertStationInput');
  input.oninput = () => {
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
  };
  // 포커스 시 전체 목록 (빈 입력일 때)
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
}

// 사진 처리 — 리사이즈 + Base64
function handleAlertPhoto(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // 리사이즈: 최대 800px, 품질 0.7 (데이터 절약)
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      alertPhotoData = canvas.toDataURL('image/jpeg', 0.7);

      // 미리보기 표시
      const preview = document.getElementById('alertPhotoPreview');
      preview.innerHTML = `<div class="af-photo-thumb">
        <img src="${alertPhotoData}" alt="첨부 사진">
        <button class="af-photo-remove" type="button" onclick="removeAlertPhoto()">✕</button>
      </div>`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  // 같은 파일 다시 선택 가능하도록 초기화
  input.value = '';
}

function removeAlertPhoto() {
  alertPhotoData = null;
  document.getElementById('alertPhotoPreview').innerHTML = '';
}

function viewAlertPhoto(id) {
  const a = alerts.find(x => x.id === id);
  if (!a || !a.photo) return;
  const overlay = document.createElement('div');
  overlay.className = 'photo-overlay';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `<img src="${a.photo}" alt="장애 사진">`;
  document.body.appendChild(overlay);
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
  const photo = alertPhotoData || null;

  if (sb) {
    try {
      const insertData = { station, message, severity: alertSeverity, created_by: creator };
      if (photo) insertData.photo = photo;
      const { data, error } = await sb.from('alerts').insert(insertData).select().single();

      if (error) throw error;

      alerts.unshift({
        id: data.id, station, message, severity: alertSeverity,
        ts: new Date(data.created_at).getTime(), createdBy: creator, active: true,
        photo: photo
      });
      localStorage.setItem('diaAlerts', JSON.stringify(alerts));
    } catch (e) {
      showToast('알림 등록 실패 — 네트워크를 확인해 주세요');
      return;
    }
  } else {
    alerts.unshift({
      id: 'local-' + Date.now(), station, message, severity: alertSeverity,
      ts: Date.now(), createdBy: creator, active: true, photo: photo
    });
    localStorage.setItem('diaAlerts', JSON.stringify(alerts));
  }

  alertPhotoData = null;
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
      showToast('해제에 실패했습니다');
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
    statusEl.textContent = 'ON';
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

  // FAB 카운트
  const fabCount = document.getElementById('fabCount');
  if (count > 0) {
    fabCount.textContent = count;
    fabCount.classList.add('show');
  } else {
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
function goTab(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (el) el.classList.add('active');
  else {
    const tabs = document.querySelectorAll('.tab');
    const m = ['pageHome', 'pageCal', 'pageLine', 'pageCmp', 'pageMore'];
    const i = m.indexOf(id);
    if (i >= 0 && tabs[i]) tabs[i].classList.add('active');
  }
  if (id === 'pageHome') rHome();
  if (id === 'pageLine') initLine5();
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

    h += `<div class="${cls}" onclick="pickDate(${d})">
      <div class="cd">${d}</div>
      ${di && di !== '~' ? `<div class="cdia ${dc}">${di}</div>` : ''}
      ${hl && dw !== 0 ? '<div class="cal-hol-dot"></div>' : ''}
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
      <div class="sd-dia" style="color:${gColor(tp)}">${dia}</div>
      <div class="sd-row"><span class="sd-rl">출근</span><span class="sd-rv">${sc.s || '-'}</span></div>
      <div class="sd-row"><span class="sd-rl">퇴근</span><span class="sd-rv">${sc.e || '-'}</span></div>
      <div class="sd-row"><span class="sd-rl">근무시간</span><span class="sd-rv">${sc.t || '-'}</span></div>
      ${sc.m ? `<div class="sd-route">${sc.m}</div>` : ''}
    </div>`;
  } else {
    sh = `<div class="sd-body">
      <div class="sd-dia" style="color:${gColor(tp)}">${dia}</div>
      <div style="text-align:center;padding:16px;color:var(--text2);font-size:18px;font-weight:600">
        ${dia === '~' ? '비순환 (근무 없음)' : '휴무'}
      </div>
    </div>`;
  }
  el.innerHTML = `<div class="sched-detail">
    <div class="sd-top">
      <div class="sd-date">${selDate.getMonth() + 1}월 ${selDate.getDate()}일 (${dw}) · ${hl}</div>
      <span class="sd-badge tc-badge ${tp}">${gLabel(dia)}</span>
    </div>${sh}</div>`;
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
    el.innerHTML = '<div class="empty-msg">비교할 기관사 2명을 선택하세요</div>';
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

    h += `<div class="cmp-row-card"><div class="cmp-pair">
      <div class="cmp-card" style="border-top-color:${gColor(t1)}">
        <div class="cmp-cd-date">${d}일 (${dw}) ${hlIcon}</div>
        <div class="cmp-cd-name">${c1.n}</div>
        <div class="cmp-cd-dia" style="color:${gColor(t1)}">${d1}</div>
        ${s1 ? `<div class="cmp-info-row"><span class="cir-l">출근</span><span class="cir-v">${s1.s || '-'}</span></div>
        <div class="cmp-info-row"><span class="cir-l">퇴근</span><span class="cir-v">${s1.e || '-'}</span></div>
        <div class="cmp-cd-route">${s1.m || ''}</div>` : `<div style="color:var(--gray);font-size:15px;font-weight:500">휴무</div>`}
      </div>
      <div class="cmp-card" style="border-top-color:${gColor(t2)}">
        <div class="cmp-cd-date">${d}일 (${dw}) ${hlIcon}</div>
        <div class="cmp-cd-name">${c2.n}</div>
        <div class="cmp-cd-dia" style="color:${gColor(t2)}">${d2}</div>
        ${s2 ? `<div class="cmp-info-row"><span class="cir-l">출근</span><span class="cir-v">${s2.s || '-'}</span></div>
        <div class="cmp-info-row"><span class="cir-l">퇴근</span><span class="cir-v">${s2.e || '-'}</span></div>
        <div class="cmp-cd-route">${s2.m || ''}</div>` : `<div style="color:var(--gray);font-size:15px;font-weight:500">휴무</div>`}
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
    fetchTrains();
    startTrainPolling();
    startUpdateCounter();
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
        transferH += `<span class="tk-transfer-tag">${t}</span>`;
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

}

// ===== MAP VIEW =====
function toggleLineView() {
  lineViewMode = lineViewMode === 'list' ? 'map' : 'list';
  const isMap = lineViewMode === 'map';
  document.getElementById('lineTrackWrap').style.display = isMap ? 'none' : '';
  document.getElementById('lineMapWrap').style.display = isMap ? '' : 'none';
  document.getElementById('lineBranchBar').style.display = isMap ? 'none' : '';

  const btn = document.getElementById('lineViewToggle');
  btn.innerHTML = isMap
    ? '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'
    : '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>';
  btn.title = isMap ? '목록 보기' : '노선도 보기';

  if (isMap) renderLine5Map();
}

function renderLine5Map() {
  const coords = LINE5_MAP;
  const routes = LINE5_ROUTES;
  const nameMap = { '동대문역사문화공원': '동대문역사' };

  let svg = '<defs>';
  svg += '<filter id="mapGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  svg += '<filter id="trainGl"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  svg += '</defs>';

  // Route lines (glow + main)
  ['main', 'macheon', 'hanam'].forEach(branch => {
    const stns = routes[branch];
    let d = stns.map((name, i) => {
      const [x, y] = coords[name];
      return (i === 0 ? 'M' : 'L') + x + ',' + y;
    }).join(' ');
    svg += `<path d="${d}" fill="none" stroke="rgba(139,92,246,0.2)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" class="map-route-glow"/>`;
    svg += `<path d="${d}" fill="none" stroke="#8B5CF6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  });

  // Direction labels
  svg += '<text x="50" y="28" fill="rgba(255,255,255,0.3)" font-size="10" font-weight="600" font-family="system-ui,sans-serif">← 방화</text>';
  svg += '<text x="890" y="350" fill="rgba(255,255,255,0.3)" font-size="10" font-weight="600" text-anchor="middle" font-family="system-ui,sans-serif">강동 →</text>';
  svg += '<text x="400" y="460" fill="rgba(255,255,255,0.3)" font-size="10" font-weight="600" text-anchor="middle" font-family="system-ui,sans-serif">← 마천</text>';
  svg += '<text x="260" y="530" fill="rgba(255,255,255,0.3)" font-size="10" font-weight="600" text-anchor="middle" font-family="system-ui,sans-serif">← 하남검단산</text>';

  // Station dots and labels
  Object.entries(coords).forEach(([name, [x, y]]) => {
    const isDapsimni = name === '답십리';
    const transfers = LINE5_TRANSFERS[name];
    const isTransfer = transfers && !transfers.some(t => t.includes('지선'));

    if (isTransfer) {
      svg += `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>`;
    }

    if (isDapsimni) {
      svg += `<circle cx="${x}" cy="${y}" r="8" fill="rgba(251,191,36,0.15)" class="map-pulse"/>`;
      svg += `<circle cx="${x}" cy="${y}" r="6" fill="#FBBF24" filter="url(#mapGlow)"/>`;
    } else {
      const r = isTransfer ? 4.5 : 3;
      svg += `<circle cx="${x}" cy="${y}" r="${r}" fill="${isTransfer ? '#fff' : 'rgba(255,255,255,0.65)'}"/>`;
    }

    const displayName = nameMap[name] || name;
    const labelCls = isDapsimni ? 'map-label-dap' : 'map-label';
    svg += `<text x="${x}" y="${y + 16}" text-anchor="middle" class="${labelCls}">${displayName}</text>`;

    if (isTransfer) {
      svg += `<text x="${x}" y="${y + 25}" text-anchor="middle" class="map-transfer-text">${transfers.join('·')}</text>`;
    }

    if (isDapsimni) {
      svg += `<text x="${x + 24}" y="${y + 5}" fill="#FBBF24" font-size="12" font-family="system-ui">★</text>`;
    }
  });

  // Train markers
  const trainsByStation = {};
  trainData.forEach(t => {
    const stn = t.statnNm.replace('역', '');
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
      const offsetY = isUp ? -(24 + idx * 20) : (28 + idx * 20);
      const dest = (t.statnTnm || '').replace('역', '');
      const no = t.trainNo || '';
      const label = `${dest} ${no}`;
      const arriving = t.trainSttus === '0';
      const fillColor = isUp ? '#22C55E' : '#F97316';
      const capsuleW = Math.max(label.length * 8 + 14, 56);
      const capsuleX = -capsuleW / 2;

      svg += `<g transform="translate(${sx},${sy + offsetY})" filter="url(#trainGl)" class="${arriving ? 'map-train-arrive' : ''}">`;
      svg += `<rect x="${capsuleX}" y="-9" width="${capsuleW}" height="18" rx="4" fill="${fillColor}" opacity="${arriving ? 1 : 0.85}"/>`;
      svg += `<text x="0" y="4" text-anchor="middle" fill="white" font-size="9" font-weight="700" font-family="system-ui,sans-serif">${label}</text>`;
      svg += '</g>';
    });
  });

  document.getElementById('lineMapContent').innerHTML =
    `<svg viewBox="-30 -10 1020 620" class="line-map-svg" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;

  // Auto-scroll to 답십리
  setTimeout(() => {
    const scroll = document.getElementById('lineMapScroll');
    if (!scroll) return;
    const scaleX = 1100 / 1020, scaleY = 669 / 620;
    const dapX = (470 + 30) * scaleX, dapY = (360 + 10) * scaleY;
    scroll.scrollLeft = Math.max(0, dapX - scroll.clientWidth / 2);
    scroll.scrollTop = Math.max(0, dapY - scroll.clientHeight / 2);
  }, 80);
}

function startUpdateCounter() {
  clearInterval(updateCounterTimer);
  updateCounterTimer = setInterval(() => {
    if (!lastTrainFetch) return;
    const el = document.getElementById('lineUpdateTime');
    const diff = Math.floor((Date.now() - lastTrainFetch) / 1000);
    if (diff < 5) el.textContent = '실시간 · 방금 갱신';
    else if (diff < 60) el.textContent = `실시간 · ${diff}초 전 갱신`;
    else el.textContent = `실시간 · ${Math.floor(diff / 60)}분 전 갱신`;
  }, 1000);
}

function fetchTrains() {
  const btn = document.getElementById('lineRefreshBtn');
  const statusEl = document.getElementById('lineUpdateTime');
  btn.classList.add('spinning');
  statusEl.textContent = '불러오는 중...';

  const url = `https://swopenAPI.seoul.go.kr/api/subway/${API_KEY}/json/realtimePosition/0/100/5호선`;
  fetch(url, { signal: AbortSignal.timeout(10000) })
    .then(r => r.json())
    .then(data => {
      btn.classList.remove('spinning');
      if (data.realtimePositionList) {
        trainData = data.realtimePositionList;
        lastTrainFetch = Date.now();
        renderLine5();
        if (lineViewMode === 'map') renderLine5Map();
      } else if (data.errorMessage) {
        trainData = [];
        renderLine5();
        const now = new Date();
        const h = now.getHours();
        if (h >= 1 && h < 5) {
          statusEl.textContent = '심야 운행 종료 (05시 재개)';
        } else {
          statusEl.textContent = '열차 데이터 없음';
        }
      } else {
        statusEl.textContent = '데이터 오류 — 다시 시도해주세요';
      }
    })
    .catch(e => {
      btn.classList.remove('spinning');
      if (e.name === 'TimeoutError') {
        statusEl.textContent = '서버 응답 없음 — 다시 시도해주세요';
      } else {
        statusEl.textContent = '네트워크 연결 실패';
      }
    });
}

// ===== MORE =====
function rMore() {
  const ce = document.getElementById('contactCards');
  let ch = '';
  CPH.forEach(c => {
    ch += `<div class="cp-card">
      <div class="cp-name">${c.n}</div>
      <div class="cp-nums">
        <a class="cp-num" href="tel:${c.a}">📞 ${c.a}</a>
        <a class="cp-num" href="tel:${c.b}">📞 ${c.b}</a>
      </div>
    </div>`;
  });
  ce.innerHTML = ch;

  if (cur) {
    document.getElementById('setName').textContent = cur.n;
    document.getElementById('morePersonInfo').textContent = `${cur.n} · 오늘: ${gDia(cur, td())}`;
  }

  renderAlertBadge();
  updateAlertIndicators();
  updateNotiSetting();
}

function showSub(id) {
  document.getElementById('moreMain').style.display = 'none';
  document.getElementById(id).classList.add('active');
  if (id === 'sopPanel') rSopList();
  if (id === 'alertPanel') renderAlertList();
}

function hideSub(id) {
  document.getElementById(id).classList.remove('active');
  document.getElementById('moreMain').style.display = 'block';
}

// ===== SOP =====
function rSopList() {
  const el = document.getElementById('sopList');
  const em = SOP.filter(s => s.sub === '1');
  const bc = SOP.filter(s => s.sub === '2');
  let h = '<div class="section-label" style="padding:14px 20px 8px">이례상황 조치</div>';
  em.forEach(s => {
    const i = SOP.indexOf(s);
    h += `<div class="sop-card" onclick="showSopD(${i})">
      <div class="sop-t">⚠️ ${s.t}</div>
      ${s.c ? `<div class="sop-c">${s.c}</div>` : ''}
    </div>`;
  });
  h += '<div class="section-label" style="padding:14px 20px 8px">방송문안</div>';
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
  if (s.o) h += `<div class="sop-sec"><div class="sop-sec-t">${s.sub === '1' ? '발생현상' : '방송문안'}</div><div class="sop-sec-b">${s.o}</div></div>`;
  if (s.s) h += `<div class="sop-sec"><div class="sop-sec-t">조치절차</div><div class="sop-sec-b">${s.s}</div></div>`;
  if (s.ca) h += `<div class="sop-sec"><div class="sop-sec-t">주의사항</div><div class="sop-sec-b">${s.ca}</div></div>`;
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
    document.getElementById('c1Name').textContent = p.n;
    document.getElementById('c1Sub').textContent = '오늘: ' + gDia(p, td());
    document.getElementById('cmpSel1').classList.add('filled');
    rCmp();
  } else if (mTarget === 'c2') {
    c2 = p;
    document.getElementById('c2Name').textContent = p.n;
    document.getElementById('c2Sub').textContent = '오늘: ' + gDia(p, td());
    document.getElementById('cmpSel2').classList.add('filled');
    rCmp();
  }
  document.getElementById('modalBg').classList.remove('open');
}

// ===== DARK MODE =====
function toggleDark() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark ? '1' : '0');
  document.getElementById('darkToggle').classList.toggle('on', isDark);
  document.querySelector('meta[name="theme-color"]').content = isDark ? '#1F2937' : '#1A56DB';
}

function initDark() {
  const saved = localStorage.getItem('darkMode');
  if (saved === '1') {
    document.body.classList.add('dark');
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
    const modal = document.getElementById('modalBg');
    const alertModal = document.getElementById('alertModalBg');
    if (alertModal.classList.contains('open')) {
      alertModal.classList.remove('open');
    } else if (modal.classList.contains('open')) {
      modal.classList.remove('open');
    }
  }
});

// ===== INIT =====
(function () {
  document.body.classList.add('splash-active');

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
  initCal();
  initCmp();
  rMore();
  initPWA();

  // Supabase에서 최신 알림 비동기 로드
  loadAlerts().then(() => {
    renderAlertList();
    renderAlertBanner();
    renderAlertBadge();
  updateAlertIndicators();
  });

  // Dismiss splash after load
  setTimeout(dismissSplash, 1200);

  // 스플래시 후: PWA 미설치면 설치 유도 → 알림 허용
  // 3초 대기 — beforeinstallprompt 이벤트가 도착할 시간 확보
  setTimeout(() => {
    if (!isPWAInstalled()) {
      showPWAPrompt();
    } else {
      requestNotificationPermission();
    }
  }, 3000);
})();
