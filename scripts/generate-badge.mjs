// 푸시 알림 badge 아이콘 생성 — 96×96 흰색 단색 실루엣 PNG (투명 배경).
// Android 상태바/알림 badge 는 단색 마스크로 렌더되므로 흰색 실루엣이 정답.
// 외부 의존성 0 — node 내장 zlib 로 PNG 직접 인코딩.
// 사용: node scripts/generate-badge.mjs  →  public/icons/badge-96.png
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SIZE = 96;
// RGBA 캔버스 (전부 투명)
const px = new Uint8Array(SIZE * SIZE * 4);

function setPixel(x, y, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  px[i] = 255; px[i + 1] = 255; px[i + 2] = 255;
  px[i + 3] = a;
}

function clearPixel(x, y) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  px[i + 3] = 0;
}

/** 둥근 사각형 채움 (안티앨리어싱 1px) */
function fillRoundRect(x0, y0, w, h, r, mode = 'fill') {
  for (let y = Math.floor(y0) - 1; y <= Math.ceil(y0 + h) + 1; y++) {
    for (let x = Math.floor(x0) - 1; x <= Math.ceil(x0 + w) + 1; x++) {
      const d = roundRectDist(x + 0.5, y + 0.5, x0, y0, w, h, r);
      // d <= 0 안, 0~1 경계(안티앨리어스)
      if (d <= 0) {
        if (mode === 'fill') setPixel(x, y, 255); else clearPixel(x, y);
      } else if (d < 1 && mode === 'fill') {
        setPixel(x, y, Math.round(255 * (1 - d)));
      }
    }
  }
}

function roundRectDist(pxx, pyy, x0, y0, w, h, r) {
  const cx = x0 + w / 2, cy = y0 + h / 2;
  const dx = Math.abs(pxx - cx) - (w / 2 - r);
  const dy = Math.abs(pyy - cy) - (h / 2 - r);
  const ox = Math.max(dx, 0), oy = Math.max(dy, 0);
  return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(dx, dy), 0) - r;
}

/** 원 채움 (안티앨리어싱 1px) */
function fillCircle(cx, cy, r) {
  for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r) + 1; y++) {
    for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
      const d = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) - r;
      if (d <= 0) setPixel(x, y, 255);
      else if (d < 1) setPixel(x, y, Math.round(255 * (1 - d)));
    }
  }
}

// ── 열차 정면 실루엣 ──
fillRoundRect(20, 10, 56, 60, 16);          // 차체
fillRoundRect(30, 20, 36, 22, 7, 'clear');  // 전면 창 (투명 컷아웃)
fillRoundRect(40, 74, 16, 6, 3);            // 하부 커플러
fillCircle(32, 82, 8);                       // 왼쪽 바퀴
fillCircle(64, 82, 8);                       // 오른쪽 바퀴

// ── PNG 인코딩 ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

// 스캔라인 (filter 0)
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons', 'badge-96.png');
writeFileSync(outPath, png);
console.log(`badge-96.png 생성 완료 → ${outPath} (${png.length} bytes)`);
