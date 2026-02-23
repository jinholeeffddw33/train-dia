// subway.js — 서울 지하철 경로 검색 (카카오지하철 스타일)
// API: 서울교통공사 최단경로이동정보 (OA-22724)
(function() {
'use strict';

// ===== 역명 자동완성용 전체 역 목록 =====
var _raw = '가능,가락시장,가산디지털단지,가양,가좌,가천대,간석,갈매,강남,강남구청,강동,강동구청,강변,강일,개봉,개롱,개포동,개화,개화산,거여,건대입구,검암,경마공원,경복궁,경찰병원,계양,고덕,고려대,고색,고속터미널,고잔,공덕,공릉,공항시장,공항화물청사,과천,관악,광교,광교중앙,광나루,광명사거리,광운대,광화문,광흥창,교대,구로,구로디지털단지,구룡,구반포,구산,구의,구일,구파발,국수,국회의사당,군자,군포,굽은다리,금곡,금정,금천구청,금촌,금호,길동,길음,김유정,김포공항,까치산,까치울,남구로,남동인더스파크,남부터미널,남성,남영,남춘천,남태령,남한산성입구,낙성대,내방,노들,노량진,노원,노량진,녹번,녹사평,녹양,녹천,논현,능곡,단대오거리,달월,답십리,당고개,당곡,당산,당정,대공원,대곡,대기,대림,대모산입구,대방,대성리,대야미,대청,대치,대화,대흥,덕계,덕소,덕정,도곡,도농,도림천,도봉,도봉산,도심,도원,도화,독립문,독바위,독산,돌곶이,동대문,동대문역사문화공원,동두천,동두천중앙,동묘앞,동암,동인천,동작,동천,두정,둔촌동,둔촌오륜,뚝섬,뚝섬유원지,디지털미디어시티,마곡,마곡나루,마두,마들,마석,마장,마천,마포,마포구청,망원,망우,망포,매교,매봉,매탄권선,먹골,면목,명동,명일,명학,모란,목동,몽촌토성,무악재,문래,문산,문정,미금,미사,미아,미아사거리,반월,반포,발산,방배,방이,방학,방화,배방,백마,백석,백운,백양리,범계,별내,별내별가람,보라매,보문,보산,보정,복정,봉명,봉은사,봉천,봉화산,부개,부천,부천시청,부천종합운동장,부평,불광,사가정,사당,사리,사릉,사평,산본,산성,삼각지,삼산체육관,삼성,삼성중앙,삼송,삼양,삼양사거리,삼전,상갈,상계,상도,상동,상록수,상봉,상수,상왕십리,상월곡,상일동,상현,상천,새절,샛강,서강대,서대문,서빙고,서울대벤처타운,서울대입구,서울숲,서울역,서원,서초,서현,석계,석남,석수,석촌,석촌고분,선릉,선바위,선유도,선정릉,성균관대,성복,성수,성신여대입구,세류,세마,소래포구,소사,소요산,솔밭공원,솔샘,송내,송도,송정,송파,송파나루,송탄,수내,수락산,수리산,수색,수원,수원시청,수진,수지구청,숙대입구,숭실대입구,신갈,신금호,신길,신길온천,신논현,신당,신답,신대방,신대방삼거리,신도림,신림,신목동,신방화,신반포,신설동,신용산,신이문,신정,신정네거리,신중동,신창,신촌,신풍,신흥,쌍문,쌍용,아산,아신,아차산,아현,안국,안산,안양,압구정,압구정로데오,약수,양수,양원,양재,양재시민의숲,양정,양천구청,양천향교,양평,어린이대공원,어천,언주,여의나루,여의도,역곡,역삼,역촌,연수,연신내,염창,영등포,영등포구청,영등포시장,영종,영통,예술회관,오금,오남,오류동,오목교,오목천,오빈,오산,오산대,오이도,온수,온양온천,올림픽공원,왕십리,외대앞,용답,용두,용마산,용문,용산,우장산,운길산,운서,운정,원당,원덕,원인재,원흥,월계,월곡,월곶,월드컵경기장,월롱,을지로3가,을지로4가,을지로입구,응봉,응암,의왕,의정부,이대,이매,이수,이촌,이태원,인천,인천공항1터미널,인천공항2터미널,인천논현,일산,일원,잠실,잠실나루,잠실새내,장승배기,장암,장지,장한평,죽전,중계,중곡,중동,중랑,중앙,중앙보훈병원,중화,증미,증산,지축,지행,지평,직산,진위,진접,창동,창신,천마산,천안,천왕,천호,철산,청구,청계산입구,청량리,청명,청평,청라국제도시,초지,총신대입구,충무로,충정로,춘의,춘천,태릉입구,태평,퇴계원,판교,팔당,평내호평,평촌,평택,평택지제,풍산,하남검단산,하남시청,하남풍산,하계,학동,학여울,한강진,한남,한대앞,한성대입구,한성백제,한양대,한티,합정,행당,행신,혜화,호구포,홍대입구,홍제,화곡,화랑대,화서,화전,화정,화계,회기,회룡,회현,효창공원앞,흑석,4·19민주묘지,북한산보국문,북한산우이,정릉,보라매공원,보라매병원,서울지방병무청';
var SW_ST = [];
(function() {
  var s = {};
  _raw.split(',').forEach(function(n) { s[n] = 1; });
  SW_ST = Object.keys(s).sort(function(a, b) { return a.localeCompare(b, 'ko'); });
})();

// ===== 호선 컬러 =====
var LC = {
  '1호선':'#0052A4','2호선':'#009246','3호선':'#EF7C1C','4호선':'#00A5DE',
  '5호선':'#996CAC','6호선':'#CD7C2F','7호선':'#747F00','8호선':'#E6186C',
  '9호선':'#BDB092','경의중앙선':'#77C4A3','공항철도':'#0090D2',
  '수인분당선':'#FABE00','신분당선':'#D4003B','경춘선':'#0C8E72',
  '우이신설선':'#B7C452','신림선':'#6789CA','GTX-A':'#9A6292'
};

// ===== 상태 =====
var swActiveInput = null;
var swResult = null;
var swMode = 'duration';
var swAlarmTimer = null;

// ===== 유틸 =====
function swNow() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0') + ' ' +
    String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':00';
}

function swFmtTime(sec) {
  var m = Math.round(sec / 60);
  if (m >= 60) return Math.floor(m/60) + '시간 ' + (m%60) + '분';
  return m + '분';
}

function swLineColor(name) { return LC[name] || '#888'; }

// ===== API 호출 =====
function swCallAPI(from, to, type) {
  var dt = swNow();
  var t = type || 'duration';
  // 서울 열린데이터 API: openapi.seoul.go.kr:8088 → 프록시 경유
  var url = COMMUTE_PROXY + '/api/subway/' + API_KEY + '/json/getShtrmPath/1/100/' +
    encodeURIComponent(from) + '/' + encodeURIComponent(to) + '/' + encodeURIComponent(dt) + '/' + t;
  return fetch(url, { signal: AbortSignal.timeout(15000) }).then(function(r) { return r.json(); });
}

// ===== 응답 파싱 =====
function swParse(data) {
  if (!data || !data.body) return null;
  var b = data.body;
  if (!b.paths || b.paths.length === 0) return null;
  return {
    searchType: b.searchType,
    totalDist: +b.totalDstc,
    totalTime: +b.totalreqHr,
    totalFare: +b.totalCardCrg,
    transfers: +b.trsitNmtm,
    transferStns: b.trfstnNms || [],
    segments: b.paths.map(function(p) {
      return {
        from: { name: p.dptreStn.stnNm, line: p.dptreStn.lineNm, code: p.dptreStn.stnCd },
        to: { name: p.arvlStn.stnNm, line: p.arvlStn.lineNm, code: p.arvlStn.stnCd },
        dist: +p.stnSctnDstc,
        time: +p.reqHr,
        wait: +p.wtngHr,
        terminal: p.tmnlStnNm || '',
        direction: p.upbdnbSe || '',
        trainNo: p.trainno || '',
        departsAt: p.trainDptreTm || '',
        arrivesAt: p.trainArvlTm || '',
        isTransfer: p.trsitYn === 'Y',
        isExpress: p.etrnYn === 'Y'
      };
    })
  };
}

// ===== UI: 페이지 열기/닫기 =====
function openSubway() {
  document.getElementById('subwayPage').classList.add('open');
  document.getElementById('tabBar').classList.add('hidden');
  swLoadFavs();
}

function closeSubway() {
  document.getElementById('subwayPage').classList.remove('open');
  document.getElementById('tabBar').classList.remove('hidden');
  swClearAlarm();
}

// ===== UI: 검색 =====
function swSearch() {
  var f = document.getElementById('swFrom').value.trim();
  var t = document.getElementById('swTo').value.trim();
  if (!f || !t) { showToast('출발역과 도착역을 입력하세요'); return; }

  var el = document.getElementById('swResults');
  el.innerHTML = '<div class="sw-loading"><div class="sw-spinner"></div>경로 검색 중...</div>';

  Promise.all([swCallAPI(f, t, 'duration'), swCallAPI(f, t, 'transfer')])
    .then(function(res) {
      var dur = swParse(res[0]);
      var trf = swParse(res[1]);
      if (!dur && !trf) {
        el.innerHTML = '<div class="sw-empty">경로를 찾을 수 없습니다<br><small>역 이름을 확인해주세요 (예: 답십리, 강남)</small></div>';
        return;
      }
      swResult = { duration: dur, transfer: trf, from: f, to: t };
      swMode = 'duration';
      swRender();
      swSaveFav(f, t);
    })
    .catch(function() {
      el.innerHTML = '<div class="sw-empty">서버 연결 실패<br><small>네트워크를 확인해주세요</small></div>';
    });
}

function swSwap() {
  var f = document.getElementById('swFrom');
  var t = document.getElementById('swTo');
  var tmp = f.value;
  f.value = t.value;
  t.value = tmp;
}

// ===== UI: 결과 렌더링 =====
function swRender() {
  var el = document.getElementById('swResults');
  var r = swResult ? swResult[swMode] : null;
  if (!r) {
    // 해당 모드 결과 없으면 다른 모드로 폴백
    swMode = swMode === 'duration' ? 'transfer' : 'duration';
    r = swResult ? swResult[swMode] : null;
    if (!r) { el.innerHTML = '<div class="sw-empty">경로 정보 없음</div>'; return; }
  }

  var timeStr = swFmtTime(r.totalTime);
  var distKm = (r.totalDist / 1000).toFixed(1);

  // 첫 출발/마지막 도착 시각
  var firstSeg = null, lastSeg = null;
  for (var i = 0; i < r.segments.length; i++) {
    if (!r.segments[i].isTransfer && r.segments[i].departsAt && !firstSeg) firstSeg = r.segments[i];
  }
  for (var j = r.segments.length - 1; j >= 0; j--) {
    if (!r.segments[j].isTransfer && r.segments[j].arrivesAt) { lastSeg = r.segments[j]; break; }
  }
  var deptTime = firstSeg ? firstSeg.departsAt.substring(0, 5) : '';
  var arrvTime = lastSeg ? lastSeg.arrivesAt.substring(0, 5) : '';

  var html = '<div class="sw-tabs">' +
    '<button class="sw-tab' + (swMode === 'duration' ? ' active' : '') + '" type="button" onclick="swSetMode(\'duration\')">최단시간</button>' +
    '<button class="sw-tab' + (swMode === 'transfer' ? ' active' : '') + '" type="button" onclick="swSetMode(\'transfer\')">최소환승</button>' +
    '</div>' +
    '<div class="sw-summary">' +
      '<div class="sw-summary-label">소요시간</div>' +
      '<div class="sw-summary-time">' + timeStr + '</div>' +
      '<div class="sw-summary-info">환승 ' + r.transfers + '회 | 카드 ' + r.totalFare.toLocaleString() + '원 | ' + distKm + 'km</div>' +
    '</div>' +
    '<div class="sw-time-bar">' +
      '<div class="sw-time-pill">출발 ' + deptTime + '</div>' +
      '<div class="sw-time-pill">도착 ' + arrvTime + '</div>' +
    '</div>' +
    '<div class="sw-timeline">' + swRenderTimeline(r) + '</div>' +
    '<div class="sw-actions">' +
      '<button class="sw-alarm-btn" type="button" onclick="swSetAlarm()">🔔 하차 알림</button>' +
    '</div>';

  el.innerHTML = html;
}

// ===== 타임라인 렌더링 (카카오 스타일) =====
function swRenderTimeline(r) {
  // 세그먼트를 노선별 그룹으로 묶기
  var groups = [];
  var cur = null;

  r.segments.forEach(function(seg) {
    if (seg.isTransfer) {
      if (cur) groups.push(cur);
      groups.push({ type: 'transfer', seg: seg });
      cur = null;
    } else {
      if (!cur || cur.line !== seg.from.line) {
        if (cur) groups.push(cur);
        cur = {
          type: 'ride',
          line: seg.from.line,
          terminal: seg.terminal,
          direction: seg.direction,
          trainNo: seg.trainNo,
          firstDepart: seg.departsAt,
          stations: [seg.from.name],
          times: [seg.departsAt],
          totalTime: 0
        };
      }
      cur.stations.push(seg.to.name);
      cur.times.push(seg.arrivesAt);
      cur.totalTime += seg.time;
      cur.lastArrive = seg.arrivesAt;
    }
  });
  if (cur) groups.push(cur);

  var html = '';
  groups.forEach(function(g, gi) {
    if (g.type === 'transfer') {
      var waitMin = Math.ceil(g.seg.wait / 60);
      var toLine = g.seg.to.line;
      var color = swLineColor(toLine);
      html += '<div class="sw-tl-transfer">' +
        '<div class="sw-tl-transfer-dot">⇄</div>' +
        '<div class="sw-tl-transfer-text">' + toLine + ' 환승' +
          (waitMin > 0 ? ' · 대기 ' + waitMin + '분' : '') +
        '</div></div>';
    } else {
      var color = swLineColor(g.line);
      var stCount = g.stations.length;
      var midStations = g.stations.slice(1, -1);
      var rideMin = Math.round(g.totalTime / 60);
      var first = g.stations[0];
      var last = g.stations[stCount - 1];
      var deptStr = g.firstDepart ? g.firstDepart.substring(0, 5) : '';
      var arrvStr = g.lastArrive ? g.lastArrive.substring(0, 5) : '';
      var termDir = g.terminal ? g.terminal + '행' : '';

      html += '<div class="sw-tl-segment">' +
        '<div class="sw-tl-line-col">' +
          '<div class="sw-tl-dot-big" style="background:' + color + '"></div>' +
          '<div class="sw-tl-bar" style="background:' + color + '"></div>' +
          (midStations.length > 0 ? '<div class="sw-tl-bar" style="background:' + color + '"></div>' : '') +
          '<div class="sw-tl-dot-big" style="background:' + color + '"></div>' +
        '</div>' +
        '<div class="sw-tl-content">' +
          // 출발역
          '<div class="sw-tl-station first">' +
            '<div class="sw-tl-time">' + deptStr + '</div>' +
            '<div class="sw-tl-name">' + first + '</div>' +
            '<div class="sw-tl-badge" style="background:' + color + '">' + g.line.replace('호선', '') + '</div>' +
          '</div>' +
          '<div class="sw-tl-detail">' + termDir + (g.trainNo ? ' · ' + g.trainNo : '') + '</div>' +
          // 중간역 (접기/펼치기)
          (midStations.length > 0 ?
            '<div class="sw-tl-middle" onclick="this.classList.toggle(\'expanded\')">' +
              '<span class="sw-tl-middle-summary">' + midStations.length + '개역 (' + rideMin + '분) ▾</span>' +
              '<div class="sw-tl-middle-list">' +
                midStations.map(function(s, si) {
                  var t = g.times[si + 1] ? g.times[si + 1].substring(0, 5) : '';
                  return '<div class="sw-tl-mid-row"><span class="sw-tl-mid-time">' + t + '</span><span class="sw-tl-mid-dot" style="background:' + color + '"></span>' + s + '</div>';
                }).join('') +
              '</div>' +
            '</div>'
          : '') +
          // 도착역
          '<div class="sw-tl-station last">' +
            '<div class="sw-tl-time">' + arrvStr + '</div>' +
            '<div class="sw-tl-name">' + last + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
  });

  return html;
}

// ===== 자동완성 =====
function swInitAC() {
  ['swFrom', 'swTo'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
      swActiveInput = this;
      var v = this.value.trim();
      if (v.length < 1) { swHideAC(); return; }
      var matches = SW_ST.filter(function(s) { return s.indexOf(v) === 0; });
      if (matches.length === 0) matches = SW_ST.filter(function(s) { return s.indexOf(v) >= 0; });
      swShowAC(matches.slice(0, 8));
    });
    el.addEventListener('focus', function() { swActiveInput = this; });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { swHideAC(); swSearch(); }
    });
  });
  // 외부 클릭 시 자동완성 닫기
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.sw-search-area') && !e.target.closest('.sw-ac')) swHideAC();
  });
}

