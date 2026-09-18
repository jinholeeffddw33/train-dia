"""검증을 마친 옮겨 적기 → src/data/chuseok2026.ts + 행로표 그림 복사."""
import json, io, re, os, shutil
from build import build, derive_se

# 이 폴더(scripts/chuseok2026)에서 실행한다. 그림(xl_*, cap)은 원본 자료에서 뽑아 이 폴더에 두어야 복사된다.
WT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
X = json.load(io.open('xl_summary.json', encoding='utf-8'))


def load(f):
    return json.load(io.open(f, encoding='utf-8'))


def num(d):
    return re.sub(r'\D', '', str(d))


def by_num(rows):
    return {num(r['dia']): r for r in rows}


def wfmt(v):
    if not v:
        return None
    h, m = v.split(':')[:2]
    return f'{int(h)}:{m}'


problems = []


def check_m(tag, k, m):
    bad = [p for p in m.split(',') if '?' in p]
    if bad:
        problems.append(f'{tag} {k}: 역 약자 모름 {bad}')


# ── 주간 1~34 (9/24~27): 열차는 한글 그림본(= 엑셀 그림본과 열차 목록 동일), 출퇴근은 한글 그림본 인쇄값
day = {}
for k, r in by_num(load('day_A.json')).items():
    e = build(r, w=X['hol'][k]['계'])
    check_m('주간', k, e['m']); day[k] = e

# ── 야간 69~91 (9/24~26 휴휴): 열차는 엑셀 그림본(59xx 포함, 운전시간 검산 통과), 출퇴근은 한글 그림본 인쇄값
hh_sched = by_num(load('night_A.json'))
hh = {}
for k, r in by_num(load('hh_X.json')).items():
    se = hh_sched[k]
    e = build(r, s=se['s'], e=se['e'], w=X['hh'][k]['계'])
    check_m('휴휴', k, e['m']); hh[k] = e

# ── 9/23 연결시작 62~91: 캡처(초까지), 두 번 옮겨 적어 완전히 일치. 65 는 «변65» 변경본
link = {}
for r in load('link_A.json'):
    k = num(r['dia'])
    e = build(r)
    check_m('연결', k, e['m']); link[k] = e

# ── 9/27 휴평 62~91: 엑셀 그림본(두 번 옮겨 적어 82번 한 곳만 달랐고 운전시간으로 판정). 출퇴근은 규칙으로
hp = {}
for k, r in by_num(load('hp_A.json')).items():
    s, e_ = derive_se(r)
    e = build(r, s=s, e=e_, w=X['hp'][k]['계'])
    check_m('휴평', k, e['m']); hp[k] = e

# ── 심야 1시간 연장 (9/26 휴휴 · 9/27 휴평): 캡처, 두 번 옮겨 적음(변91 한 곳은 그림으로 판정)
late26, late27 = {}, {}
for r in load('late_A.json'):
    f = os.path.basename(r['file'])
    key = re.sub(r'^(hh26|hp27)_', '', os.path.splitext(f)[0]).replace('변', '')
    e = build(r)
    check_m('심야', f, e['m'])
    (late26 if f.startswith('hh26') else late27)[key] = e

# ── 그림 복사 ──
IMG_DIR = os.path.join(WT, 'public', 'images', 'route', 'chuseok2026')
os.makedirs(IMG_DIR, exist_ok=True)
images = {'day': {}, 'hh': {}, 'link0923': {}, 'hp': {}, 'late0926': {}, 'late0927': {}}
for k in day:
    shutil.copy(f'xl_hol/{k}.png', f'{IMG_DIR}/day_{k}.png'); images['day'][k] = f'/images/route/chuseok2026/day_{k}.png'
for k in hh:
    shutil.copy(f'xl_hh/{k}.png', f'{IMG_DIR}/hh_{k}.png'); images['hh'][k] = f'/images/route/chuseok2026/hh_{k}.png'
for k in hp:
    shutil.copy(f'xl_hp/{k}.png', f'{IMG_DIR}/hp_{k}.png'); images['hp'][k] = f'/images/route/chuseok2026/hp_{k}.png'
for f in os.listdir('cap'):
    stem = os.path.splitext(f)[0]
    if stem.startswith('link_'):
        k = num(stem)
        shutil.copy(f'cap/{f}', f'{IMG_DIR}/link_{k}.jpg'); images['link0923'][k] = f'/images/route/chuseok2026/link_{k}.jpg'
    elif stem.startswith(('hh26_', 'hp27_')):
        key = re.sub(r'^(hh26|hp27)_', '', stem).replace('변', '')
        ascii_key = key.replace('임시', 't')
        tag = 'late0926' if stem.startswith('hh26') else 'late0927'
        shutil.copy(f'cap/{f}', f'{IMG_DIR}/{tag}_{ascii_key}.jpg'); images[tag][key] = f'/images/route/chuseok2026/{tag}_{ascii_key}.jpg'


