import { NextResponse } from 'next/server';

// 답십리 승무사업소 좌표 (기상청 격자 — 서울 동대문구)
const NX = 61;
const NY = 127;

interface WeatherData {
  temp: number;
  humidity: number;
  pty: number;
  sky: number;
  pm: string;
  desc: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function basetime(now: Date): { base_date: string; base_time: string } {
  const slots = [2, 5, 8, 11, 14, 17, 20, 23];
  const hh = now.getHours();
  let slot = slots[0];
  for (const s of slots) if (hh >= s + 1) slot = s;
  const useYesterday = hh < slots[0] + 1;
  const d = new Date(now);
  if (useYesterday) {
    d.setDate(d.getDate() - 1);
    slot = 23;
  }
  return {
    base_date: `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`,
    base_time: `${pad(slot)}00`,
  };
}

function ptyDesc(pty: number, sky: number): string {
  if (pty === 1) return '비';
  if (pty === 2) return '비/눈';
  if (pty === 3) return '눈';
  if (pty === 4) return '소나기';
  if (sky === 1) return '맑음';
  if (sky === 3) return '구름많음';
  if (sky === 4) return '흐림';
  return '맑음';
}

export async function GET() {
  const key = process.env.KMA_API_KEY;
  if (!key) {
    return NextResponse.json({
      data: {
        temp: 23,
        humidity: 60,
        pty: 0,
        sky: 1,
        pm: '보통',
        desc: '맑음',
      } satisfies WeatherData,
      fallback: true,
    });
  }

  try {
    const { base_date, base_time } = basetime(new Date());
    const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?serviceKey=${encodeURIComponent(key)}&numOfRows=10&pageNo=1&dataType=JSON&base_date=${base_date}&base_time=${base_time}&nx=${NX}&ny=${NY}`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`KMA ${res.status}`);
    const json = await res.json();
    const items = json?.response?.body?.items?.item ?? [];
    let temp = 0, humidity = 0, pty = 0;
    for (const it of items) {
      if (it.category === 'T1H') temp = parseFloat(it.obsrValue);
      if (it.category === 'REH') humidity = parseFloat(it.obsrValue);
      if (it.category === 'PTY') pty = parseInt(it.obsrValue);
    }
    return NextResponse.json({
      data: {
        temp: Math.round(temp),
        humidity: Math.round(humidity),
        pty,
        sky: 1,
        pm: '보통',
        desc: ptyDesc(pty, 1),
      } satisfies WeatherData,
    });
  } catch {
    return NextResponse.json({
      data: { temp: 23, humidity: 60, pty: 0, sky: 1, pm: '보통', desc: '맑음' } satisfies WeatherData,
      fallback: true,
    });
  }
}
