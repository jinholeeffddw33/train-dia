#!/usr/bin/env node
/**
 * 릴리스 서명 키 생성 — **딱 한 번만** 실행한다 (2026-08-18).
 *
 * ⚠️ 이 키를 잃어버리면 같은 앱(kr.dia5.app)으로 **업데이트를 영원히 못 올린다.**
 *    구글은 패키지명 재사용을 허용하지 않으므로, 앱을 새로 등록하고
 *    기존 사용자에게 재설치를 요청하는 것 말고는 방법이 없다.
 *    → 생성 직후 android/dia5-release.jks 와 android/keystore.properties 를
 *      클라우드/외장 등 **최소 두 곳에** 백업할 것.
 *
 * 비밀번호는 이 스크립트가 정하지 않는다 — 실행하는 사람이 직접 입력한다.
 * (AI 나 스크립트가 정한 비밀번호가 로그·대화에 남으면 그 자체로 유출이다)
 *
 * 사용: node scripts/make-keystore.mjs
 */
import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ANDROID = path.join(ROOT, 'android')
const KEY_FILE = path.join(ANDROID, 'dia5-release.jks')
const PROPS_FILE = path.join(ANDROID, 'keystore.properties')
const ALIAS = 'dia5'

/** Android Studio 번들 JDK 안의 keytool */
const KEYTOOL_CANDIDATES = [
  process.env.JAVA_HOME && path.join(process.env.JAVA_HOME, 'bin', 'keytool.exe'),
  'C:\\Program Files\\Android\\Android Studio1\\jbr\\bin\\keytool.exe',
  'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe',
  'keytool',
].filter(Boolean)

function findKeytool() {
  const hit = KEYTOOL_CANDIDATES.find((p) => p === 'keytool' || existsSync(p))
  if (!hit) {
    console.error('✗ keytool 을 찾을 수 없다. Android Studio 설치 경로를 확인할 것')
    process.exit(1)
  }
  return hit
}

async function main() {
  if (existsSync(KEY_FILE)) {
    console.error(`✗ 이미 키가 있다: ${path.relative(ROOT, KEY_FILE)}`)
    console.error('  덮어쓰면 기존 키가 사라져 업데이트를 못 올리게 된다. 중단한다.')
    process.exit(1)
  }

  console.log('릴리스 서명 키를 만든다.\n')
  console.log('⚠️  이 키를 잃어버리면 앱 업데이트를 영원히 못 올린다 — 만든 뒤 반드시 백업할 것.\n')

  const rl = createInterface({ input: stdin, output: stdout })
  const storePassword = await rl.question('키 저장소 비밀번호 (6자 이상): ')
  if (storePassword.length < 6) {
    console.error('✗ 6자 이상이어야 한다')
    rl.close()
    process.exit(1)
  }
  const confirm = await rl.question('한 번 더 입력: ')
  if (storePassword !== confirm) {
    console.error('✗ 두 입력이 다르다')
    rl.close()
    process.exit(1)
  }
  const owner = await rl.question('소유자 이름(CN, 예: Jinho Lee): ')
  rl.close()

  const keytool = findKeytool()
  // 키 비밀번호는 저장소 비밀번호와 동일하게 둔다(구글 권장 구성, 관리 포인트 감소)
  const args = [
    '-genkeypair', '-v',
    '-keystore', KEY_FILE,
    '-alias', ALIAS,
    '-keyalg', 'RSA',
    '-keysize', '2048',
    // 스토어 업로드 키는 유효기간이 길어야 한다(구글 권장 25년+)
    '-validity', '10950',
    '-storepass', storePassword,
    '-keypass', storePassword,
    '-dname', `CN=${owner || 'DIA5'}, OU=dia5, O=dia5, L=Seoul, C=KR`,
  ]

  const res = spawnSync(keytool, args, { stdio: 'inherit' })
  if (res.status !== 0) {
    console.error('\n✗ 키 생성 실패')
    process.exit(res.status ?? 1)
  }

  writeFileSync(
    PROPS_FILE,
    [
      '# 릴리스 서명 정보 — 절대 커밋 금지(.gitignore 등록됨)',
      'storeFile=dia5-release.jks',
      `storePassword=${storePassword}`,
      `keyAlias=${ALIAS}`,
      `keyPassword=${storePassword}`,
      '',
    ].join('\n'),
    'utf8',
  )

  console.log(`\n✓ 키 생성 완료`)
  console.log(`   ${path.relative(ROOT, KEY_FILE)}`)
  console.log(`   ${path.relative(ROOT, PROPS_FILE)}`)
  console.log('\n다음:')
  console.log('  1) 위 두 파일을 안전한 곳 두 군데에 백업 (잃으면 업데이트 불가)')
  console.log('  2) node scripts/build-apk.mjs --aab   → 스토어 업로드용 AAB 생성')
}

main()
