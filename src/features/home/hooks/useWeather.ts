'use client';

import { useState, useEffect } from 'react';

export interface WeatherData {
  condition: string;
  icon: string;
  temp: number;
  /** 오늘 최대 강수확률 (%) */
  precipProb: number;
  /** 초미세먼지 PM2.5 (㎍/㎥) */
  pm25: number | null;
  /** 미세먼지 PM10 (㎍/㎥) */
  pm10: number | null;
  /** 미세먼지 등급 (PM2.5 기준 한국 환경부) */
  dustLevel: 'good' | 'moderate' | 'bad' | 'very-bad' | null;
  dustLabel: string | null;
}

export function parseWeatherCode(code: number): { condition: string; icon: string } {
  if (code === 0 || code === 1) return { condition: '맑음', icon: '☀️' };
  if (code <= 3) return { condition: '구름 많음', icon: '⛅' };
  if (code <= 48) return { condition: '흐림', icon: '🌥️' };
  if (code <= 67) return { condition: '비', icon: '🌧️' };
  if (code <= 77) return { condition: '눈', icon: '🌨️' };
  if (code <= 82) return { condition: '소나기', icon: '🌦️' };
  if (code <= 99) return { condition: '뇌우', icon: '⛈️' };
  return { condition: '흐림', icon: '🌥️' };
}

// 한국 환경부 PM2.5 등급 기준 (㎍/㎥)
function parseDustLevel(pm25: number | null): { level: WeatherData['dustLevel']; label: string | null } {
  if (pm25 === null) return { level: null, label: null };
  if (pm25 <= 15) return { level: 'good', label: '좋음' };
  if (pm25 <= 35) return { level: 'moderate', label: '보통' };
  if (pm25 <= 75) return { level: 'bad', label: '나쁨' };
  return { level: 'very-bad', label: '매우 나쁨' };
}

const SEOUL_LAT = 37.5665;
const SEOUL_LNG = 126.9780;
const CACHE_KEY = 'dia.weather.seoul';
const CACHE_TTL = 30 * 60 * 1000;

interface CachedWeather {
  t: number;
  data: WeatherData;
}

export function useSeoulWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed: CachedWeather = JSON.parse(raw);
      if (Date.now() - parsed.t < CACHE_TTL) return parsed.data;
    } catch {
      // ignore
    }
    return null;
  });

  useEffect(() => {
    let aborted = false;

    async function fetchWeather() {
      try {
        const raw = window.localStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed: CachedWeather = JSON.parse(raw);
          if (Date.now() - parsed.t < CACHE_TTL) return;
        }
      } catch {
        // ignore cache parse errors
      }

      try {
        const [forecastRes, airRes] = await Promise.all([
          fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${SEOUL_LAT}&longitude=${SEOUL_LNG}&current=temperature_2m,weather_code&daily=precipitation_probability_max&timezone=Asia/Seoul&forecast_days=1`
          ),
          fetch(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${SEOUL_LAT}&longitude=${SEOUL_LNG}&current=pm10,pm2_5&timezone=Asia/Seoul`
          ),
        ]);
        if (aborted) return;
        if (!forecastRes.ok) return;

        const forecast = await forecastRes.json();
        const current = forecast.current;
        const daily = forecast.daily;
        const { condition, icon } = parseWeatherCode(current.weather_code);

        let pm25: number | null = null;
        let pm10: number | null = null;
        if (airRes.ok) {
          try {
            const air = await airRes.json();
            pm25 = air?.current?.pm2_5 ?? null;
            pm10 = air?.current?.pm10 ?? null;
            if (pm25 !== null) pm25 = Math.round(pm25);
            if (pm10 !== null) pm10 = Math.round(pm10);
          } catch {
            // ignore air-quality parse errors
          }
        }

        const { level, label } = parseDustLevel(pm25);
        const next: WeatherData = {
          condition,
          icon,
          temp: Math.round(current.temperature_2m),
          precipProb: Math.round(daily?.precipitation_probability_max?.[0] ?? 0),
          pm25,
          pm10,
          dustLevel: level,
          dustLabel: label,
        };
        if (aborted) return;
        setWeather(next);
        try {
          window.localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ t: Date.now(), data: next } satisfies CachedWeather),
          );
        } catch {
          // storage quota or disabled
        }
      } catch {
        // silent fail — UI hides weather line
      }
    }

    fetchWeather();
    return () => { aborted = true; };
  }, []);

  return weather;
}

/* ────────────────────────────────────────────────────────────
 * 상세 예보 (시간별 24h + 주간 7일) — 날씨 카드 클릭 시 on-demand 로드
 * ──────────────────────────────────────────────────────────── */

