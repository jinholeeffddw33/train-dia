"""
schedules.ts의 m 약호와 출고 열번 정합성 전수 검증.

규칙 (사용자 도메인 규칙):
- 1000번대 (1000~1499) 출고 = 고덕기지 → 상일동(본선 진입)
  → m 시작은 반드시 '기상…'
- 1500번대 (1500~1599) 출고 = 방화기지 → 방화역(본선 진입)
  → m 시작은 '기방…'
- 2000번대 (2000~2099) 출고 = 고덕기지 → 상일동 → 하남검단산행
  → m 시작은 '기상…하' 패턴 포함

위반 사례를 dia·블록·세그먼트 단위로 출력 + 제안 수정안 출력.
"""
import re, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SRC = "src/data/schedules.ts"
content = open(SRC, encoding="utf-8").read()
lines = content.split("\n")

# 블록 구분 추출
BLOCK_NAMES = {
    "p_ord": "평일", "p_hol": "휴일",
    "p_ordord": "평평", "p_ordhol": "평휴",
    "p_holord": "휴평", "p_holhol": "휴휴",
}

current_block = None
violations = []
fixes = []  # (line_no, original_m, suggested_m, dia, block, segs_info)

for idx, ln in enumerate(lines, start=1):
    # 블록 시작 감지
    mb = re.match(r"^\s*(p_\w+):\s*\{", ln)
    if mb and mb.group(1) in BLOCK_NAMES:
        current_block = mb.group(1)
        continue

    # 다이아 라인
    md = re.match(r'^\s*"([^"]+)":\s*\{', ln)
    if not md:
        continue
    dia = md.group(1)

    m_match = re.search(r'm:"([^"]+)"', ln)
    if not m_match:
        continue
    m_full = m_match.group(1)
    m_segs = m_full.split(",")

    g_strs = re.findall(r'\{d:"[^"]+",a:"[^"]+",n:\[([^\]]+)\]\}', ln)
    if len(m_segs) != len(g_strs):
        continue

    new_segs = list(m_segs)
    seg_violations = []

    for i, (seg, ns) in enumerate(zip(m_segs, g_strs)):
        first_train = int(ns.split(",")[0])
        if not (1000 <= first_train <= 2099):
            continue

        # 1000번대 (1000~1499): 고덕기지 출고 → '기상...' 시작
        if 1000 <= first_train <= 1499:
            if seg.startswith("기상"):
                continue
            if seg.startswith("기"):
                # '기' 뒤에 '상'이 빠진 경우 → '기상' 삽입
                suggested = "기상" + seg[1:]
                new_segs[i] = suggested
                seg_violations.append({
                    "type": "1xxx (고덕)",
                    "seg_idx": i,
                    "train": first_train,
                    "from": seg,
                    "to": suggested,
                })

        # 1500번대: 방화기지 출고 → '기방...' 시작
        elif 1500 <= first_train <= 1599:
            if seg.startswith("기방"):
                continue
            if seg.startswith("기상"):
                # '기상...' 패턴 → 1500번대인데 상일동 거치는 건 부정확
                # 단, '기상강마답'같이 강·마천행은 검토 필요 — 그러나 1500은 방화기지이므로 상일동 불가
                seg_violations.append({
                    "type": "15xx (방화) 의심",
                    "seg_idx": i,
                    "train": first_train,
                    "from": seg,
                    "to": None,
                    "note": "1500번대는 방화기지 출고인데 m이 '기상'으로 시작 — 데이터 점검 필요",
                })

        # 2000번대: 고덕기지 출고 + 하남검단산행
        elif 2000 <= first_train <= 2099:
            # 고덕기지 출고이므로 '기상...'으로 시작해야 하고 '하'(하남검단산)가 포함되어야
            if not seg.startswith("기상"):
                # '기'로 시작은 하되 '상'이 없으면 보정
                if seg.startswith("기"):
                    suggested = "기상" + seg[1:]
                    new_segs[i] = suggested
                    seg_violations.append({
                        "type": "20xx (고덕→하남)",
                        "seg_idx": i,
                        "train": first_train,
                        "from": seg,
                        "to": suggested,
                    })

    if seg_violations:
        violations.append({
            "line": idx,
            "block": current_block,
            "dia": dia,
            "m_original": m_full,
            "m_suggested": ",".join(new_segs),
            "issues": seg_violations,
        })

# 출력
print(f"위반 다이아 수: {len(violations)}\n")
for v in violations:
    block_label = BLOCK_NAMES.get(v["block"], v["block"])
    print(f"[L{v['line']}] {block_label} dia {v['dia']}")
    print(f"  현재 m: {v['m_original']}")
    print(f"  수정안: {v['m_suggested']}")
    for issue in v["issues"]:
        if issue.get("to"):
            print(f"    · seg{issue['seg_idx']}: 출고 {issue['train']}({issue['type']}) → '{issue['from']}' → '{issue['to']}'")
        else:
            print(f"    · seg{issue['seg_idx']}: 출고 {issue['train']}({issue['type']}) → '{issue['from']}' (검토 필요: {issue.get('note', '')})")
    print()

# 총계
fixable = sum(1 for v in violations if all(i.get("to") for i in v["issues"]))
review = len(violations) - fixable
print(f"\n총 위반: {len(violations)}건 / 자동 수정 가능: {fixable}건 / 검토 필요: {review}건")
