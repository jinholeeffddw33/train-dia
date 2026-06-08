/**
 * 답십리 사업소 좌표 고정 날씨 조회 — Open-Meteo (무료, 키 불필요).
 */

const SABUNSO_LAT = 37.566;
const SABUNSO_LON = 127.058;

const WEATHER_CODE_KO: Record<number, { label: string; emoji: string }> = {
  0:  { label: '맑음', emoji: '☀️' },
  1:  { label: '대체로 맑음', emoji: '🌤️' },
  2:  { label: '구름 조금', emoji: '⛅' },
  3:  { label: '흐림', emoji: '☁️' },
  45: { label: '안개', emoji: '🌫️' },
  48: { label: '서리 안개', emoji: '🌫️' },
  51: { label: '약한 이슬비', emoji: '🌦️' },
  53: { label: '이슬비', emoji: '🌦️' },
  55: { label: '강한 이슬비', emoji: '🌧️' },
  61: { label: '약한 비', emoji: '🌦️' },
  63: { label: '비', emoji: '🌧️' },
  65: { label: '강한 비', emoji: '🌧️' },
  71: { label: '약한 눈', emoji: '🌨️' },
  73: { label: '눈', emoji: '🌨️' },
  75: { label: '강한 눈', emoji: '❄️' },
  80: { label: '소나기', emoji: '🌦️' },
  81: { label: '강한 소나기', emoji: '🌧️' },
  82: { label: '폭우', emoji: '⛈️' },
  95: { label: '뇌우', emoji: '⛈️' },
  96: { label: '뇌우+우박', emoji: '⛈️' },
};

function codeMeta(code: number) {
  return WEATHER_CODE_KO[code] || { label: '알 수 없음', emoji: '🌤️' };
}

export interface WeatherNow {
  temp: number;
  feels: number;
  code: number;
  windSpeed: number;
  humidity: number;
}

export interface WeatherDay {
  date: string; // YYYY-MM-DD
  code: number;
  tempMax: number;
  tempMin: number;
  rainProb: number;
}

export interface WeatherSummary {
  now: WeatherNow;
  today: WeatherDay;
  tomorrow: WeatherDay;
  week: WeatherDay[];
}

let cache: { ts: number; data: WeatherSummary } | null = null;
const CACHE_MS = 10 * 60 * 1000; // 10분

export async function fetchWeather(): Promise<WeatherSummary> {
  if (cache && Date.now() - cache.ts < CACHE_MS) return cache.data;
  const url = `https://api.open-meteo.com/v1/forecast`
    + `?latitude=${SABUNSO_LAT}&longitude=${SABUNSO_LON}`
    + `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max`
    + `&timezone=Asia%2FSeoul&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('날씨 조회 실패');
  const j = await res.json() as {
    current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number };
    daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[] };
  };
  const now: WeatherNow = {
    temp: Math.round(j.current.temperature_2m),
    feels: Math.round(j.current.apparent_temperature),
    code: j.current.weather_code,
    windSpeed: Math.round(j.current.wind_speed_10m),
    humidity: Math.round(j.current.relative_humidity_2m),
  };
  const dayAt = (i: number): WeatherDay => ({
    date: j.daily.time[i],
    code: j.daily.weather_code[i],
    tempMax: Math.round(j.daily.temperature_2m_max[i]),
    tempMin: Math.round(j.daily.temperature_2m_min[i]),
    rainProb: j.daily.precipitation_probability_max[i] ?? 0,
  });
  const summary: WeatherSummary = {
    now,
    today: dayAt(0),
    tomorrow: dayAt(1),
    week: j.daily.time.map((_, i) => dayAt(i)),
  };
  cache = { ts: Date.now(), data: summary };
  return summary;
}

export function formatWeatherNow(w: WeatherSummary): string {
  const m = codeMeta(w.now.code);
  return `${m.emoji} 답십리 지금 ${m.label}, ${w.now.temp}°C (체감 ${w.now.feels}°C) · 습도 ${w.now.humidity}%`;
}

export function formatWeatherToday(w: WeatherSummary): string {
  const m = codeMeta(w.today.code);
  const rainNote = w.today.rainProb >= 50 ? ' ☂️ 우산 챙기세요' : w.today.rainProb >= 20 ? ' (강수확률 살짝 있음)' : '';
  return `${m.emoji} 답십리 오늘 ${m.label}, ${w.today.tempMin}~${w.today.tempMax}°C · 강수확률 ${w.today.rainProb}%${rainNote}`;
}

export function formatWeatherTomorrow(w: WeatherSummary): string {
  const m = codeMeta(w.tomorrow.code);
  const rainNote = w.tomorrow.rainProb >= 50 ? ' ☂️ 우산 챙기세요' : '';
  return `${m.emoji} 내일 답십리 ${m.label}, ${w.tomorrow.tempMin}~${w.tomorrow.tempMax}°C · 강수확률 ${w.tomorrow.rainProb}%${rainNote}`;
}

export function formatWeatherWeek(w: WeatherSummary): string {
  const dows = ['일', '월', '화', '수', '목', '금', '토'];
  const lines = w.week.slice(0, 7).map((d) => {
    const m = codeMeta(d.code);
    const date = new Date(d.date);
    const dow = dows[date.getDay()];
    return `· ${date.getMonth() + 1}/${date.getDate()}(${dow}) ${m.emoji} ${d.tempMin}~${d.tempMax}°C · 강수 ${d.rainProb}%`;
  });
  return `📅 답십리 7일 예보\n${lines.join('\n')}`;
}

export function formatRainAnswer(w: WeatherSummary, when: 'today' | 'tomorrow'): string {
  const d = when === 'today' ? w.today : w.tomorrow;
  const m = codeMeta(d.code);
  const label = when === 'today' ? '오늘' : '내일';
  if (d.rainProb >= 60) return `🌧️ ${label} 비 올 가능성 높아요 (${d.rainProb}%). ${m.label} 예보 · 우산 챙기세요`;
  if (d.rainProb >= 30) return `🌦️ ${label} 비 올 수도 있어요 (${d.rainProb}%). ${m.label}`;
  return `☀️ ${label} 비 안 와요 (${d.rainProb}%). ${m.label}`;
}
