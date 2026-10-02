"""
규정 본문 쪽 → 원문 PDF 쪽 대응표 생성.

왜 필요한가
  규정 뷰어의 «원문 PDF» 버튼은 지금 보고 있는 본문 쪽 번호로 PDF 를 연다(#page=N).
  본문(-search.json)과 PDF 가 같은 파일에서 나왔으면 쪽이 같지만, 개정판 PDF 만 갈아 끼우면
  쪽이 어긋난다 — 2026-10 개정판은 규정 시스템에서 받은 PDF 라 표·별표가 빠져 쪽 수부터 다르다
  (운전취급규정 134쪽 → 102쪽). 본문은 표·별표를 살려 두었기 때문에 본문을 PDF 로 다시 뽑을 수도 없다.
  그래서 «같은 조문이 있는 PDF 쪽»으로 이어 준다.

  출력  public/data/edu/regulations/{id}-pdfmap.json   { "pages": { "본문쪽": PDF쪽, … } }
  본문 쪽의 첫 조문이 PDF 몇 쪽에 있는지로 정한다. 조문이 시작되지 않는 쪽은 앞 쪽을 따르고,
  부칙 뒤(별표·별지 — PDF 에 없음)는 PDF 마지막 쪽으로 보낸다.
  대응표가 없는 규정은 뷰어가 예전처럼 같은 쪽 번호로 연다.

사용: python scripts/build-regulation-pdfmap.py 규정id [규정id …]
"""
import io
import json
import re
import sys

import pymupdf

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

DIR = "public/data/edu/regulations"
# 줄 맨 앞의 «제N조(제목)» 만 조문 시작이다 — 본문 인용(«규정 제10조에 의거»)은 줄 중간에 온다
HEAD = re.compile(r"(?m)^[ \t]*제\s*(\d+)\s*조\s*\(")
BUCHIK = re.compile(r"(?m)^[ \t]*부\s*칙")


def first_positions(texts):
    """조문 번호 → 처음 나오는 쪽(1부터). 번호가 거꾸로 가는 인용은 건너뛴다."""
    pos, last = {}, 0
    for i, t in enumerate(texts, 1):
        body = t
        for m in HEAD.finditer(body):
            n = int(m.group(1))
            if n in pos or n < last:
                continue
            pos[n] = i
            last = n
    return pos


def build(rid):
    pdf = pymupdf.open(f"{DIR}/{rid}.pdf")
    ptexts = [p.get_text() for p in pdf]
    pdf_pos = first_positions(ptexts)
    pages = json.load(open(f"{DIR}/{rid}-search.json", encoding="utf-8"))

    # PDF 에서 부칙이 시작되는 쪽 — 본문이 부칙에 들어서면 거기로 보낸다
    pdf_buchik = next((i for i, t in enumerate(ptexts, 1) if BUCHIK.search(t)), len(ptexts))
    out, cur, tail = {}, 1, False
    for p in pages:
        t = p["text"]
        if not tail:
            b = BUCHIK.search(t)
            heads = [int(m.group(1)) for m in HEAD.finditer(t[: b.start()] if b else t)]
            hit = next((pdf_pos[n] for n in heads if n in pdf_pos), None)
            if hit:
                cur = max(cur, hit)
            if b:
                tail = True
                if not heads:
                    cur = max(cur, pdf_buchik)
        else:
            # 부칙 다음 쪽부터 — 부칙 나머지와 별표·별지(PDF 에는 없다)는 PDF 마지막 쪽으로
            cur = len(ptexts)
        out[str(p["page"])] = cur
    json.dump({"pages": out}, open(f"{DIR}/{rid}-pdfmap.json", "w", encoding="utf-8"), ensure_ascii=False)
    miss = sorted(set(first_positions([p["text"] for p in pages])) - set(pdf_pos))
    print(f"{rid:24} 본문 {len(pages):>3}쪽 → PDF {len(ptexts):>3}쪽 · PDF 에서 못 찾은 조문 {miss[:12]}")


if __name__ == "__main__":
    ids = [a for a in sys.argv[1:] if not a.startswith("-")]
    if not ids:
        sys.exit("규정 id 를 주세요 — 예: python scripts/build-regulation-pdfmap.py operation-rules")
    for rid in ids:
        build(rid)
