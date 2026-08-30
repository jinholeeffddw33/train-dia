# 규정 원본 PDF 와 앱이 쓰는 JSON 을 페이지 단위로 대조한다.
#
# 무엇을 보나
#   · 페이지 수가 맞는가
#   · 각 페이지의 «글자» 가 같은가 (공백·줄바꿈은 추출기마다 달라 무시)
#   · 빠진 글자 / 없는데 들어간 글자가 있는가
#
# 출력은 UTF-8 파일로 쓴다 — 윈도우 콘솔은 한글을 그대로 못 받는다.

import io, json, os, re, sys, unicodedata
import fitz

DIR = os.path.join('public', 'data', 'edu', 'regulations')
OUT = sys.argv[1] if len(sys.argv) > 1 else 'compare_report.txt'

def norm(s: str) -> str:
    """비교용 정규화 — 공백 전부 제거, 유니코드 정규화, 흔한 이형 문자 통일."""
    s = unicodedata.normalize('NFKC', s)
    s = (s.replace('“', '"').replace('”', '"')
           .replace('‘', "'").replace('’', "'")
           .replace('－', '-').replace('–', '-').replace('—', '-')
           .replace('․', '.').replace('·', '·'))
    return re.sub(r'\s+', '', s)

def diff_chars(a: str, b: str):
    """a(원본) 대비 b(JSON) 에서 빠진/더해진 조각을 대략 뽑는다."""
    import difflib
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    missing, extra = [], []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag in ('delete', 'replace') and (i2 - i1) > 0:
            missing.append((i1, a[i1:i2]))
        if tag in ('insert', 'replace') and (j2 - j1) > 0:
            extra.append((j1, b[j1:j2]))
    return missing, extra, sm.ratio()

lines = []
def w(s=''):
    lines.append(s)

ids = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.pdf'))
total_bad = 0

for rid in ids:
    pdf_path = os.path.join(DIR, rid + '.pdf')
    json_path = os.path.join(DIR, rid + '-search.json')
    if not os.path.exists(json_path):
        w(f'[{rid}] ❌ -search.json 없음')
        total_bad += 1
        continue

    doc = fitz.open(pdf_path)
    raw = json.load(io.open(json_path, encoding='utf-8'))
    pages = {int(k): v for k, v in raw.items()} if isinstance(raw, dict) else {p['page']: p for p in raw}

    w(f'=== {rid} — PDF {doc.page_count}쪽 / JSON {len(pages)}쪽 ===')
    if doc.page_count != len(pages):
        w(f'  ⚠️ 쪽수 다름')
        total_bad += 1

    for i in range(doc.page_count):
        pno = i + 1
        src = norm(doc[i].get_text('text'))
        entry = pages.get(pno)
        if entry is None:
            w(f'  p.{pno} ❌ JSON 에 이 쪽이 없음 (원본 {len(src)}자)')
            total_bad += 1
            continue
        got = norm(entry.get('text', ''))
        if src == got:
            continue
        missing, extra, ratio = diff_chars(src, got)
        miss_len = sum(len(t) for _, t in missing)
        extra_len = sum(len(t) for _, t in extra)
        # 1글자짜리 잡음은 추출기 차이라 넘긴다
        big_missing = [(p, t) for p, t in missing if len(t) >= 2]
        big_extra = [(p, t) for p, t in extra if len(t) >= 2]
        if not big_missing and not big_extra:
            continue
        total_bad += 1
        w(f'  p.{pno} 일치율 {ratio:.4f} | 원본 {len(src)}자 · JSON {len(got)}자 | 빠짐 {miss_len} · 더함 {extra_len}')
        for p, t in big_missing[:6]:
            w(f'      − 빠짐 @{p}: {t[:100]}')
        for p, t in big_extra[:6]:
            w(f'      + 더함 @{p}: {t[:100]}')
    doc.close()
    w()

w(f'───────────── 문제 있는 항목 총 {total_bad}건')
io.open(OUT, 'w', encoding='utf-8').write('\n'.join(lines))
print('wrote', OUT, 'bad =', total_bad)
