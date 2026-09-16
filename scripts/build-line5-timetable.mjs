#!/usr/bin/env node
/**
 * 5호선 열번 색인 만들기 — 서울시 열린데이터광장 역별 시간표에서 «그날 실제로 달리는 열번» 을 모은다.
 *
 * 왜 필요한가
 *   열번 조회는 답십리 행로표만 보고는 «없는 번호» 와 «영등포 기관사가 모는 열번» 을 구별할 수
 *   없었다. 아무 번호나 넣어도 영등포라고 답했다. 공식 시간표에 있는 열번만 «있는 열번» 이다.
 *
 * 어떻게 모으나
 *   답십리를 지나지 않는 짧은 운행(방화↔여의도 같은)도 빠뜨리지 않으려고, 답십리·방화·강동에서
 *   시작해 시간표에 나오는 시발·종착역을 차례로 더 조회한다. 모든 열번은 자기 시발역에서 출발하므로
 *   시발·종착역을 전부 훑으면 빠지는 열번이 없다.
 *
 * 쓰는 법 (시간표 개정 때 다시 돌린다)
 *   node scripts/build-line5-timetable.mjs
 *   → public/data/line5-trains.json
 *
 * 키: 환경변수 SEOUL_API_KEY, 없으면 .env.local 에서 읽는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/data/line5-trains.json');

function readKey() {
  if (process.env.SEOUL_API_KEY) return process.env.SEOUL_API_KEY;
  const envPath = path.join(ROOT, '.env.local');
  if (fs.existsSync(envPath)) {
    const m = /^SEOUL_API_KEY=(.+)$/m.exec(fs.readFileSync(envPath, 'utf8'));
    if (m) return m[1].trim();
  }
  throw new Error('SEOUL_API_KEY 가 없습니다');
}

const KEY = readKey();
const BASE = `http://openAPI.seoul.go.kr:8088/${KEY}/json`;

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (res.ok) return await res.json();
    } catch {
      // 잠깐 쉬었다 다시
    }
    await new Promise((r) => setTimeout(r, 800 * (i + 1)));
  }
  throw new Error(`응답 없음: ${url.replace(KEY, '***')}`);
}

/** 역 이름 → 5호선 역코드 */
const codeCache = new Map();
async function stationCode(name) {
  if (codeCache.has(name)) return codeCache.get(name);
  const d = await getJson(`${BASE}/SearchInfoBySubwayNameService/1/20/${encodeURIComponent(name)}/`);
  const row = (d.SearchInfoBySubwayNameService?.row ?? []).find((r) => /^0?5호선$/.test(r.LINE_NUM));
  const code = row?.STATION_CD ?? null;
  codeCache.set(name, code);
  return code;
}

/** 역·요일·방향 한 벌의 시간표 전체 */
async function timetable(code, weekTag, inout) {
  const rows = [];
  for (let start = 1; ; start += 1000) {
    const end = start + 999;
    const d = await getJson(`${BASE}/SearchSTNTimeTableByIDService/${start}/${end}/${code}/${weekTag}/${inout}/`);
    const svc = d.SearchSTNTimeTableByIDService;
    if (!svc || svc.RESULT?.CODE !== 'INFO-000') break;
    rows.push(...svc.row);
    if (end >= svc.list_total_count) break;
  }
  return rows;
}

const WEEK = { 1: 'weekday', 2: 'saturday', 3: 'holiday' };
const hm = (t) => (t && t !== '00:00:00' ? t.slice(0, 5) : null);

async function main() {
  /** week → trainNo → { o, d, dap } */
  const index = { weekday: {}, saturday: {}, holiday: {} };
  const queue = ['답십리', '방화', '강동'];
  const done = new Set();

  while (queue.length) {
    const name = queue.shift();
    if (done.has(name)) continue;
    done.add(name);
    const code = await stationCode(name);
    if (!code) {
      console.warn(`  역코드 없음: ${name}`);
      continue;
    }
    let n = 0;
    for (const w of [1, 2, 3]) {
      for (const io of [1, 2]) {
        for (const r of await timetable(code, w, io)) {
          const key = r.TRAIN_NO;
          const slot = index[WEEK[w]];
          const cur = slot[key] ?? { o: r.SUBWAYSNAME, d: r.SUBWAYENAME, dap: null };
          if (name === '답십리') cur.dap = hm(r.LEFTTIME) ?? hm(r.ARRIVETIME);
          slot[key] = cur;
          n++;
          // 시발·종착역도 훑는다 — 답십리를 안 지나는 열번을 놓치지 않게
          for (const s of [r.SUBWAYSNAME, r.SUBWAYENAME]) if (s && !done.has(s)) queue.push(s);
        }
      }
    }
    console.log(`  ${name}(${code}) ${n}줄`);
  }

  const out = {
    source: '서울시 열린데이터광장 SearchSTNTimeTableByIDService (5호선 역별 시간표)',
    generatedAt: new Date().toISOString().slice(0, 10),
    stations: [...done],
    ...index,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  const count = (k) => Object.keys(index[k]).length;
  console.log(`\n저장: ${path.relative(ROOT, OUT)} — 평일 ${count('weekday')} · 토 ${count('saturday')} · 휴일 ${count('holiday')} 열번`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
