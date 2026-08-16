"""규정 PDF 재추출 — 사라진 띄어쓰기를 글자 좌표에서 복원한다.

왜 필요한가
  9개 규정 중 5개는 본문이 "이규정은서울교통공사"처럼 붙어 있다. 추출기가 놓친 게 아니라
  PDF 텍스트 층에 공백 문자가 아예 없다. 한글(HWP)에서 양쪽 정렬로 내보내면서 공백을
  공백 문자 대신 글자 좌표로 표현했기 때문이다. 눈에는 띄어쓰기로 보이지만 복사하면 붙는다.

어떻게 복원하는가
  글자마다 bbox 가 남아 있다. 앞 글자 오른쪽 끝과 다음 글자 왼쪽 끝 사이 간격을
  앞 글자 폭으로 나눈 비율을 보면 깨끗하게 둘로 갈린다(운전취급규정 실측):
      글자 사이  0.00 ~ 0.02  (70%)
      단어 사이  0.30 ~ 0.51  (20%)
  0.15 를 경계로 삼는다. 중간대가 비어 있어 경계값에 민감하지 않다.

무엇을 건드리지 않는가
  · 이미 띄어쓰기가 살아 있는 4개 문서는 손대지 않는다(인사규정·취업규칙·세부요령·업무예규).
  · 글자 자체는 한 글자도 바꾸지 않는다. 공백만 끼워 넣는다.
  · 페이지 구분과 줄바꿈은 그대로 둔다 — 조문 분리기가 이 구조에 기대고 있다.

검증(자동)
  복원 전후에서 공백을 모두 지우면 완전히 같아야 한다. 다르면 글자가 사라지거나
  순서가 바뀐 것이므로 그 문서는 쓰지 않고 중단한다.

사용: python scripts/respace_regulations.py [--apply]
"""
import json
import os
import re
import sys

import fitz

DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'edu', 'regulations')
DIR = os.path.normpath(DIR)
APPLY = '--apply' in sys.argv

# 간격 / 앞 글자 폭. 이 값을 넘으면 단어 경계로 본다.
GAP_RATIO = 0.15
# 이 비율보다 띄어쓰기가 적으면 '공백이 사라진 문서'로 판단한다.
BROKEN_BELOW = 0.15

HANGUL_PAIR = re.compile(r'[가-힣][가-힣]')
HANGUL_SPACED = re.compile(r'[가-힣] [가-힣]')


def spacing_ratio(text: str) -> float:
    """한글 다음에 공백이 오는 비율. 정상 문서는 0.34~0.39, 깨진 문서는 0.00~0.08."""
    stuck = len(HANGUL_PAIR.findall(text))
    spaced = len(HANGUL_SPACED.findall(text))
    return spaced / (spaced + stuck) if (spaced + stuck) else 1.0


def respace_page(page) -> str:
    """rawdict 로 글자 bbox 를 훑어 공백을 끼운 페이지 텍스트."""
    lines = []
    for block in page.get_text('rawdict')['blocks']:
        for line in block.get('lines', []):
            chars = [c for span in line['spans'] for c in span['chars']]
            if not chars:
                continue
            buf = [chars[0]['c']]
            for i in range(1, len(chars)):
                prev, cur = chars[i - 1], chars[i]
                # 이미 공백이 있으면 겹쳐 넣지 않는다
                if not prev['c'].isspace() and not cur['c'].isspace():
                    width = prev['bbox'][2] - prev['bbox'][0]
                    if width > 0 and (cur['bbox'][0] - prev['bbox'][2]) / width > GAP_RATIO:
                        buf.append(' ')
                buf.append(cur['c'])
            lines.append(''.join(buf))
    return '\n'.join(lines)


def main():
    ids = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith('.pdf'))
    changed = []
    for rid in ids:
        search_path = os.path.join(DIR, f'{rid}-search.json')
        if not os.path.exists(search_path):
            print(f'  {rid:26s} -search.json 없음 — 건너뜀')
            continue
        with open(search_path, encoding='utf-8') as fh:
            pages = json.load(fh)
        before = '\n'.join(p['text'] for p in pages)
        ratio = spacing_ratio(before)
        if ratio >= BROKEN_BELOW:
            print(f'  {rid:26s} 띄어쓰기 {ratio*100:5.1f}%  정상 — 손대지 않음')
            continue

        doc = fitz.open(os.path.join(DIR, f'{rid}.pdf'))
        new_pages = [{'page': p['page'], 'text': respace_page(doc[p['page'] - 1])} for p in pages]
        doc.close()
        after = '\n'.join(p['text'] for p in new_pages)

        # 검증 — 공백을 지우면 완전히 같아야 한다
        squash = lambda s: re.sub(r'\s+', '', s)
        if squash(before) != squash(after):
            a, b = squash(before), squash(after)
            i = next((k for k in range(min(len(a), len(b))) if a[k] != b[k]), min(len(a), len(b)))
            print(f'  {rid:26s} ❌ 글자가 달라졌다 — 쓰지 않음 (길이 {len(a)}→{len(b)}, 첫 차이 {i})')
            print(f'      전: …{a[max(0,i-30):i+30]}…')
            print(f'      후: …{b[max(0,i-30):i+30]}…')
            continue

        new_ratio = spacing_ratio(after)
        print(f'  {rid:26s} 띄어쓰기 {ratio*100:5.1f}% → {new_ratio*100:5.1f}%  '
              f'(공백 +{len(after)-len(before):,}자)  ✅ 글자 동일')
        if APPLY:
            with open(search_path, 'w', encoding='utf-8') as fh:
                json.dump(new_pages, fh, ensure_ascii=False)
        changed.append(rid)

    print()
    if not APPLY:
        print(f'미리보기만 했다. 실제로 쓰려면 --apply ({len(changed)}개 문서 대상)')
    else:
        print(f'{len(changed)}개 문서를 다시 썼다. 이어서: node scripts/build-regulation-articles.mjs')


if __name__ == '__main__':
    main()
