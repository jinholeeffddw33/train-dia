#!/usr/bin/env node
/**
 * 네이티브 앱 아이콘/스플래시 소스 생성기 — 2026-08-18
 *
 * `npx capacitor-assets generate` 는 assets/ 폴더에 정해진 규격의 원본을 요구한다:
 *   icon.png 1024x1024 · icon-foreground/background.png 1024x1024 · splash*.png 2732x2732
 * 이 스크립트는 그 원본들을 PWA 아이콘 하나(public/icons/dia5-512.png)에서 만들어낸다.
 *
 * ⚠️ 지금 소스는 512px 이라 1024 로 확대된다 — 스토어 제출 전에 1024 원본으로 교체할 것.
 *   교체 방법: assets/source-icon.png 에 1024x1024 를 넣고 이 스크립트를 다시 돌리면
 *   그 파일이 우선 사용된다(아래 SOURCE 후보 순서).
 *
 * 사용법:
 *   node scripts/gen-native-assets.mjs        # 원본 생성
 *   npx capacitor-assets generate --android   # 그걸로 실제 리소스 굽기
 */
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets');

/** 앞에 있는 것이 우선. 진호가 고화질 원본을 주면 첫 번째 자리에 두면 된다. */
const SOURCE_CANDIDATES = [
  path.join(OUT, 'source-icon.png'),
  path.join(ROOT, 'public', 'icons', 'dia5-512.png'),
];

// tokens.css 와 동일한 값 (다크 퍼스트)
const BG_DARK = '#0F172A';
const BG_LIGHT = '#F0F4F8';
/** adaptive icon 배경 — 소스 아이콘의 바탕이 흰색이라 이어지게 맞춘다 */
const ADAPTIVE_BG = '#FFFFFF';

const ICON_SIZE = 1024;
const SPLASH_SIZE = 2732;
/**
 * Android adaptive icon 은 바깥 33% 가 런처 마스크에 잘려나간다.
 * foreground 로고를 66% 안으로 넣어야 어떤 런처 모양에서도 안 잘린다.
 */
const ADAPTIVE_SAFE_RATIO = 0.66;
/** 스플래시 중앙 로고 비율 — 너무 크면 기종별 크롭에 걸린다 */
const SPLASH_LOGO_RATIO = 0.2;

/** #RRGGBB 와 #RRGGBBAA 둘 다 받는다 (전경 레이어는 투명이어야 해서 알파가 필요) */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    alpha: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
  };
}

/** 캔버스 정중앙에 로고를 얹는다 */
async function composeCentered({ source, canvasSize, logoSize, background, out }) {
  const logo = await sharp(source)
    .resize(logoSize, logoSize, { kernel: sharp.kernel.lanczos3, fit: 'contain' })
    .toBuffer();

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: hexToRgb(background),
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(out);

  return out;
}

async function main() {
  const source = SOURCE_CANDIDATES.find((p) => existsSync(p));
  if (!source) {
    console.error('✗ 아이콘 원본을 찾을 수 없다. 후보:');
    SOURCE_CANDIDATES.forEach((p) => console.error('   ' + path.relative(ROOT, p)));
    process.exit(1);
  }

  const meta = await sharp(source).metadata();
  console.log(`원본: ${path.relative(ROOT, source)} (${meta.width}x${meta.height})`);
  if ((meta.width ?? 0) < ICON_SIZE) {
    console.warn(
      `⚠ 원본이 ${meta.width}px 이라 ${ICON_SIZE}px 로 확대된다 — 스토어 제출 전 1024 원본으로 교체 권장`
    );
  }

  await mkdir(OUT, { recursive: true });

  // 1) 기본 아이콘 (iOS 앱 아이콘 · Android legacy)
  await sharp(source)
    .resize(ICON_SIZE, ICON_SIZE, { kernel: sharp.kernel.lanczos3, fit: 'contain' })
    .png()
    .toFile(path.join(OUT, 'icon.png'));

  // 2) Android adaptive icon — 배경(단색) + 전경(안전영역 안 로고)
  await sharp({
    create: { width: ICON_SIZE, height: ICON_SIZE, channels: 4, background: hexToRgb(ADAPTIVE_BG) },
  })
    .png()
    .toFile(path.join(OUT, 'icon-background.png'));

  await composeCentered({
    source,
    canvasSize: ICON_SIZE,
    logoSize: Math.round(ICON_SIZE * ADAPTIVE_SAFE_RATIO),
    background: '#00000000', // 전경은 투명 — 배경 레이어가 비쳐야 한다
    out: path.join(OUT, 'icon-foreground.png'),
  });

  // 3) 스플래시 (다크/라이트)
  const splashLogo = Math.round(SPLASH_SIZE * SPLASH_LOGO_RATIO);
  await composeCentered({
    source,
    canvasSize: SPLASH_SIZE,
    logoSize: splashLogo,
    background: BG_DARK,
    out: path.join(OUT, 'splash-dark.png'),
  });
  await composeCentered({
    source,
    canvasSize: SPLASH_SIZE,
    logoSize: splashLogo,
    background: BG_LIGHT,
    out: path.join(OUT, 'splash.png'),
  });

  console.log('✓ assets/ 원본 5개 생성 완료 — 다음: npx capacitor-assets generate --android');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