export interface HourlyPoint {
  /** ISO 문자열 (Asia/Seoul) */
  time: string;
  /** 표시용 "0시" ~ "23시" */
  hourLabel: string;
  temp: number;
  icon: string;
  precipProb: number;
  /** 현재 시각이 속한 칸 여부 */
  isNow: boolean;
}

export interface DailyPoint {
  /** ISO 날짜 YYYY-MM-DD */
  date: string;
  /** "오늘" | "내일" | "월"~"일" */
  dowLabel: string;
  condition: string;
  icon: string;
  tempMax: number;
  tempMin: number;
  precipProb: number;
  isToday: boolean;
}

export interface WeatherForecast {
  hourly: HourlyPoint[];
  daily: DailyPoint[];
}

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];
const FORECAST_CACHE_KEY = 'dia.weather.forecast.seoul';
const FORECAST_TTL = 30 * 60 * 1000;

interface CachedForecast {
  t: number;
  data: WeatherForecast;
}

/**
 * 서울 상세 예보 훅 — `enabled` 가 true 일 때만 네트워크 호출(모달 오픈 시).
 * @returns { forecast, error, loading } — 실패 시 error=true 로 재시도 UI 노출
 */
export function useSeoulForecast(enabled: boolean) {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const retry = () => { setError(false); setReloadKey((k) => k + 1); };

  useEffect(() => {
    if (!enabled) return;
    let aborted = false;

    async function run() {
      // 캐시 우선
      try {
        const raw = window.localStorage.getItem(FORECAST_CACHE_KEY);
        if (raw) {
          const parsed: CachedForecast = JSON.parse(raw);
          if (Date.now() - parsed.t < FORECAST_TTL) {
            setForecast(parsed.data);
            return;
          }
        }
      } catch {
        // ignore cache errors
      }

      setLoading(true);
      setError(false);
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${SEOUL_LAT}&longitude=${SEOUL_LNG}` +
            `&hourly=temperature_2m,weather_code,precipitation_probability` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
            `&timezone=Asia/Seoul&forecast_days=7`,
        );
        if (aborted) return;
        if (!res.ok) throw new Error('forecast fetch failed');
        const json = await res.json();

        // ── 시간별: 현재 시각부터 24칸 ──
        const now = new Date();
        const nowHourISO =
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` +
          `T${String(now.getHours()).padStart(2, '0')}:00`;
        const times: string[] = json.hourly?.time ?? [];
        let startIdx = times.findIndex((t) => t >= nowHourISO);
        if (startIdx < 0) startIdx = 0;
        const hourly: HourlyPoint[] = times
          .slice(startIdx, startIdx + 24)
          .map((t, i) => {
            const idx = startIdx + i;
            const { icon } = parseWeatherCode(json.hourly.weather_code[idx]);
            const hour = Number(t.slice(11, 13));
            return {
              time: t,
              hourLabel: i === 0 ? '지금' : `${hour}시`,
              temp: Math.round(json.hourly.temperature_2m[idx]),
              icon,
              precipProb: Math.round(json.hourly.precipitation_probability?.[idx] ?? 0),
              isNow: i === 0,
            };
          });

        // ── 주간: 7일 ──
        const todayISOStr = nowHourISO.slice(0, 10);
        const dTimes: string[] = json.daily?.time ?? [];
        const daily: DailyPoint[] = dTimes.map((d, i) => {
          const { condition, icon } = parseWeatherCode(json.daily.weather_code[i]);
          const dow = new Date(`${d}T00:00:00`).getDay();
          const isToday = d === todayISOStr;
          const label = isToday ? '오늘' : i === 1 ? '내일' : DOW_KO[dow];
          return {
            date: d,
            dowLabel: label,
            condition,
            icon,
            tempMax: Math.round(json.daily.temperature_2m_max[i]),
            tempMin: Math.round(json.daily.temperature_2m_min[i]),
            precipProb: Math.round(json.daily.precipitation_probability_max?.[i] ?? 0),
            isToday,
          };
        });

        const next: WeatherForecast = { hourly, daily };
        if (aborted) return;
        setForecast(next);
        try {
          window.localStorage.setItem(
            FORECAST_CACHE_KEY,
            JSON.stringify({ t: Date.now(), data: next } satisfies CachedForecast),
          );
        } catch {
          // storage quota or disabled
        }
      } catch {
        if (!aborted) setError(true);
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    run();
    return () => { aborted = true; };
  }, [enabled, reloadKey]);

  return { forecast, loading, error, retry };
}
