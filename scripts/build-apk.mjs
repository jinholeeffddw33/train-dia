#!/usr/bin/env node
/**
 * 안드로이드 디버그 APK 빌드 + 설치 — 2026-08-18
 *
 * `npm run native:apk`            빌드만
 * `npm run native:install`        빌드 후 연결된 기기 전부에 설치
 *   옵션: --release  릴리스 빌드(서명 설정이 있을 때)
 *         --device=<serial>  특정 기기에만 설치
 *
 * ★ 이 스크립트가 존재하는 이유 = 매번 손으로 하면 매번 같은 데서 걸리기 때문이다:
 *   1. JAVA_HOME — Android Studio 의 번들 JDK 위치를 사람이 외우고 있어야 했다
 *   2. local.properties 의 **BOM** — PowerShell 로 만들면 UTF-8 BOM 이 붙는데
 *      Gradle 의 Properties 로더는 그걸 키 이름의 일부로 읽어 `sdk.dir` 을 못 찾는다.
 *      증상은 "SDK location not found" 라 경로가 틀린 줄 알고 엉뚱한 데를 파게 된다.
 *      (2026-08-18 첫 빌드에서 실제로 여기 걸렸다. 그래서 여기서 BOM 없이 다시 쓴다.)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANDROID_DIR = path.join(ROOT, 'android');

const args = process.argv.slice(2);
const doInstall = args.includes('--install');
const isRelease = args.includes('--release');
const deviceArg = args.find((a) => a.startsWith('--device='))?.split('=')[1];

/** Android Studio 번들 JDK 후보 — 설치 폴더명이 버전마다 달라 여러 개를 본다 */
const JDK_CANDIDATES = [
  process.env.JAVA_HOME,
  'C:\\Program Files\\Android\\Android Studio1\\jbr',
  'C:\\Program Files\\Android\\Android Studio\\jbr',
].filter(Boolean);

const SDK_CANDIDATES = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk'),
].filter(Boolean);

function findDir(candidates, what) {
  const hit = candidates.find((p) => p && existsSync(p));
  if (!hit) {
    console.error(`✗ ${what} 를 찾을 수 없다. 확인한 곳:`);
    candidates.forEach((p) => console.error('   ' + p));
    process.exit(1);
  }
  return hit;
}

/**
 * local.properties 를 **BOM 없이** 보장한다.
 * 이미 올바르면 건드리지 않는다(Android Studio 가 쓴 것을 존중).
 */
function ensureLocalProperties(sdkDir) {
  const file = path.join(ANDROID_DIR, 'local.properties');
  const wanted = `sdk.dir=${sdkDir.replace(/\\/g, '\\\\')}\n`;

  if (existsSync(file)) {
    const buf = readFileSync(file);
    const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
    const text = buf.toString('utf8').replace(/^\uFEFF/, '');
    const sdkLine = text.split(/\r?\n/).find((l) => l.startsWith('sdk.dir='));
    if (!hasBom && sdkLine) return file; // 정상 — 그대로 둔다
    if (hasBom) console.log('· local.properties 에 BOM 이 있어 다시 쓴다 (Gradle 이 sdk.dir 을 못 읽는다)');
  }

  writeFileSync(file, wanted, { encoding: 'utf8' }); // Node 는 BOM 을 붙이지 않는다
  return file;
}

/**
 * Windows 는 .bat/.cmd 를 직접 spawn 할 수 없다 — Node 20+ 부터 보안상 막혀 EINVAL 이 난다.
 * 그래서 배치 파일만 shell 을 거치고, 인자는 공백 대비로 따옴표를 씌운다.
 */
function run(cmd, cmdArgs, opts = {}) {
  const needsShell = process.platform === 'win32' && /\.(bat|cmd)$/i.test(cmd);
  const res = needsShell
    ? spawnSync(`"${cmd}"`, cmdArgs.map((a) => `"${a}"`), { stdio: 'inherit', shell: true, ...opts })
    : spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: false, ...opts });

  if (res.error) {
    console.error(`✗ 실행 실패: ${cmd} — ${res.error.message}`);
    process.exit(1);
  }
  return res.status ?? 1;
}

/** adb 로 붙어 있는 기기 목록 (model 까지 같이) */
function listDevices(adb) {
  const res = spawnSync(adb, ['devices'], { encoding: 'utf8' });
  const serials = (res.stdout ?? '')
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => l.endsWith('\tdevice'))
    .map((l) => l.split('\t')[0]);

  return serials.map((serial) => {
    const m = spawnSync(adb, ['-s', serial, 'shell', 'getprop', 'ro.product.model'], {
      encoding: 'utf8',
    });
    return { serial, model: (m.stdout ?? '').trim() || '알 수 없음' };
  });
}

function main() {
  if (!existsSync(ANDROID_DIR)) {
    console.error('✗ android/ 폴더가 없다. `npx cap add android` 를 먼저 실행할 것');
    process.exit(1);
  }

  const javaHome = findDir(JDK_CANDIDATES, 'JDK (Android Studio 번들 jbr)');
  const sdkDir = findDir(SDK_CANDIDATES, 'Android SDK');
  ensureLocalProperties(sdkDir);

  console.log(`· JDK: ${javaHome}`);
  console.log(`· SDK: ${sdkDir}`);

  const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdkDir };
  const task = isRelease ? 'assembleRelease' : 'assembleDebug';
  const gradlew = path.join(ANDROID_DIR, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');

  console.log(`\n▶ gradle ${task} …`);
  const code = run(gradlew, [task], { cwd: ANDROID_DIR, env });
  if (code !== 0) {
    console.error('\n✗ 빌드 실패');
    process.exit(code);
  }

  const variant = isRelease ? 'release' : 'debug';
  const apk = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', variant, `app-${variant}.apk`);
  if (!existsSync(apk)) {
    console.error(`✗ 빌드는 성공했는데 APK 가 없다: ${path.relative(ROOT, apk)}`);
    process.exit(1);
  }
  const mb = (readFileSync(apk).length / 1024 / 1024).toFixed(2);
  console.log(`\n✓ APK: ${path.relative(ROOT, apk)} (${mb} MB)`);

  if (!doInstall) {
    console.log('  설치하려면: npm run native:install');
    return;
  }

  const adb = path.join(sdkDir, 'platform-tools', 'adb.exe');
  if (!existsSync(adb)) {
    console.error(`✗ adb 를 찾을 수 없다: ${adb}`);
    process.exit(1);
  }

  const devices = listDevices(adb).filter((d) => !deviceArg || d.serial === deviceArg);
  if (devices.length === 0) {
    console.error('✗ 연결된 기기가 없다 (USB 디버깅 켜고 연결할 것)');
    process.exit(1);
  }

  let failed = 0;
  for (const d of devices) {
    console.log(`\n▶ 설치: ${d.model} (${d.serial})`);
    // -r 재설치 · -d 다운그레이드 허용(개발 중 버전코드가 뒤로 갈 때)
    const status = run(adb, ['-s', d.serial, 'install', '-r', '-d', apk]);
    if (status !== 0) {
      failed++;
      console.error(`  ✗ ${d.model} 설치 실패`);
    }
  }

  if (failed > 0) {
    console.error(`\n✗ ${devices.length}대 중 ${failed}대 설치 실패`);
    process.exit(1);
  }
  console.log(`\n✓ ${devices.length}대 설치 완료`);
}

main();
