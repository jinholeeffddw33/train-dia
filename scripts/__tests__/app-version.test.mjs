import { describe, it, expect } from 'vitest';
import { readVersion, nextVersion, formatVersion, writeVersion, touchesApp } from '../lib/app-version.mjs';

const SRC = "// head\r\nexport const APP_VERSION = 'v4.0.2';\r\n\r\nexport const BUILD_ID = 'x';\r\n";

describe('앱 버전 자동 올림', () => {
  it('버전 줄을 읽는다', () => {
    expect(readVersion(SRC)).toEqual([4, 0, 2]);
    expect(readVersion('no version here')).toBeNull();
  });

  it('끝자리를 하나 올린다', () => {
    expect(formatVersion(nextVersion([4, 0, 2], null))).toBe('v4.0.3');
  });

  it('원격이 더 앞서 있으면 원격에서 올린다 — 같은 번호가 두 번 나가지 않게', () => {
    expect(formatVersion(nextVersion([4, 0, 2], [4, 0, 7]))).toBe('v4.0.8');
    expect(formatVersion(nextVersion([4, 1, 0], [4, 0, 9]))).toBe('v4.1.1');
  });

  it('버전 번호만 바꾸고 줄바꿈과 다른 줄은 그대로 둔다', () => {
    const out = writeVersion(SRC, [4, 0, 3]);
    expect(out).toBe(SRC.replace("'v4.0.2'", "'v4.0.3'"));
    expect(out.split('\r\n').length).toBe(SRC.split('\r\n').length);
  });

  it('앱 파일이 바뀐 커밋만 올린다', () => {
    expect(touchesApp(['src/features/edu/styles/edu.module.css'])).toBe(true);
    expect(touchesApp(['public/sw.js'])).toBe(true);
    expect(touchesApp(['docs/PROCESS_RULES.md', 'scripts/x.mjs'])).toBe(false);
    expect(touchesApp(['src/lib/constants.ts'])).toBe(false);
  });
});
