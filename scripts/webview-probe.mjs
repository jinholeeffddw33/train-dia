#!/usr/bin/env node
/**
 * 폰 WebView 안에서 JS 를 직접 실행해 사실을 확인하는 도구 — 2026-08-18
 *
 *   node scripts/webview-probe.mjs "location.href"
 *   node scripts/webview-probe.mjs --file probes/support.js
 *   node scripts/webview-probe.mjs --device R3CR90MTPYT "navigator.userAgent"
 *
 * ★ 왜 필요한가 — 네이티브 WebView 는 Chrome 과 **다른 브라우저**다.
 *   "안드로이드니까 크롬처럼 되겠지"로 판단하면 WebAuthn·웹푸시처럼 **있는 줄 알았는데 없는**
 *   API 에서 통째로 헛짚는다. 여기서 한 줄 실행하면 15초 만에 사실이 나온다.
 *   (ZINOSB 교훈: 추측으로 세 번 고치고 세 번 다 더 나빠졌다. CDP 로 붙으니 15분에 끝났다)
 *
 * 동작: adb 로 앱 PID → WebView devtools 소켓을 로컬 포트로 포워딩 → CDP Runtime.evaluate.
 * 필요 조건: capacitor.config.ts 의 android.webContentsDebuggingEnabled = true (또는 디버그 빌드).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const APP_ID = 'kr.dia5.app';
/**
 * ⚠️ 9222 를 쓰지 않는다 — 진호 PC 의 "Chrome(디버그용)" 이 그 포트를 점유하고 있다.
 *   9222 로 포워딩하면 adb forward 가 조용히 밀리고 fetch 는 **데스크톱 크롬**에 붙는다.
 *   그러면 폰을 재는 줄 알고 PC 를 재게 된다. 2026-08-18 실제로 여기 걸렸고,
 *   UA 가 'Windows NT' 인 걸 보고서야 알아챘다 — 그 전까지 결과는 전부 그럴듯했다.
 *   그래서 포트를 옮기고, 아래 EXPECTED_HOST 로 **대상이 우리 앱이 맞는지 검증**한다.
 */
const LOCAL_PORT = 9333;
/** 붙은 대상이 이 호스트가 아니면 중단한다 (엉뚱한 브라우저 측정 방지) */
const EXPECTED_HOST = 'dia5.kr';

const args = process.argv.slice(2);
const deviceIdx = args.indexOf('--device');
const device = deviceIdx !== -1 ? args[deviceIdx + 1] : null;
const fileIdx = args.indexOf('--file');
const scriptFile = fileIdx !== -1 ? args[fileIdx + 1] : null;
const inlineExpr = args.filter(
  (a, i) => !a.startsWith('--') && i !== deviceIdx + 1 && i !== fileIdx + 1
)[0];

const ADB = [
  process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'),
  path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
  'adb',
].find((p) => p && (p === 'adb' || existsSync(p)));

function adb(cmdArgs, opts = {}) {
  const full = device ? ['-s', device, ...cmdArgs] : cmdArgs;
  const res = spawnSync(ADB, full, { encoding: 'utf8', ...opts });
  return (res.stdout ?? '').trim();
}

function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

/**
 * CDP 는 WebSocket 으로만 말한다. Node 22+ 는 WebSocket 이 전역으로 들어와 있어
 * 외부 패키지(ws) 없이 붙을 수 있다 — 이 스크립트가 devDependency 를 안 늘리는 이유.
 */
async function evaluate(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    // 네이티브 플러그인 호출(알림 예약 등)은 OS 를 거쳐서 10초를 넘길 때가 있다.
    const TIMEOUT_MS = 30_000;
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`CDP 응답 시간 초과 (${TIMEOUT_MS / 1000}초)`));
    }, TIMEOUT_MS);

    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression,
            returnByValue: true,
            awaitPromise: true,
            // 페이지가 사용자 제스처를 요구하는 API 를 부를 수 있게(권한 조회 등)
            userGesture: true,
          },
        })
      );
    });

    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      } catch {
        return;
      }
      if (msg.id !== 1) return; // 다른 도메인 이벤트는 무시
      clearTimeout(timer);
      ws.close();
      if (msg.error) return reject(new Error(msg.error.message));
      const r = msg.result?.result;
      if (msg.result?.exceptionDetails) {
        return reject(new Error(msg.result.exceptionDetails.text + ' — ' + (r?.description ?? '')));
      }
      resolve(r?.value !== undefined ? r.value : r?.description);
    });

    ws.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error('WebSocket 연결 실패 — 앱이 켜져 있는지 확인'));
    });
  });
}

async function main() {
  const expression = scriptFile ? readFileSync(scriptFile, 'utf8') : inlineExpr;
  if (!expression) {
    fail('실행할 표현식이 없다.  예: node scripts/webview-probe.mjs "location.href"');
  }

  const pid = adb(['shell', 'pidof', APP_ID]).split(/\s+/)[0];
  if (!pid) fail(`${APP_ID} 가 실행 중이 아니다. 폰에서 앱을 먼저 켤 것`);

  const socket = `webview_devtools_remote_${pid}`;
  const sockets = adb(['shell', 'cat', '/proc/net/unix']);
  if (!sockets.includes(socket)) {
    fail(
      `WebView 디버깅 소켓이 없다(${socket}).\n` +
        '  capacitor.config.ts 의 android.webContentsDebuggingEnabled 가 true 인지,\n' +
        '  그 설정 후 `npx cap sync android` + 재빌드 했는지 확인할 것'
    );
  }

  adb(['forward', '--remove', `tcp:${LOCAL_PORT}`]); // 이전 포워딩 잔재 정리
  const forwarded = spawnSync(
    ADB,
    [...(device ? ['-s', device] : []), 'forward', `tcp:${LOCAL_PORT}`, `localabstract:${socket}`],
    { encoding: 'utf8' }
  );
  if (forwarded.status !== 0) {
    fail(`adb forward 실패 — 포트 ${LOCAL_PORT} 가 이미 쓰이고 있을 수 있다\n  ${forwarded.stderr?.trim()}`);
  }

  const res = await fetch(`http://127.0.0.1:${LOCAL_PORT}/json/list`);
  const targets = await res.json();
  const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) fail('디버깅 가능한 페이지를 못 찾았다 (WebView 가 아직 로드 중일 수 있다)');

  // ★ 붙은 대상이 정말 우리 앱인지 확인한다.
  //   포워딩이 어긋나면 같은 포트의 **다른 브라우저**(PC 크롬 등)가 응답해 버리는데,
  //   결과가 그럴듯해서 육안으로는 안 걸러진다. 호스트로 못을 박는다.
  if (!String(page.url).includes(EXPECTED_HOST)) {
    adb(['forward', '--remove', `tcp:${LOCAL_PORT}`]);
    fail(
      `엉뚱한 대상에 붙었다 — 폰 WebView 가 아니다.\n` +
        `  기대: ${EXPECTED_HOST} 를 연 페이지\n` +
        `  실제: ${page.url}\n` +
        `  (포트 ${LOCAL_PORT} 를 다른 브라우저가 점유 중일 가능성)`
    );
  }

  console.error(`· 대상: ${page.title} — ${page.url}\n`);
  const value = await evaluate(page.webSocketDebuggerUrl, expression);
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));

  adb(['forward', '--remove', `tcp:${LOCAL_PORT}`]);
}

main().catch((err) => {
  console.error('✗ ' + err.message);
  process.exit(1);
});
