// 앱 버전 자동 올림 — 계산 규칙만 (git 은 bump-version.mjs 가 다룬다)
//
// 버전은 src/lib/constants.ts 의 `APP_VERSION = 'vX.Y.Z'` 한 줄이다.
// 커밋마다 끝자리(Z)를 하나 올리되, 다른 곳에서 먼저 올린 번호(origin/main)보다
// 작아지지 않게 둘 중 큰 쪽에서 올린다 — 두 사람이 같은 번호를 내보내지 않게.

export const VERSION_RE = /(APP_VERSION\s*=\s*')v(\d+)\.(\d+)\.(\d+)(')/;

/** 파일 내용에서 [major, minor, patch] 를 꺼낸다. 없으면 null */
export function readVersion(source) {
  const m = VERSION_RE.exec(source ?? '');
  return m ? [Number(m[2]), Number(m[3]), Number(m[4])] : null;
}

export function compareVersion(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** 지금 버전과 원격 최신 버전 중 큰 쪽에서 끝자리를 하나 올린다 */
export function nextVersion(current, remote) {
  const base = remote && compareVersion(remote, current) > 0 ? remote : current;
  return [base[0], base[1], base[2] + 1];
}

export const formatVersion = (v) => `v${v[0]}.${v[1]}.${v[2]}`;

/** 버전 줄의 번호만 바꾼다 — 줄바꿈(CRLF/LF)이나 다른 줄은 건드리지 않는다 */
export function writeVersion(source, v) {
  return source.replace(VERSION_RE, (_all, head, _a, _b, _c, tail) => `${head}${formatVersion(v)}${tail}`);
}

/** 이 커밋이 앱에 들어가는 파일을 바꾸는가 — 문서·스크립트만 바꾼 커밋은 올리지 않는다 */
export function touchesApp(paths) {
  return paths.some((p) => (p.startsWith('src/') || p.startsWith('public/')) && p !== 'src/lib/constants.ts');
}
