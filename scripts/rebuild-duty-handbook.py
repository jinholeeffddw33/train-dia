"""
기관사 기본직무수행 교안.pdf → handbook.json ch1 재구성
- 기존 ch1, ch4를 삭제하고 새 ch1(기관사 기본업무 교안)으로 대체
- 각 섹션은 PDF 원본 이미지 + 텍스트 검색용 콘텐츠
"""
import fitz
import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

PDF_PATH = 'D:/업로드용/기관사 기본직무수행 교안.pdf'
HANDBOOK_PATH = 'c:/Users/smrt2/Documents/GitHub/train-dia/public/data/edu/handbook.json'
IMG_BASE = '/images/edu/duty'

# 목차 정의 (PDF 페이지 번호 기준, p1=표지 생략)
TOC = [
    {"id": "duty-01", "title": "승무본부 실천사항", "pages": [3]},
    {"id": "duty-02", "title": "기관사 주요업무", "pages": [4]},
    {"id": "duty-03", "title": "운전업무 수행 시 준수사항", "pages": [5]},
    {"id": "duty-04", "title": "기관사 기본직무 방법", "pages": [6, 7, 8, 9]},
    {"id": "duty-05", "title": "차량기지 출고요령", "pages": [10, 11, 12]},
    {"id": "duty-06", "title": "차량기지 입고요령", "pages": [13]},
    {"id": "duty-07", "title": "전동차 기동/정지 요령", "pages": [14]},
    {"id": "duty-08", "title": "출발전 시험요령(PDT)", "pages": [15]},
    {"id": "duty-09", "title": "열차무선전화 사용요령 / 열차운전 준비사항", "pages": [16]},
    {"id": "duty-10", "title": "ATC 장치 고장시", "pages": [17]},
    {"id": "duty-11", "title": "운전모드", "pages": [18]},
    {"id": "duty-12", "title": "반복역 회차요령 / 지도승무 보고요령", "pages": [19]},
    {"id": "duty-13", "title": "안내방송 / 객실냉난방 취급기준", "pages": [20]},
    {"id": "duty-14", "title": "출입문 취급요령 및 승강장안전문", "pages": [21, 22]},
    {"id": "duty-15", "title": "기본운전취급 절차 / 운전실 주요기기", "pages": [23, 24, 25, 26]},
    {"id": "duty-16", "title": "운전관계 신호일반", "pages": [27]},
    {"id": "duty-17", "title": "신호에 따른 운전취급", "pages": [28, 29, 30]},
    {"id": "duty-18", "title": "선로전환기 정반위 표시등", "pages": [31, 32]},
    {"id": "duty-19", "title": "지적확인 환호 요령", "pages": [33, 34, 35, 36, 37]},
    {"id": "duty-20", "title": "운전관계규정", "pages": [38, 39, 40]},
]

# PDF 텍스트 추출
doc = fitz.open(PDF_PATH)
page_texts = {}
for i in range(1, doc.page_count):
    pnum = i + 1
    text = doc[i].get_text().strip().replace(chr(0xf000), '')
    page_texts[pnum] = text
doc.close()

# 빈 페이지(p2) 건너뜀 — 이미지는 있지만 섹션에 포함 안 함

# 섹션 생성
sections = []
for item in TOC:
    blocks = []
    # 각 페이지를 이미지 블록 + 검색용 텍스트로 추가
    for pnum in item["pages"]:
        # 이미지 블록
        blocks.append({
            "type": "image",
            "src": f"{IMG_BASE}/duty_p{pnum:02d}.webp",
            "caption": ""
        })
        # 텍스트 블록 (검색용 — 화면에는 이미지가 보임)
        text = page_texts.get(pnum, "")
        if text:
            blocks.append({
                "type": "searchText",
                "content": text
            })

    sections.append({
        "id": item["id"],
        "title": item["title"],
        "blocks": blocks
    })

# 새 ch1 챕터
new_ch1 = {
    "id": "ch1",
    "title": "기관사 기본업무 교안",
    "icon": "🚆",
    "sections": sections
}

# handbook.json 업데이트
with open(HANDBOOK_PATH, 'r', encoding='utf-8') as f:
    handbook = json.load(f)

# ch1, ch4 제거하고 새 ch1 삽입
new_chapters = []
ch1_inserted = False
for ch in handbook["chapters"]:
    if ch["id"] == "ch1":
        new_chapters.append(new_ch1)
        ch1_inserted = True
    elif ch["id"] == "ch4":
        continue  # ch4 삭제 (기본업무에 통합)
    else:
        new_chapters.append(ch)

if not ch1_inserted:
    new_chapters.insert(0, new_ch1)

handbook["chapters"] = new_chapters

# 저장
with open(HANDBOOK_PATH, 'w', encoding='utf-8') as f:
    json.dump(handbook, f, ensure_ascii=False, indent=2)

print(f"완료: ch1 = {len(sections)}개 섹션, ch4 삭제")
print(f"총 챕터: {len(new_chapters)}개")
for ch in new_chapters:
    hidden = " (hidden)" if ch.get("hidden") else ""
    print(f"  {ch['id']}: {ch['title']}{hidden}")
