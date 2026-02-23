// subway.js — 서울 지하철 경로 검색 (카카오지하철 스타일) v3
// 빠른환승, 환승도보, 이전·다음 열차, 호선배지, 실시간, 노선도
(function() {
'use strict';

// ===== 역명 자동완성용 전체 역 목록 =====
var _raw = '가능,가락시장,가산디지털단지,가양,가좌,가천대,간석,갈매,강남,강남구청,강동,강동구청,강변,강일,개봉,개롱,개포동,개화,개화산,거여,건대입구,검암,경마공원,경복궁,경찰병원,계양,고덕,고려대,고색,고속터미널,고잔,공덕,공릉,공항시장,공항화물청사,과천,관악,광교,광교중앙,광나루,광명사거리,광운대,광화문,광흥창,교대,구로,구로디지털단지,구룡,구반포,구산,구의,구일,구파발,국수,국회의사당,군자,군포,굽은다리,금곡,금정,금천구청,금촌,금호,길동,길음,김유정,김포공항,까치산,까치울,남구로,남동인더스파크,남부터미널,남성,남영,남춘천,남태령,남한산성입구,낙성대,내방,노들,노량진,노원,녹번,녹사평,녹양,녹천,논현,능곡,단대오거리,달월,답십리,당고개,당곡,당산,당정,대공원,대곡,대기,대림,대모산입구,대방,대성리,대야미,대청,대치,대화,대흥,덕계,덕소,덕정,도곡,도농,도림천,도봉,도봉산,도심,도원,도화,독립문,독바위,독산,돌곶이,동대문,동대문역사문화공원,동두천,동두천중앙,동묘앞,동암,동인천,동작,동천,두정,둔촌동,둔촌오륜,뚝섬,뚝섬유원지,디지털미디어시티,마곡,마곡나루,마두,마들,마석,마장,마천,마포,마포구청,망원,망우,망포,매교,매봉,매탄권선,먹골,면목,명동,명일,명학,모란,목동,몽촌토성,무악재,문래,문산,문정,미금,미사,미아,미아사거리,반월,반포,발산,방배,방이,방학,방화,배방,백마,백석,백운,백양리,범계,별내,별내별가람,보라매,보라매공원,보라매병원,보문,보산,보정,복정,봉명,봉은사,봉천,봉화산,부개,부천,부천시청,부천종합운동장,부평,불광,사가정,사당,사리,사릉,사평,산본,산성,삼각지,삼산체육관,삼성,삼성중앙,삼송,삼양,삼양사거리,삼전,상갈,상계,상도,상동,상록수,상봉,상수,상왕십리,상월곡,상일동,상현,상천,새절,샛강,서강대,서대문,서빙고,서울대벤처타운,서울대입구,서울숲,서울역,서울지방병무청,서원,서초,서현,석계,석남,석수,석촌,석촌고분,선릉,선바위,선유도,선정릉,성균관대,성복,성수,성신여대입구,세류,세마,소래포구,소사,소요산,솔밭공원,솔샘,송내,송도,송정,송파,송파나루,송탄,수내,수락산,수리산,수색,수원,수원시청,수진,수지구청,숙대입구,숭실대입구,신갈,신금호,신길,신길온천,신논현,신당,신답,신대방,신대방삼거리,신도림,신림,신목동,신방화,신반포,신설동,신용산,신이문,신정,신정네거리,신중동,신창,신촌,신풍,신흥,쌍문,쌍용,아산,아신,아차산,아현,안국,안산,안양,압구정,압구정로데오,약수,양수,양원,양재,양재시민의숲,양정,양천구청,양천향교,양평,어린이대공원,어천,언주,여의나루,여의도,역곡,역삼,역촌,연수,연신내,염창,영등포,영등포구청,영등포시장,영종,영통,예술회관,오금,오남,오류동,오목교,오목천,오빈,오산,오산대,오이도,온수,온양온천,올림픽공원,왕십리,외대앞,용답,용두,용마산,용문,용산,우장산,운길산,운서,운정,원당,원덕,원인재,원흥,월계,월곡,월곶,월드컵경기장,월롱,을지로3가,을지로4가,을지로입구,응봉,응암,의왕,의정부,이대,이매,이수,이촌,이태원,인천,인천공항1터미널,인천공항2터미널,인천논현,일산,일원,잠실,잠실나루,잠실새내,장승배기,장암,장지,장한평,죽전,중계,중곡,중동,중랑,중앙,중앙보훈병원,중화,증미,증산,지축,지행,지평,직산,진위,진접,창동,창신,천마산,천안,천왕,천호,철산,청구,청계산입구,청량리,청명,청평,청라국제도시,초지,총신대입구,충무로,충정로,춘의,춘천,태릉입구,태평,퇴계원,판교,팔당,평내호평,평촌,평택,평택지제,풍산,하남검단산,하남시청,하남풍산,하계,학동,학여울,한강진,한남,한대앞,한성대입구,한성백제,한양대,한티,합정,행당,행신,혜화,호구포,홍대입구,홍제,화곡,화랑대,화서,화전,화정,화계,회기,회룡,회현,효창공원앞,흑석,4·19민주묘지,북한산보국문,북한산우이,정릉,보라매공원,보라매병원,서울지방병무청,관악산';
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

// ===== 호선 약칭 (배지용) =====
var LS = {
  '1호선':'1','2호선':'2','3호선':'3','4호선':'4','5호선':'5',
  '6호선':'6','7호선':'7','8호선':'8','9호선':'9',
  '경의중앙선':'경의','공항철도':'공항','수인분당선':'수분',
  '신분당선':'신분','경춘선':'경춘','우이신설선':'우이','신림선':'신림','GTX-A':'GTX'
};

// ===== 호선 ID → 이름 매핑 (실시간 API용) =====
var LINE_ID = {
  '1001':'1호선','1002':'2호선','1003':'3호선','1004':'4호선','1005':'5호선',
  '1006':'6호선','1007':'7호선','1008':'8호선','1009':'9호선',
  '1063':'경의중앙선','1065':'공항철도','1067':'경춘선','1075':'수인분당선',
  '1077':'신분당선','1092':'우이신설선','1093':'신림선'
};

// ===== 노선도 데이터 (역 순서) =====
var LINES = [
  { name:'1호선', color:'#0052A4',
    stations:'소요산,동두천,보산,동두천중앙,덕정,덕계,양주,녹양,가능,의정부,회룡,망월사,도봉산,도봉,방학,창동,녹천,월계,광운대,석계,신이문,외대앞,회기,청량리,제기동,신설동,동묘앞,동대문,종로5가,종로3가,종각,시청,서울역,남영,용산,노량진,대방,신길,영등포,신도림,구로',
    branches:[
      {name:'인천',stations:'구일,개봉,오류동,온수,역곡,소사,부천,중동,송내,부개,부평,백운,동암,간석,주안,도화,제물포,도원,동인천,인천'},
      {name:'신창',stations:'가산디지털단지,독산,금천구청,석수,관악,안양,명학,금정,군포,당정,의왕,성균관대,화서,수원,세류,병점,세마,오산대,오산,진위,송탄,서정리,평택지제,평택,성환,직산,두정,천안,봉명,쌍용,아산,배방,온양온천,신창'}
    ]},
  { name:'2호선', color:'#009246', circular:true,
    stations:'시청,을지로입구,을지로3가,을지로4가,동대문역사문화공원,신당,상왕십리,왕십리,한양대,뚝섬,성수,건대입구,구의,강변,잠실나루,잠실,잠실새내,종합운동장,삼성,선릉,역삼,강남,교대,서초,방배,사당,낙성대,서울대입구,봉천,신림,신대방,구로디지털단지,대림,신도림,문래,영등포구청,당산,합정,홍대입구,신촌,이대,아현,충정로',
    branches:[
      {name:'성수지선',stations:'용답,신답,용두,신설동'},
      {name:'신정지선',stations:'도림천,양천구청,신정네거리,까치산'}
    ]},
  { name:'3호선', color:'#EF7C1C',
    stations:'대화,주엽,정발산,마두,백석,대곡,화정,원당,원흥,삼송,지축,구파발,연신내,불광,녹번,홍제,무악재,독립문,경복궁,안국,종로3가,을지로3가,충무로,동대입구,약수,금호,옥수,압구정,신사,잠원,고속터미널,교대,남부터미널,양재,매봉,도곡,대치,학여울,대청,일원,수서,가락시장,경찰병원,오금'},
  { name:'4호선', color:'#00A5DE',
    stations:'진접,오남,별내별가람,당고개,상계,노원,창동,쌍문,수유,미아,미아사거리,길음,성신여대입구,한성대입구,혜화,동대문,동대문역사문화공원,충무로,명동,회현,서울역,숙대입구,삼각지,신용산,이촌,동작,이수,사당,남태령,선바위,경마공원,대공원,과천,정부과천청사,인덕원,평촌,범계,금정,산본,수리산,대야미,반월,상록수,한대앞,중앙,고잔,초지,안산,신길온천,정왕,오이도'},
  { name:'5호선', color:'#996CAC',
    stations:'방화,개화산,김포공항,송정,마곡,발산,우장산,화곡,까치산,신정,목동,오목교,양평,영등포구청,영등포시장,신길,여의도,여의나루,마포,공덕,애오개,충정로,서대문,광화문,종로3가,을지로4가,동대문역사문화공원,청구,신금호,행당,왕십리,마장,답십리,장한평,군자,아차산,광나루,천호,강동',
    branches:[
      {name:'마천',stations:'둔촌동,올림픽공원,방이,오금,개롱,거여,마천'},
      {name:'하남',stations:'둔촌오륜,고덕,상일동,강일,미사,하남풍산,하남시청,하남검단산'}
    ]},
  { name:'6호선', color:'#CD7C2F',
    stations:'응암,역촌,불광,독바위,연신내,구산,새절,증산,디지털미디어시티,월드컵경기장,마포구청,망원,합정,상수,광흥창,대흥,공덕,효창공원앞,삼각지,녹사평,이태원,한강진,버티고개,약수,청구,신당,동묘앞,창신,보문,안암,고려대,월곡,상월곡,돌곶이,석계,태릉입구,화랑대,봉화산,신내'},
  { name:'7호선', color:'#747F00',
    stations:'장암,도봉산,수락산,마들,노원,중계,하계,공릉,태릉입구,먹골,중화,상봉,면목,사가정,용마산,중곡,군자,어린이대공원,건대입구,뚝섬유원지,청담,강남구청,학동,논현,반포,고속터미널,내방,이수,남성,총신대입구,숭실대입구,상도,장승배기,신대방삼거리,보라매,신풍,대림,남구로,가산디지털단지,철산,광명사거리,천왕,온수,까치울,부천종합운동장,춘의,신중동,부천시청,상동,삼산체육관,석남'},
  { name:'8호선', color:'#E6186C',
    stations:'암사,천호,강동구청,몽촌토성,잠실,석촌,송파,가락시장,문정,장지,복정,산성,남한산성입구,단대오거리,신흥,수진,모란'},
  { name:'9호선', color:'#BDB092',
    stations:'개화,김포공항,공항시장,신방화,마곡나루,양천향교,가양,증미,등촌,염창,신목동,선유도,당산,국회의사당,여의도,샛강,노량진,노들,흑석,동작,구반포,신반포,고속터미널,사평,신논현,언주,선정릉,삼성중앙,봉은사,종합운동장,삼전,석촌고분,석촌,송파나루,한성백제,올림픽공원,둔촌오륜,중앙보훈병원'},
  { name:'경의중앙선', color:'#77C4A3',
    stations:'문산,파주,월롱,금촌,금릉,운정,야당,탄현,일산,풍산,백마,곡산,대곡,능곡,행신,강매,화전,수색,디지털미디어시티,가좌,신촌,서강대,홍대입구,서울역,공덕,효창공원앞,용산,이촌,서빙고,한남,옥수,응봉,왕십리,청량리,회기,중랑,상봉,망우,양원,구리,도농,양정,덕소,도심,팔당,운길산,양수,신원,국수,아신,오빈,양평,원덕,용문,지평'},
  { name:'공항철도', color:'#0090D2',
    stations:'서울역,공덕,홍대입구,디지털미디어시티,김포공항,계양,검암,청라국제도시,영종,운서,인천공항1터미널,인천공항2터미널'},
  { name:'수인분당선', color:'#FABE00',
    stations:'청량리,왕십리,서울숲,압구정로데오,강남구청,선정릉,선릉,한티,도곡,구룡,개포동,대모산입구,수서,복정,가천대,태평,모란,야탑,이매,서현,수내,정자,미금,오리,죽전,보정,구성,신갈,기흥,상갈,청명,영통,망포,매탄권선,수원시청,매교,수원,고색,오목천,어천,야목,사리,달월,월곶,소래포구,인천논현,호구포,남동인더스파크,원인재,연수,송도'},
  { name:'신분당선', color:'#D4003B',
    stations:'신사,논현,신논현,강남,양재,양재시민의숲,청계산입구,판교,정자,미금,동천,수지구청,성복,상현,광교중앙,광교'},
  { name:'경춘선', color:'#0C8E72',
    stations:'청량리,회기,중랑,상봉,망우,갈매,별내,퇴계원,사릉,금곡,평내호평,천마산,마석,대성리,청평,상천,가평,굴봉산,백양리,강촌,김유정,남춘천,춘천'},
  { name:'우이신설선', color:'#B7C452',
    stations:'북한산우이,솔밭공원,4·19민주묘지,가오리,화계,삼양,삼양사거리,솔샘,북한산보국문,정릉,보문,신설동'},
  { name:'신림선', color:'#6789CA',
    stations:'샛강,대방,서울지방병무청,보라매,보라매공원,보라매병원,당곡,신림,서울대벤처타운,관악산'}
];

// ===== [v3] 역 → 호선 매핑 (자동완성 배지용) =====
var STN_LINES = {};
LINES.forEach(function(line) {
  function addStn(s) {
    if (!STN_LINES[s]) STN_LINES[s] = [];
    if (STN_LINES[s].indexOf(line.name) === -1) STN_LINES[s].push(line.name);
  }
  line.stations.split(',').forEach(addStn);
  if (line.branches) line.branches.forEach(function(b) { b.stations.split(',').forEach(addStn); });
});

// ===== [v3] 빠른 환승 데이터 (참고용 · 실제와 다를 수 있음) =====
// [칸번호, 문번호] — 환승역_출발호선_도착호선
var FT = {};
[
  ['신도림','1호선','2호선',4,2], ['신도림','2호선','1호선',5,3],
  ['사당','2호선','4호선',5,3], ['사당','4호선','2호선',4,1],
  ['교대','2호선','3호선',8,2], ['교대','3호선','2호선',3,4],
  ['잠실','2호선','8호선',6,3], ['잠실','8호선','2호선',4,1],
  ['건대입구','2호선','7호선',3,2], ['건대입구','7호선','2호선',6,3],
  ['왕십리','2호선','5호선',1,1], ['왕십리','5호선','2호선',7,3],
  ['왕십리','2호선','경의중앙선',1,1], ['왕십리','2호선','수인분당선',1,1],
  ['동대문역사문화공원','2호선','4호선',7,3], ['동대문역사문화공원','2호선','5호선',4,2],
  ['동대문역사문화공원','4호선','2호선',5,1], ['동대문역사문화공원','4호선','5호선',6,4],
  ['동대문역사문화공원','5호선','2호선',8,2], ['동대문역사문화공원','5호선','4호선',3,1],
  ['노원','4호선','7호선',8,4], ['노원','7호선','4호선',1,1],
  ['종로3가','1호선','3호선',7,3], ['종로3가','1호선','5호선',3,2],
  ['종로3가','3호선','1호선',5,2], ['종로3가','3호선','5호선',6,3],
  ['종로3가','5호선','1호선',7,1], ['종로3가','5호선','3호선',4,4],
  ['을지로3가','2호선','3호선',8,2], ['을지로3가','3호선','2호선',4,3],
  ['충무로','3호선','4호선',6,1], ['충무로','4호선','3호선',3,4],
  ['고속터미널','3호선','7호선',5,2], ['고속터미널','3호선','9호선',7,4],
  ['고속터미널','7호선','3호선',6,1], ['고속터미널','7호선','9호선',4,3],
  ['고속터미널','9호선','3호선',2,2], ['고속터미널','9호선','7호선',5,1],
  ['서울역','1호선','4호선',6,3], ['서울역','4호선','1호선',4,2],
  ['서울역','1호선','공항철도',6,3], ['서울역','4호선','공항철도',4,2],
  ['공덕','5호선','6호선',5,4], ['공덕','6호선','5호선',3,1],
  ['공덕','5호선','경의중앙선',1,1], ['공덕','6호선','경의중앙선',4,2],
  ['공덕','5호선','공항철도',1,1], ['공덕','경의중앙선','5호선',4,3],
  ['강남','2호선','신분당선',7,4], ['강남','신분당선','2호선',3,2],
  ['이수','4호선','7호선',5,2], ['이수','7호선','4호선',4,3],
  ['대림','2호선','7호선',4,2], ['대림','7호선','2호선',6,3],
  ['까치산','2호선','7호선',4,1], ['까치산','7호선','2호선',1,4],
  ['금정','1호선','4호선',7,2], ['금정','4호선','1호선',3,3],
  ['석계','1호선','6호선',2,2], ['석계','6호선','1호선',9,1],
  ['태릉입구','6호선','7호선',3,2], ['태릉입구','7호선','6호선',6,4],
  ['군자','5호선','7호선',4,3], ['군자','7호선','5호선',5,1],
  ['창동','1호선','4호선',6,2], ['창동','4호선','1호선',3,4],
  ['동작','4호선','9호선',7,1], ['동작','9호선','4호선',3,3],
  ['선릉','2호선','수인분당선',9,2], ['선릉','수인분당선','2호선',3,3],
  ['김포공항','5호선','9호선',5,3], ['김포공항','9호선','5호선',2,2],
  ['김포공항','5호선','공항철도',5,3], ['김포공항','9호선','공항철도',2,2],
  ['복정','8호선','수인분당선',4,2], ['복정','수인분당선','8호선',5,3],
  ['디지털미디어시티','6호선','경의중앙선',4,2], ['디지털미디어시티','경의중앙선','6호선',3,1],
  ['디지털미디어시티','6호선','공항철도',4,2], ['디지털미디어시티','공항철도','6호선',3,1],
  ['신도림','2호선','2호선',5,3], ['성수','2호선','2호선',3,2]
].forEach(function(e) { FT[e[0]+'_'+e[1]+'_'+e[2]] = [e[3],e[4]]; });

// ===== [v3] 환승 도보 시간 (분) =====
var TW = {
  '신도림':2,'사당':3,'교대':2,'동대문역사문화공원':4,'고속터미널':5,
  '왕십리':4,'서울역':6,'공덕':3,'강남':4,'노원':3,'종로3가':4,
  '을지로3가':2,'충무로':2,'잠실':3,'건대입구':3,'이수':3,'대림':2,
  '까치산':2,'금정':3,'석계':3,'태릉입구':3,'군자':3,'창동':4,
  '동작':3,'선릉':4,'김포공항':5,'복정':3,'디지털미디어시티':4
};

// ===== 상태 =====
var swActiveInput = null;
var swResult = null;
var swMode = 'duration';
var swAlarmTimer = null;
var swTimeMode = 'now';
var swDayType = 'auto'; // auto, weekday, saturday, holiday
var swTrainOpts = null; // {prev, current, next} for 이전·다음 열차
var swTrainIdx = 1; // 0=prev, 1=current, 2=next

// ===== 유틸 =====
function swToday() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function swNow() {
  var d = new Date();
  return swToday() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':00';
}

function swGetDateForDay(dayType) {
  if (dayType === 'auto') return swToday();
  var d = new Date();
  var dow = d.getDay();
  if (dayType === 'weekday') {
    if (dow === 0) d.setDate(d.getDate() + 1);
    else if (dow === 6) d.setDate(d.getDate() + 2);
  } else if (dayType === 'saturday') {
    while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  } else {
    while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  }
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function swGetTime() {
  if (swTimeMode === 'first') return swGetDateForDay(swDayType) + ' 05:30:00';
  if (swTimeMode === 'last') return swGetDateForDay(swDayType) + ' 23:50:00';
  if (swTimeMode === 'pick') {
    var h = document.getElementById('swHour');
    var m = document.getElementById('swMin');
    if (h && m) {
      return swGetDateForDay(swDayType) + ' ' + h.value + ':' + m.value + ':00';
    }
  }
  return swNow();
}

function swFmtTime(sec) {
  var m = Math.round(sec / 60);
  if (m >= 60) return Math.floor(m/60) + '시간 ' + (m%60) + '분';
  return m + '분';
}

function swLineColor(name) { return LC[name] || '#888'; }
function swLineShort(name) { return LS[name] || name.replace('호선','').replace('선',''); }

function swOffsetTime(datetime, minOffset) {
  var p = datetime.split(' ');
  var dp = p[0].split('-');
  var tp = (p[1] || '00:00:00').split(':');
  var d = new Date(+dp[0], +dp[1]-1, +dp[2], +tp[0], +tp[1], +tp[2]||0);
  d.setMinutes(d.getMinutes() + minOffset);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0') + ' ' +
    String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':00';
}

function swGetFT(station, fromLine, toLine) {
  var key = station + '_' + fromLine + '_' + toLine;
  var d = FT[key];
  return d ? { car: d[0], door: d[1] } : null;
}

// ===== API =====
function swRouteAPI(from, to, type) {
  var dt = swGetTime();
  var url = COMMUTE_PROXY + '/api/opendata/' + API_KEY + '/json/getShtrmPath/1/100/' +
    encodeURIComponent(from) + '/' + encodeURIComponent(to) + '/' + encodeURIComponent(dt);
  if (type) url += '/' + type;
  return fetch(url, { signal: AbortSignal.timeout(15000) }).then(function(r) { return r.json(); });
}

function swRouteWithTime(from, to, type, datetime) {
  var url = COMMUTE_PROXY + '/api/opendata/' + API_KEY + '/json/getShtrmPath/1/100/' +
    encodeURIComponent(from) + '/' + encodeURIComponent(to) + '/' + encodeURIComponent(datetime);
  if (type) url += '/' + type;
  return fetch(url, { signal: AbortSignal.timeout(15000) }).then(function(r) { return r.json(); });
}

function swRealtimeAPI(station) {
  var url = COMMUTE_PROXY + '/api/subway/' + API_KEY + '/json/realtimeStationArrival/0/30/' +
    encodeURIComponent(station);
  return fetch(url, { signal: AbortSignal.timeout(10000) }).then(function(r) { return r.json(); });
}

// ===== 파싱: 경로 =====
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

// ===== 파싱: 실시간 =====
function swParseRT(data) {
  if (!data || !data.realtimeArrivalList) return [];
  return data.realtimeArrivalList.map(function(a) {
    return {
      line: LINE_ID[a.subwayId] || a.subwayId,
      direction: a.updnLine || '',
      destination: a.trainLineNm || '',
      arrivalSec: +a.barvlDt || 0,
      arrivalMsg: a.arvlMsg2 || '',
      currentStn: a.arvlMsg3 || '',
      trainNo: a.btrainNo || '',
      trainType: a.btrainSttus || '일반',
      isLast: a.lstcarAt === '1'
    };
  }).sort(function(a, b) { return a.arrivalSec - b.arrivalSec; });
}

// ===== UI: 페이지 =====
function openSubway() {
  document.getElementById('subwayPage').classList.add('open');
  document.getElementById('tabBar').classList.add('hidden');
  swLoadFavs();
  swInitPicker();
}

function closeSubway() {
  document.getElementById('subwayPage').classList.remove('open');
  document.getElementById('tabBar').classList.remove('hidden');
  swClearAlarm();
  swCloseMap();
  swCloseRT();
}

// ===== UI: 시간 선택 =====
function swSetTime(mode) {
  swTimeMode = mode;
  ['swTimeNow','swTimeFirst','swTimeLast','swTimePick'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  var map = { now:'swTimeNow', first:'swTimeFirst', last:'swTimeLast', pick:'swTimePick' };
  var btn = document.getElementById(map[mode]);
  if (btn) btn.classList.add('active');

  var panel = document.getElementById('swPickerPanel');
  if (mode === 'pick') {
    panel.classList.remove('hidden');
  } else {
    panel.classList.add('hidden');
  }
}

function swSetDay(type, el) {
  swDayType = type;
  var btns = document.querySelectorAll('.sw-day-btn');
  btns.forEach(function(b) { b.classList.remove('active'); });
  if (el) el.classList.add('active');
}

function swInitPicker() {
  var hSel = document.getElementById('swHour');
  var mSel = document.getElementById('swMin');
  if (!hSel || hSel.options.length > 0) return;

  for (var h = 5; h <= 23; h++) {
    var opt = document.createElement('option');
    opt.value = String(h).padStart(2,'0');
    opt.textContent = String(h).padStart(2,'0');
    hSel.appendChild(opt);
  }
  for (var m = 0; m < 60; m += 5) {
    var opt2 = document.createElement('option');
    opt2.value = String(m).padStart(2,'0');
    opt2.textContent = String(m).padStart(2,'0');
    mSel.appendChild(opt2);
  }
  // 현재 시간으로 초기화
  var now = new Date();
  hSel.value = String(now.getHours()).padStart(2,'0');
  var roundMin = Math.round(now.getMinutes() / 5) * 5;
  if (roundMin >= 60) roundMin = 55;
  mSel.value = String(roundMin).padStart(2,'0');
}

// ===== UI: 검색 =====
function swSearch() {
  var f = document.getElementById('swFrom').value.trim();
  var t = document.getElementById('swTo').value.trim();
  if (!f || !t) { showToast('출발역과 도착역을 입력하세요'); return; }
  if (f === t) { showToast('출발역과 도착역이 같습니다'); return; }

  var el = document.getElementById('swResults');
  el.innerHTML = '<div class="sw-loading"><div class="sw-spinner"></div>경로 검색 중...</div>';
  swTrainOpts = null;
  swTrainIdx = 1;

  Promise.all([
    swRouteAPI(f, t, 'duration'),
    swRouteAPI(f, t, 'transfer'),
    swRouteAPI(f, t, 'distance')
  ]).then(function(res) {
    var dur = swParse(res[0]);
    var trf = swParse(res[1]);
    var dist = swParse(res[2]);
    if (!dur && !trf && !dist) {
      el.innerHTML = '<div class="sw-empty">경로를 찾을 수 없습니다<br><small>역 이름을 확인해주세요 (예: 답십리, 강남)</small></div>';
      return;
    }
    swResult = { duration: dur, transfer: trf, distance: dist, from: f, to: t };
    swMode = dur ? 'duration' : (trf ? 'transfer' : 'distance');
    swRender();
    swSaveFav(f, t);
    document.getElementById('swFavs').classList.add('hidden');

    // 백그라운드: 이전·다음 열차 조회
    swFetchTrains(f, t);
  }).catch(function() {
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

// ===== [v3] 이전·다음 열차 =====
function swFetchTrains(from, to) {
  var r = swResult ? swResult[swMode] : null;
  if (!r || !r.segments) return;

  // 현재 결과의 출발 시각 추출
  var deptTime = null;
  for (var i = 0; i < r.segments.length; i++) {
    if (!r.segments[i].isTransfer && r.segments[i].departsAt) {
      deptTime = r.segments[i].departsAt;
      break;
    }
  }
  if (!deptTime) return;

  var baseDate = swGetTime().split(' ')[0];
  if (deptTime.length === 5) deptTime += ':00';
  var baseDT = baseDate + ' ' + deptTime;

  var prevDT = swOffsetTime(baseDT, -15);
  var nextDT = swOffsetTime(baseDT, 5);

  Promise.all([
    swRouteWithTime(from, to, swMode, prevDT),
    swRouteWithTime(from, to, swMode, nextDT)
  ]).then(function(res) {
    var prev = swParse(res[0]);
    var next = swParse(res[1]);
    if (!prev && !next) return;

    // 현재 열차의 출발 시각
    var curDept = swGetDeptTime(r);

    // 이전/다음 열차 출발 시각 확인 (중복 제거)
    var prevDept = prev ? swGetDeptTime(prev) : null;
    var nextDept = next ? swGetDeptTime(next) : null;

    if (prevDept === curDept) prev = null;
    if (nextDept === curDept) next = null;
    if (prevDept && nextDept && prevDept === nextDept) next = null;

    if (!prev && !next) return;

    swTrainOpts = {
      prev: prev,
      current: r,
      next: next,
      prevDept: prevDept,
      curDept: curDept,
      nextDept: nextDept
    };
    swTrainIdx = 1;
    swRenderTrainSel();
  }).catch(function() { /* 실패해도 기존 결과는 유지 */ });
}

function swGetDeptTime(result) {
  if (!result || !result.segments) return '';
  for (var i = 0; i < result.segments.length; i++) {
    if (!result.segments[i].isTransfer && result.segments[i].departsAt) {
      return result.segments[i].departsAt.substring(0, 5);
    }
  }
  return '';
}

function swSelectTrain(idx) {
  if (!swTrainOpts) return;
  swTrainIdx = idx;
  var trains = [swTrainOpts.prev, swTrainOpts.current, swTrainOpts.next];
  var selected = trains[idx];
  if (!selected) return;

  // 현재 모드 결과 교체
  swResult[swMode] = selected;
  swRender();
  swRenderTrainSel();
}

function swRenderTrainSel() {
  var container = document.getElementById('swTrainSel');
  if (!container || !swTrainOpts) { if (container) container.classList.add('hidden'); return; }

  var trains = [
    { r: swTrainOpts.prev, dept: swTrainOpts.prevDept, label: '이전' },
    { r: swTrainOpts.current, dept: swTrainOpts.curDept, label: '이 열차' },
    { r: swTrainOpts.next, dept: swTrainOpts.nextDept, label: '다음' }
  ];

  var html = '';
  trains.forEach(function(t, i) {
    if (!t.r) return;
    var active = i === swTrainIdx ? ' active' : '';
    var timeStr = t.r ? swFmtTime(t.r.totalTime) : '';
    html += '<button class="sw-ts-btn' + active + '" type="button" onclick="swSelectTrain(' + i + ')">' +
      '<div class="sw-ts-label">' + t.label + '</div>' +
      '<div class="sw-ts-time">' + (t.dept || '') + '</div>' +
      '<div class="sw-ts-dur">' + timeStr + '</div>' +
    '</button>';
  });

  container.innerHTML = html;
  container.classList.remove('hidden');
}

// ===== UI: 결과 렌더링 =====
function swRender() {
  var el = document.getElementById('swResults');
  var r = swResult ? swResult[swMode] : null;
  if (!r) {
    var modes = ['duration','transfer','distance'];
    for (var i = 0; i < modes.length; i++) {
      if (swResult && swResult[modes[i]]) { swMode = modes[i]; r = swResult[swMode]; break; }
    }
    if (!r) { el.innerHTML = '<div class="sw-empty">경로 정보 없음</div>'; return; }
  }

  var timeStr = swFmtTime(r.totalTime);
  var distKm = (r.totalDist / 1000).toFixed(1);

  var firstSeg = null, lastSeg = null;
  for (var j = 0; j < r.segments.length; j++) {
    if (!r.segments[j].isTransfer && r.segments[j].departsAt && !firstSeg) firstSeg = r.segments[j];
  }
  for (var k = r.segments.length - 1; k >= 0; k--) {
    if (!r.segments[k].isTransfer && r.segments[k].arrivesAt) { lastSeg = r.segments[k]; break; }
  }
  var deptTime = firstSeg ? firstSeg.departsAt.substring(0, 5) : '';
  var arrvTime = lastSeg ? lastSeg.arrivesAt.substring(0, 5) : '';

  var timeLabel = '';
  if (swTimeMode === 'first') timeLabel = '<span class="sw-time-label">첫차</span>';
  else if (swTimeMode === 'last') timeLabel = '<span class="sw-time-label">막차</span>';

  // 탭
  var html = '<div class="sw-tabs">';
  if (swResult.duration) html += '<button class="sw-tab' + (swMode === 'duration' ? ' active' : '') + '" type="button" onclick="swSetMode(\'duration\')">최단시간</button>';
  if (swResult.transfer) html += '<button class="sw-tab' + (swMode === 'transfer' ? ' active' : '') + '" type="button" onclick="swSetMode(\'transfer\')">최소환승</button>';
  if (swResult.distance) html += '<button class="sw-tab' + (swMode === 'distance' ? ' active' : '') + '" type="button" onclick="swSetMode(\'distance\')">최단거리</button>';
  html += '</div>';

  // 이전·다음 열차 셀렉터
  html += '<div class="sw-train-sel hidden" id="swTrainSel"></div>';

  // 요약
  html += '<div class="sw-summary">' +
    '<div class="sw-summary-top">' + timeLabel +
      '<span class="sw-summary-time">' + timeStr + '</span>' +
    '</div>' +
    '<div class="sw-summary-info">환승 ' + r.transfers + '회 | 카드 ' + r.totalFare.toLocaleString() + '원 | ' + distKm + 'km</div>' +
  '</div>' +
  '<div class="sw-time-bar">' +
    '<div class="sw-time-pill">출발 ' + deptTime + '</div>' +
    '<div class="sw-time-pill">도착 ' + arrvTime + '</div>' +
  '</div>' +
  '<div class="sw-timeline">' + swRenderTimeline(r) + '</div>' +
  '<div class="sw-actions">' +
    '<button class="sw-alarm-btn" type="button" onclick="swSetAlarm()">🔔 하차 알림</button>' +
    '<button class="sw-rt-btn" type="button" onclick="swShowRT(\'' + (swResult.from || '').replace(/'/g,"\\'") + '\')">📡 실시간 도착</button>' +
  '</div>';

  el.innerHTML = html;

  // 이전·다음 열차 렌더링
  if (swTrainOpts) swRenderTrainSel();
}

// ===== 타임라인 (빠른 환승 + 도보 시간 포함) =====
function swRenderTimeline(r) {
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
  groups.forEach(function(g, idx) {
    if (g.type === 'transfer') {
      // 환승: 앞뒤 ride 그룹에서 호선 정보 가져오기
      var prevRide = null, nextRide = null;
      for (var pi = idx - 1; pi >= 0; pi--) { if (groups[pi].type === 'ride') { prevRide = groups[pi]; break; } }
      for (var ni = idx + 1; ni < groups.length; ni++) { if (groups[ni].type === 'ride') { nextRide = groups[ni]; break; } }

      var fromLine = prevRide ? prevRide.line : '';
      var toLine = nextRide ? nextRide.line : '';
      var tStation = g.seg.to.name || g.seg.from.name;

      // 빠른 환승 조회
      var ft = swGetFT(tStation, fromLine, toLine);
      var walkMin = TW[tStation] || 0;
      var waitMin = Math.ceil(g.seg.wait / 60);

      html += '<div class="sw-tl-transfer">' +
        '<div class="sw-tl-transfer-dot">⇄</div>' +
        '<div class="sw-tl-transfer-info">' +
          '<div class="sw-tl-transfer-text">' + (toLine || '') + ' 환승' +
            (walkMin > 0 ? '<span class="sw-tl-walk"> · 도보 ' + walkMin + '분</span>' : '') +
            (waitMin > 0 ? '<span class="sw-tl-wait"> · 대기 ' + waitMin + '분</span>' : '') +
          '</div>' +
          (ft ? '<div class="sw-tl-ft">빠른 환승 <strong>' + ft.car + '-' + ft.door + '</strong> <span class="sw-tl-ft-sub">(참고)</span></div>' : '') +
        '</div>' +
      '</div>';
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
      var lineShort = swLineShort(g.line);

      html += '<div class="sw-tl-segment">' +
        '<div class="sw-tl-line-col">' +
          '<div class="sw-tl-dot-big" style="background:' + color + '"></div>' +
          '<div class="sw-tl-bar" style="background:' + color + '"></div>' +
          (midStations.length > 0 ? '<div class="sw-tl-bar" style="background:' + color + '"></div>' : '') +
          '<div class="sw-tl-dot-big" style="background:' + color + '"></div>' +
        '</div>' +
        '<div class="sw-tl-content">' +
          '<div class="sw-tl-station first" onclick="swShowRT(\'' + first.replace(/'/g,"\\'") + '\')">' +
            '<div class="sw-tl-time">' + deptStr + '</div>' +
            '<div class="sw-tl-name">' + first + ' <small class="sw-tl-rt-hint">실시간▸</small></div>' +
            '<div class="sw-tl-badge" style="background:' + color + '">' + lineShort + '</div>' +
          '</div>' +
          '<div class="sw-tl-detail">' + termDir + (g.trainNo ? ' · ' + g.trainNo : '') +
            (g.direction ? ' · ' + g.direction : '') +
          '</div>' +
          (midStations.length > 0 ?
            '<div class="sw-tl-middle" onclick="this.classList.toggle(\'expanded\')">' +
              '<span class="sw-tl-middle-summary">' + midStations.length + '개역 (' + rideMin + '분) ▾</span>' +
              '<div class="sw-tl-middle-list">' +
                midStations.map(function(s, si) {
                  var t = g.times[si + 1] ? g.times[si + 1].substring(0, 5) : '';
                  return '<div class="sw-tl-mid-row" onclick="event.stopPropagation();swShowRT(\'' + s.replace(/'/g,"\\'") + '\')"><span class="sw-tl-mid-time">' + t + '</span><span class="sw-tl-mid-dot" style="background:' + color + '"></span>' + s + '</div>';
                }).join('') +
              '</div>' +
            '</div>'
          : '') +
          '<div class="sw-tl-station last" onclick="swShowRT(\'' + last.replace(/'/g,"\\'") + '\')">' +
            '<div class="sw-tl-time">' + arrvStr + '</div>' +
            '<div class="sw-tl-name">' + last + ' <small class="sw-tl-rt-hint">실시간▸</small></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
  });

  return html;
}

// ===== 자동완성 (호선 배지 포함) =====
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
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.sw-search-area') && !e.target.closest('.sw-ac')) swHideAC();
  });
}

function swShowAC(list) {
  var el = document.getElementById('swAC');
  if (!el || list.length === 0) { swHideAC(); return; }
  el.innerHTML = list.map(function(s) {
    var badges = '';
    var lines = STN_LINES[s];
    if (lines && lines.length > 0) {
      badges = '<span class="sw-ac-badges">' + lines.map(function(l) {
        return '<span class="sw-ac-badge" style="background:' + swLineColor(l) + '">' + swLineShort(l) + '</span>';
      }).join('') + '</span>';
    }
    return '<div class="sw-ac-item" onmousedown="swPick(\'' + s.replace(/'/g, "\\'") + '\')">' +
      '<span class="sw-ac-name">' + s + '</span>' + badges +
    '</div>';
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
  favs = favs.filter(function(f) { return !(f.from === from && f.to === to); });
  favs.unshift({ from: from, to: to });
  if (favs.length > 10) favs.pop();
  localStorage.setItem('swFavRoutes', JSON.stringify(favs));
}

function swLoadFavs() {
  var el = document.getElementById('swFavs');
  if (!el) return;
  el.classList.remove('hidden');
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

// ===== 실시간 도착정보 =====
function swShowRT(station) {
  if (!station) return;
  var panel = document.getElementById('swRealtime');
  var list = document.getElementById('swRTList');
  panel.classList.remove('hidden');
  document.getElementById('swRTStation').textContent = station;
  list.innerHTML = '<div class="sw-loading"><div class="sw-spinner"></div>실시간 정보 조회 중...</div>';

  swRealtimeAPI(station).then(function(data) {
    var trains = swParseRT(data);
    if (trains.length === 0) {
      list.innerHTML = '<div class="sw-rt-empty">도착 예정 열차가 없습니다<br><small>운행 시간을 확인해주세요</small></div>';
      return;
    }
    var byDir = {};
    trains.forEach(function(t) {
      var key = t.line + ' ' + t.direction;
      if (!byDir[key]) byDir[key] = { line: t.line, direction: t.direction, trains: [] };
      byDir[key].trains.push(t);
    });

    var html = '';
    Object.keys(byDir).forEach(function(key) {
      var g = byDir[key];
      var color = swLineColor(g.line);
      html += '<div class="sw-rt-group">' +
        '<div class="sw-rt-group-header">' +
          '<span class="sw-rt-line-badge" style="background:' + color + '">' + g.line + '</span>' +
          '<span class="sw-rt-dir">' + g.direction + '</span>' +
        '</div>';
      g.trains.slice(0, 3).forEach(function(t) {
        var secStr = t.arrivalSec > 0 ? Math.ceil(t.arrivalSec / 60) + '분' : '';
        html += '<div class="sw-rt-train">' +
          '<div class="sw-rt-dest">' + t.destination +
            (t.trainType !== '일반' ? ' <span class="sw-rt-express">' + t.trainType + '</span>' : '') +
          '</div>' +
          '<div class="sw-rt-msg">' + t.arrivalMsg +
            (secStr ? ' <span class="sw-rt-sec">(' + secStr + ')</span>' : '') +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    });
    list.innerHTML = html;
  }).catch(function() {
    list.innerHTML = '<div class="sw-rt-empty">실시간 정보를 불러올 수 없습니다</div>';
  });
}

function swCloseRT() {
  var panel = document.getElementById('swRealtime');
  if (panel) panel.classList.add('hidden');
}

// ===== 노선도 (라인 브라우저) =====
function swOpenMap() {
  var overlay = document.getElementById('swMapOverlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('open');
  swRenderLines();
}

function swCloseMap() {
  var overlay = document.getElementById('swMapOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.classList.add('hidden');
  }
  var stns = document.getElementById('swMapStations');
  if (stns) stns.classList.add('hidden');
}

function swRenderLines() {
  var el = document.getElementById('swMapLines');
  if (!el) return;
  el.innerHTML = LINES.map(function(line) {
    var count = line.stations.split(',').length;
    if (line.branches) line.branches.forEach(function(b) { count += b.stations.split(',').length; });
    return '<div class="sw-ml-item" onclick="swShowLine(\'' + line.name + '\')">' +
      '<div class="sw-ml-color" style="background:' + line.color + '"></div>' +
      '<div class="sw-ml-info">' +
        '<div class="sw-ml-name">' + line.name + '</div>' +
        '<div class="sw-ml-count">' + count + '개역</div>' +
      '</div>' +
      '<div class="sw-ml-arrow">›</div>' +
    '</div>';
  }).join('');
}

function swShowLine(lineName) {
  var line = LINES.find(function(l) { return l.name === lineName; });
  if (!line) return;
  var stns = document.getElementById('swMapStations');
  var linesEl = document.getElementById('swMapLines');
  linesEl.classList.add('hidden');
  stns.classList.remove('hidden');

  var stations = line.stations.split(',');
  var html = '<div class="sw-ms-header">' +
    '<button class="sw-ms-back" type="button" onclick="swBackToLines()">← 노선 목록</button>' +
    '<div class="sw-ms-title" style="color:' + line.color + '">' + line.name +
      (line.circular ? ' (순환)' : '') + '</div>' +
  '</div>' +
  '<div class="sw-ms-list">';

  stations.forEach(function(s, i) {
    html += swStationRow(s, line.color, i === 0, i === stations.length - 1 && !line.branches, line.name);
  });

  if (line.branches) {
    line.branches.forEach(function(branch) {
      html += '<div class="sw-ms-branch-label">' + branch.name + ' 방면</div>';
      var bs = branch.stations.split(',');
      bs.forEach(function(s, i) {
        html += swStationRow(s, line.color, false, i === bs.length - 1, line.name);
      });
    });
  }

  html += '</div>';
  stns.innerHTML = html;
  stns.scrollTop = 0;
}

function swStationRow(name, color, isFirst, isLast, lineName) {
  // 환승 가능 노선 배지
  var transferBadges = '';
  var lines = STN_LINES[name];
  if (lines && lines.length > 1) {
    transferBadges = '<div class="sw-ms-transfers">' +
      lines.filter(function(l) { return l !== lineName; }).map(function(l) {
        return '<span class="sw-ms-tbadge" style="background:' + swLineColor(l) + '">' + swLineShort(l) + '</span>';
      }).join('') + '</div>';
  }

  return '<div class="sw-ms-row" onclick="swPickStn(\'' + name.replace(/'/g, "\\'") + '\')">' +
    '<div class="sw-ms-dot-col">' +
      (isFirst ? '' : '<div class="sw-ms-bar-top" style="background:' + color + '"></div>') +
      '<div class="sw-ms-dot" style="border-color:' + color + '"></div>' +
      (isLast ? '' : '<div class="sw-ms-bar-btm" style="background:' + color + '"></div>') +
    '</div>' +
    '<div class="sw-ms-name">' + name + transferBadges + '</div>' +
    '<div class="sw-ms-btns">' +
      '<button class="sw-ms-btn" type="button" onclick="event.stopPropagation();swSetStn(\'swFrom\',\'' + name.replace(/'/g, "\\'") + '\')">출발</button>' +
      '<button class="sw-ms-btn" type="button" onclick="event.stopPropagation();swSetStn(\'swTo\',\'' + name.replace(/'/g, "\\'") + '\')">도착</button>' +
      '<button class="sw-ms-btn rt" type="button" onclick="event.stopPropagation();swShowRT(\'' + name.replace(/'/g, "\\'") + '\')">실시간</button>' +
    '</div>' +
  '</div>';
}

function swBackToLines() {
  document.getElementById('swMapLines').classList.remove('hidden');
  document.getElementById('swMapStations').classList.add('hidden');
}

function swSetStn(inputId, name) {
  document.getElementById(inputId).value = name;
  showToast((inputId === 'swFrom' ? '출발' : '도착') + ': ' + name);
}

function swPickStn(name) {
  var f = document.getElementById('swFrom');
  var t = document.getElementById('swTo');
  if (!f.value) {
    f.value = name;
    showToast('출발: ' + name);
  } else if (!t.value) {
    t.value = name;
    showToast('도착: ' + name);
    swCloseMap();
  } else {
    f.value = name;
    showToast('출발: ' + name);
  }
}

// ===== 하차 알림 =====
function swSetAlarm() {
  if (!swResult || !swResult[swMode]) return;
  var r = swResult[swMode];
  var totalSec = r.totalTime;

  var lastRideTime = 120;
  for (var i = r.segments.length - 1; i >= 0; i--) {
    if (!r.segments[i].isTransfer) { lastRideTime = r.segments[i].time; break; }
  }
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
window.swSetMode = function(m) { swMode = m; swTrainOpts = null; swTrainIdx = 1; swRender(); if (swResult) swFetchTrains(swResult.from, swResult.to); };
window.swSetTime = swSetTime;
window.swSetDay = swSetDay;
window.swPick = swPick;
window.swQuick = swQuick;
window.swSetAlarm = swSetAlarm;
window.swClearAlarm = swClearAlarm;
window.swDelFav = swDelFav;
window.swShowRT = swShowRT;
window.swCloseRT = swCloseRT;
window.swOpenMap = swOpenMap;
window.swCloseMap = swCloseMap;
window.swShowLine = swShowLine;
window.swBackToLines = swBackToLines;
window.swSetStn = swSetStn;
window.swPickStn = swPickStn;
window.swSelectTrain = swSelectTrain;

})();