def ts_entry(k, e):
    parts = [f's:"{e["s"]}"', f'e:"{e["e"]}"', f'm:"{e["m"]}"']
    if e.get('w'):
        parts.append(f'w:"{e["w"]}"')
    g = ','.join('{d:"%s",a:"%s",n:[%s]}' % (x['d'], x['a'], ','.join(str(n) for n in x['n'])) for x in e['g'])
    parts.append(f'g:[{g}]')
    return f'  "{k}": {{{",".join(parts)}}},'


def sort_key(k):
    return (1, k) if not k.isdigit() else (0, int(k))


def table(name, doc, t):
    lines = [f'/** {doc} */', f'const {name}: Record<string, Schedule> = {{']
    lines += [ts_entry(k, t[k]) for k in sorted(t, key=sort_key)]
    lines.append('};')
    return '\n'.join(lines)


def img_obj(d):
    return '{ ' + ', '.join(f'"{k}": "{d[k]}"' for k in sorted(d, key=sort_key)) + ' }'


out = []
out.append('''/**
 * 2026년 추석 연휴 특별 행로표 (2026-09-23 저녁 ~ 09-28 아침).
 *
 * ⚠ 자동 생성 파일 — 손으로 고치지 말 것. 원본은 답십리승무사업소가 배포한 자료다:
 *   · 「추석 연결시작 행로표 캡처(2026.09.23)」 캡처 30장, 심야 1시간 연장 캡처 12장
 *   · 「2026년 추석연휴 주간행로표(1~34)」「야간행로표(69~91)」 한글 문서
 *   · 행로표 시스템 엑셀 4개(휴일·평휴·휴평·휴휴, 2026-09-18 추출)
 * 그림을 옮겨 적은 뒤 세 가지로 맞춰 봤다: 서로 다른 그림 두 벌 대조, 두 사람이 따로 옮겨 적은 것 대조,
 * 엑셀의 다이아별 «운전» 시간과 구간 시간 합 대조(모든 다이아 ±2분 안).
 *
 * 평소 행로표(schedules.ts)는 그대로 두고, specialDays.ts 가 날짜별로 이 표를 덮어쓴다.
 * 연휴가 지나면 이 파일과 specialDays.ts 의 해당 날짜를 지우면 된다.
 */
import type { Schedule } from '@/lib/types';
''')
out.append(table('DAY', '주간 1~34 — 9/24(목)~9/27(일). 35~43 은 운휴', day))
out.append(table('NIGHT_HH', '야간 69~91 (휴휴) — 9/24·9/25·9/26 저녁. 62~68 은 운휴', hh))
out.append(table('LINK_0923', '9/23(수) 저녁 연결시작 62~91 (평휴). 새벽 열차가 9/24 추석 주간으로 이어진다. 65 는 «변65» 변경본', link))
out.append(table('NIGHT_HP', '야간 62~91 (휴평) — 9/27(일) 저녁. 새벽 열차가 9/28(월) 평일로 이어진다', hp))
out.append(table('LATE_0926', '9/26(토) 저녁 심야 1시간 연장 — 휴휴 위에 덮는 변경 다이아와 임시 다이아', late26))
out.append(table('LATE_0927', '9/27(일) 저녁 심야 1시간 연장 — 휴평 위에 덮는 변경 다이아와 임시 다이아', late27))
out.append(f'''
export const CHUSEOK_DAY = DAY;
export const CHUSEOK_NIGHT_0924 = NIGHT_HH;
export const CHUSEOK_LINK_0923 = LINK_0923;
/** 9/26 저녁 = 추석 휴휴 + 심야 연장 변경분 */
export const CHUSEOK_NIGHT_0926: Record<string, Schedule> = {{ ...NIGHT_HH, ...LATE_0926 }};
/** 9/27 저녁 = 추석 휴평 + 심야 연장 변경분 */
export const CHUSEOK_NIGHT_0927: Record<string, Schedule> = {{ ...NIGHT_HP, ...LATE_0927 }};

/** 행로표 그림 — public/images/route/chuseok2026 */
export const CHUSEOK_IMAGES = {{
  day: {img_obj(images['day'])},
  night0924: {img_obj(images['hh'])},
  link0923: {img_obj(images['link0923'])},
  night0926: {{ ...{img_obj(images['hh'])}, ...{img_obj(images['late0926'])} }} as Record<string, string>,
  night0927: {{ ...{img_obj(images['hp'])}, ...{img_obj(images['late0927'])} }} as Record<string, string>,
}};
''')
io.open(os.path.join(WT, 'src', 'data', 'chuseok2026.ts'), 'w', encoding='utf-8', newline='\n').write('\n\n'.join(out))
print('주간', len(day), '휴휴', len(hh), '연결', len(link), '휴평', len(hp), '심야26', sorted(late26), '심야27', sorted(late27))
print('그림', {k: len(v) for k, v in images.items()})
print('문제:', problems or '없음')
