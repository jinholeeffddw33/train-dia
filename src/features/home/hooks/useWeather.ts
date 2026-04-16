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

function parseWeatherCode(code: number): { condition: string; icon: string } {
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
