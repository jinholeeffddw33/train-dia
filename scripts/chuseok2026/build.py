"""옮겨 적은 행로표(raw JSON) → 앱 Schedule 항목 {s,e,m,w,g}.

규칙은 기존 schedules.ts 에서 역으로 확인한 것:
  · 구간(g) = 세로 연결선으로 이어진 열차 묶음. 연결이 끊기거나(break) 편승(deadhead)이면 새 구간.
  · d = 첫 열차 출발(분 버림), a = 마지막 열차 도착(초가 있으면 올림, 분까지만 있으면 +1분)
    — 기존 표의 a 는 그림의 도착 분보다 늘 1분 크다(초를 올린 값).
  · 저녁 근무 안에서 자정을 넘긴 시각은 24:13 처럼, 새벽 근무는 05:20 처럼.
  · m = 구간마다 «출발역 + 각 열차의 도착역» 약자, 같은 글자가 이어지면 하나로.
"""
import json, io, re, sys

LETTER = {
    '방화기지': '기', '고덕기지': '기', '방화': '방', '송정': '송', '화곡': '화', '까치산': '까',
    '영등포구청': '영', '영등포': '영', '여의도': '여', '마포': '포', '애오개': '애', '광화문': '광',
    '왕십리': '왕', '답십리': '답', '군자': '군', '강동': '강', '둔촌동': '둔', '마천': '마',
    '길동': '길', '상일동': '상', '강일': '일', '미사': '미', '하남검단산': '하', '하남풍산': '풍',
}
KNOWN_LETTERS = set('답방기하마상영둔강미애화여왕군')  # 기존 표에 실제로 나오는 글자


def st(name):
    n = (name or '').replace('역', '').strip()
    n = {'방화기': '방화기지', '고덕기': '고덕기지', '하남검': '하남검단산', '영구': '영등포구청',
         '방기': '방화기지', '고기': '고덕기지', '하검': '하남검단산', '답십': '답십리', '왕십': '왕십리',
         '여의': '여의도', '애오': '애오개', '둔촌': '둔촌동', '상일': '상일동', '미': '미사'}.get(n, n)
    return n


def to_min(t):
    """'17:45:20' / '07:12' → (분, 초 있음?)"""
    p = t.split(':')
    h, m = int(p[0]), int(p[1])
    sec = int(p[2]) if len(p) > 2 else None
    return h * 60 + m, sec


def fmt(mins):
    return f'{mins // 60:02d}:{mins % 60:02d}'


def fmt_w(w):
    if not w:
        return None
    h, m = w.split(':')[:2]
    return f'{int(h)}:{m}'


def normalize_clock(trains):
    """저녁 블록의 자정 이후 시각을 24:xx 로, 새벽 블록은 그대로. 시각을 분(연속)으로 바꿔 돌려준다."""
    out = []
    morning = False
    prev = None
    for t in trains:
        dep, dsec = to_min(t['dep'])
        arr, asec = to_min(t['arr'])
        if not morning and prev is not None:
            # 저녁 블록 안에서 자정을 넘겨 00:xx/01:xx 로 적힌 것 → 24:xx
            if dep < prev and dep < 4 * 60 + 30 and prev >= 20 * 60 and dep + 24 * 60 - prev < 180:
                dep += 24 * 60
            elif dep < prev - 360:
                # 6시간 넘게 거꾸로 가면 새벽 근무 — 몇 분 어긋난 것(원본 오기)은 새벽으로 보지 않는다
                morning = True
        if not morning and arr < dep:
            arr += 24 * 60
        out.append((dep, dsec, arr, asec))
        prev = arr if not morning else arr
    return out


def build(entry, s=None, e=None, w=None):
    trains = entry['trains']
    clock = normalize_clock(trains)
    segs, cur = [], []
    for t, c in zip(trains, clock):
        cur.append((t, c))
        if t.get('next') != 'link':
            segs.append(cur)
            cur = []
    if cur:
        segs.append(cur)
    g, m_parts = [], []
    for seg in segs:
        (t0, c0), (tl, cl) = seg[0], seg[-1]
        d = c0[0]
        a = cl[2] + (1 if (cl[3] is None or cl[3] > 0) else 0)
        g.append({'d': fmt(d), 'a': fmt(a), 'n': [x[0]['train'] for x in seg]})
        letters = [LETTER.get(st(t0['from']), '?' + st(t0['from']))]
        for t, _ in seg:
            L = LETTER.get(st(t['to']), '?' + st(t['to']))
            if L != letters[-1]:
                letters.append(L)
        m_parts.append(''.join(letters))
    out = {'s': s or entry.get('s'), 'e': e or entry.get('e'), 'm': ','.join(m_parts)}
    ww = fmt_w(w or entry.get('work'))
    if ww:
        out['w'] = ww
    out['g'] = g
    return out


def derive_se(entry):
    """출근 = 첫 열차 출발 −30분, 퇴근 = 마지막 열차 도착(올림) +30분"""
    clock = normalize_clock(entry['trains'])
    first = clock[0][0]
    # 퇴근 = 마지막 도착(초 올림) +30 — 초까지 적힌 9/23 캡처 30개 중 27개가 이 규칙으로 맞는다.
    # 분까지만 있는 그림은 초를 모르니 +1분으로 올린다(±1분 오차 가능).
    last = clock[-1][2] + (1 if (clock[-1][3] is None or clock[-1][3] > 0) else 0)
    return fmt((first - 30) % 1440), fmt((last + 30) % 1440)


if __name__ == '__main__':
    rows = json.load(io.open(sys.argv[1], encoding='utf-8'))
    ok = bad = 0
    for r in rows:
        ps, pe = derive_se(r)
        good = (ps == r.get('s') and pe == r.get('e'))
        ok += good; bad += (not good)
        b = build(r)
        flag = '' if good else f'   ← 출퇴근 추정 {ps}/{pe} vs 실제 {r.get("s")}/{r.get("e")}'
        print(r['dia'], b['m'], [(x['d'], x['a']) for x in b['g']], flag)
    print(f'출근·퇴근 추정 규칙: 맞음 {ok}, 틀림 {bad}')