function swShowAC(list) {
  var el = document.getElementById('swAC');
  if (!el || list.length === 0) { swHideAC(); return; }
  el.innerHTML = list.map(function(s) {
    return '<div class="sw-ac-item" onmousedown="swPick(\'' + s.replace(/'/g, "\\'") + '\')">' + s + '</div>';
  }).join('');
  el.classList.add('show');
}

function swHideAC() {
  var el = document.getElementById('swAC');
  if (el) el.classList.remove('show');
}

function swPick(name) {
  if (swActiveInput) {
    swActiveInput.value = name;
    swActiveInput.blur();
  }
  swHideAC();
}

// ===== 즐겨찾기 =====
function swGetFavs() {
  try { return JSON.parse(localStorage.getItem('swFavRoutes') || '[]'); } catch(e) { return []; }
}

function swSaveFav(from, to) {
  var favs = swGetFavs();
  // 중복 제거
  favs = favs.filter(function(f) { return !(f.from === from && f.to === to); });
  favs.unshift({ from: from, to: to });
  if (favs.length > 10) favs.pop();
  localStorage.setItem('swFavRoutes', JSON.stringify(favs));
}

function swLoadFavs() {
  var el = document.getElementById('swFavs');
  if (!el) return;
  var favs = swGetFavs();
  if (favs.length === 0) {
    el.innerHTML = '<div class="sw-fav-empty">최근 검색한 경로가 여기에 표시됩니다</div>';
    return;
  }
  el.innerHTML = '<div class="sw-fav-title">최근 경로</div>' +
    favs.map(function(f) {
      return '<div class="sw-fav-item" onclick="swQuick(\'' + f.from.replace(/'/g, "\\'") + '\',\'' + f.to.replace(/'/g, "\\'") + '\')">' +
        '<span class="sw-fav-icon">↗</span>' +
        '<span class="sw-fav-route">' + f.from + ' → ' + f.to + '</span>' +
        '<span class="sw-fav-del" onclick="event.stopPropagation();swDelFav(\'' + f.from.replace(/'/g, "\\'") + '\',\'' + f.to.replace(/'/g, "\\'") + '\')">×</span>' +
      '</div>';
    }).join('');
}

function swDelFav(from, to) {
  var favs = swGetFavs().filter(function(f) { return !(f.from === from && f.to === to); });
  localStorage.setItem('swFavRoutes', JSON.stringify(favs));
  swLoadFavs();
}

function swQuick(from, to) {
  document.getElementById('swFrom').value = from;
  document.getElementById('swTo').value = to;
  swSearch();
}

// ===== 하차 알림 =====
function swSetAlarm() {
  if (!swResult || !swResult[swMode]) return;
  var r = swResult[swMode];
  var totalSec = r.totalTime;

  // 마지막 승차 구간 찾기
  var lastRideTime = 120;
  for (var i = r.segments.length - 1; i >= 0; i--) {
    if (!r.segments[i].isTransfer) { lastRideTime = r.segments[i].time; break; }
  }
  // 1정거장 전 = 총 시간 - 마지막 구간 시간
  var alarmSec = Math.max(totalSec - lastRideTime, 60);

  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
  }

  swClearAlarm();
  swAlarmTimer = setTimeout(function() {
    showToast('🔔 다음 역에서 내리세요!');
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('하차 준비', {
        body: swResult.to + '역 1정거장 전입니다!',
        icon: './logo.png',
        tag: 'sw-alarm'
      });
    }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
    swAlarmTimer = null;
    document.getElementById('swAlarmBar').classList.add('hidden');
  }, alarmSec * 1000);

  var min = Math.round(alarmSec / 60);
  showToast('🔔 약 ' + min + '분 후 하차 알림');

  // 알람 바 표시
  var bar = document.getElementById('swAlarmBar');
  bar.classList.remove('hidden');
  document.getElementById('swAlarmText').textContent =
    swResult.to + '역 하차 알림 · 약 ' + min + '분 후';
}

function swClearAlarm() {
  if (swAlarmTimer) { clearTimeout(swAlarmTimer); swAlarmTimer = null; }
  var bar = document.getElementById('swAlarmBar');
  if (bar) bar.classList.add('hidden');
}

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', swInitAC);

// ===== 전역 노출 =====
window.openSubway = openSubway;
window.closeSubway = closeSubway;
window.swSearch = swSearch;
window.swSwap = swSwap;
window.swSetMode = function(m) { swMode = m; swRender(); };
window.swPick = swPick;
window.swQuick = swQuick;
window.swSetAlarm = swSetAlarm;
window.swClearAlarm = swClearAlarm;
window.swDelFav = swDelFav;

})();
