"""9/27 휴평 «심야연장 반영» 수정본(2026-09-22 받음)을 반영한다 — 바뀐 것은 62·82 두 다이아뿐.

diff_tables.py hp0927 결과: 62·64·82·83·88·91·임시61 이 지난 휴평 표와 다른데,
64·83·88·91·임시61 은 이미 late_A.json(심야연장 캡처)으로 덮어 두었고 새 그림과 내용이 같다.
새로 바뀐 것은 62·82 — 둘이 저녁 열차를 나눠 맡도록 바뀌었다(5632 를 62 가 몰고 와 답십리 22:15 에 82 에게 넘김).

gen_ts.py 는 원본 그림 폴더(xl_*·cap)가 있어야 돌아가서, 여기서는 같은 build() 로 두 줄만 다시 만들어 끼운다.
안전장치: 옛 자료로 만든 줄이 지금 파일의 줄과 한 글자도 다르지 않은지 먼저 확인한다.

쓰는 법(이 폴더에서): py -3 apply_hp0927_rev.py <수정본 엑셀>
"""
import json, io, os, re, sys, shutil
from build import build, derive_se
from diff_tables import read_workbook

HERE = os.path.dirname(os.path.abspath(__file__))
WT = os.path.abspath(os.path.join(HERE, '..', '..'))
TS = os.path.join(WT, 'src', 'data', 'chuseok2026.ts')
IMG_DIR = os.path.join(WT, 'public', 'images', 'route', 'chuseok2026')

NEW_TRAINS = {
    '62': [
        {"train": 5101, "from": "답십리", "dep": "17:32", "to": "하남검단산", "arr": "18:06", "next": "link"},
        {"train": 5116, "from": "하남검단산", "dep": "18:15", "to": "답십리", "arr": "18:48", "next": "break"},
        {"train": 5637, "from": "답십리", "dep": "21:10", "to": "마천", "arr": "21:36", "next": "link"},
        {"train": 5632, "from": "마천", "dep": "21:49", "to": "답십리", "arr": "22:15", "next": "deadhead"},
        {"train": 1038, "from": "고덕기지", "dep": "08:03", "to": "상일동", "arr": "08:08", "next": "link", "mark": "●"},
        {"train": 5058, "from": "상일동", "dep": "08:08", "to": "답십리", "arr": "08:31", "next": "end"},
    ],
    '82': [
        {"train": 5632, "from": "답십리", "dep": "22:15", "to": "방화", "arr": "23:17", "next": "link"},
        {"train": 1516, "from": "방화", "dep": "23:17", "to": "방화기지", "arr": "23:22", "next": "break", "mark": "▼"},
        {"train": 1501, "from": "방화기지", "dep": "05:19", "to": "방화", "arr": "05:24", "next": "link", "mark": "●"},
        {"train": 5901, "from": "방화", "dep": "05:24", "to": "화곡", "arr": "05:35", "next": "link"},
        {"train": 5513, "from": "화곡", "dep": "05:37", "to": "마천", "arr": "06:49", "next": "link"},
        {"train": 5518, "from": "마천", "dep": "06:57", "to": "답십리", "arr": "07:24", "next": "end"},
    ],
}


def ts_entry(k, e):   # gen_ts.py 와 같은 모양
    parts = [f's:"{e["s"]}"', f'e:"{e["e"]}"', f'm:"{e["m"]}"']
    if e.get('w'):
        parts.append(f'w:"{e["w"]}"')
    g = ','.join('{d:"%s",a:"%s",n:[%s]}' % (x['d'], x['a'], ','.join(str(n) for n in x['n'])) for x in e['g'])
    parts.append(f'g:[{g}]')
    return f'  "{k}": {{{",".join(parts)}}},'


def entry(row, work):
    s, e_ = derive_se(row)
    return ts_entry(row['dia'], build(row, s=s, e=e_, w=work))


def main():
    xlsx = sys.argv[1]
    hp_path, xs_path = os.path.join(HERE, 'hp_A.json'), os.path.join(HERE, 'xl_summary.json')
    hp = json.load(io.open(hp_path, encoding='utf-8'))
    xs = json.load(io.open(xs_path, encoding='utf-8'))
    ts = io.open(TS, encoding='utf-8').read()

    # NIGHT_HP 표 안에서만 바꾼다(다른 표에도 "62"·"82" 줄이 있다)
    a = ts.index('const NIGHT_HP')
    b = ts.index('};', a)
    block = ts[a:b]

    new_summ, new_imgs = read_workbook(xlsx)
    for k, trains in NEW_TRAINS.items():
        row = next(r for r in hp if str(r['dia']) == k)
        old_line = entry(row, xs['hp'][k]['계'])
        assert old_line in block, f'{k}: 옛 자료로 만든 줄이 파일과 다르다 — 손대지 않음\n{old_line}'
        row['trains'] = trains
        xs['hp'][k] = new_summ[k]
        new_line = entry(row, new_summ[k]['계'])
        block = block.replace(old_line, new_line, 1)
        print(k, '\n  전:', old_line.strip(), '\n  후:', new_line.strip())
        with open(os.path.join(IMG_DIR, f'hp_{k}.png'), 'wb') as f:
            f.write(new_imgs[k])

    io.open(TS, 'w', encoding='utf-8', newline='').write(ts[:a] + block + ts[b:])
    for path, data in ((hp_path, hp), (xs_path, xs)):
        raw = io.open(path, encoding='utf-8', newline='').read()
        eol = '\r\n' if '\r\n' in raw else '\n'   # 원래 줄끝을 지킨다(바뀐 곳만 diff 에 보이게)
        text = json.dumps(data, ensure_ascii=False, indent=1).replace('\n', eol)
        io.open(path, 'w', encoding='utf-8', newline='').write(text + (eol if raw.endswith(('\n', '\r\n')) else ''))
    print('반영 끝')


if __name__ == '__main__':
    main()
