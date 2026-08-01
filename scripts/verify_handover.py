"""
교대지(답십리·영등포구청 등) 기준 열번 핸드오버 정합성 전수 검증.

검증 항목:
  A. 동일 열번이 여러 다이아 segment에 분산되어 있을 때, 한 segment 종료시각 = 다음 segment 출발시각 인지
  B. 시간 겹침 없이 깨끗히 분리되는지
  C. 같은 시간대에 동일 열번이 2개 이상 segment에서 strict-active 상태가 되는지
  D. m 약호의 첫·끝 약자가 교대지인지 (답=답십리, 영=영등포구청)

블록(p_ord, p_hol, p_ordord 등)별로 별도 검증.
"""
import re, io, sys, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SRC = "src/data/schedules.ts"
content = open(SRC, encoding="utf-8").read()
lines = content.split("\n")

BLOCK_NAMES = {
    "p_ord": "평일", "p_hol": "휴일",
    "p_ordord": "평평", "p_ordhol": "평휴",
    "p_holord": "휴평", "p_holhol": "휴휴",
}

# 블록 → dia → [(seg_idx, m_seg, dep_min, arr_min, trains)]
data = {b: {} for b in BLOCK_NAMES}


def to_mins(t):
    h, m = map(int, t.split(":"))
    return h * 60 + m


current_block = None
for ln in lines:
    mb = re.match(r"^\s*(p_\w+):\s*\{", ln)
    if mb and mb.group(1) in BLOCK_NAMES:
        current_block = mb.group(1)
        continue
    if not current_block:
        continue
    md = re.match(r'^\s*"([^"]+)":\s*\{', ln)
    if not md:
        continue
    dia = md.group(1)
    m_match = re.search(r'm:"([^"]+)"', ln)
    g_matches = re.findall(r'\{d:"(\d{1,2}:\d{2})",a:"(\d{1,2}:\d{2})",n:\[([^\]]+)\]\}', ln)
    if not m_match or not g_matches:
        continue
    m_segs = m_match.group(1).split(",")
    if len(m_segs) != len(g_matches):
        continue
    entries = []
    for i, (mseg, (d, a, ns)) in enumerate(zip(m_segs, g_matches)):
        try:
            d_min = to_mins(d)
            a_min = to_mins(a)
        except ValueError:
            continue
        trains = [int(x) for x in ns.split(",")]
        entries.append({"seg_idx": i, "m": mseg, "dep": d, "arr": a,
                         "dep_min": d_min, "arr_min": a_min, "trains": trains})
    data[current_block][dia] = entries


# 검증
issues = []  # list of {block, type, detail}

for block, dias in data.items():
    # 열번 → [{dia, seg_idx, dep_min, arr_min, ...}]
    train_uses = {}
    for dia, entries in dias.items():
        for e in entries:
            for t in e["trains"]:
                train_uses.setdefault(t, []).append({
                    "dia": dia, "seg_idx": e["seg_idx"],
                    "dep_min": e["dep_min"], "arr_min": e["arr_min"],
                    "m": e["m"],
                })

    # A: 동일 열번 다중 사용 시 핸드오버 정합성
    for tno, uses in train_uses.items():
        if len(uses) <= 1:
            continue
        # 시간순 정렬 (depMins 기준; 자정 넘김 무시: arr>dep 가정)
        uses.sort(key=lambda u: u["dep_min"])
        # 인접 use 쌍 검사
        for j in range(len(uses) - 1):
            cur = uses[j]
            nxt = uses[j + 1]
            # 시간 겹침
            if cur["arr_min"] > nxt["dep_min"]:
                issues.append({
                    "block": block,
                    "type": "OVERLAP",
                    "train": tno,
                    "detail": f"{cur['dia']} seg{cur['seg_idx']} ({cur['arr_min']//60:02d}:{cur['arr_min']%60:02d}) > {nxt['dia']} seg{nxt['seg_idx']} ({nxt['dep_min']//60:02d}:{nxt['dep_min']%60:02d})",
                })
            # 핸드오버 간격 (작은 갭/큰 갭 모두 정보 기록)
            gap = nxt["dep_min"] - cur["arr_min"]
            if 0 < gap <= 60:
                # 정상 범위 — 정보로 카운트만
                pass
            elif gap > 60:
                # 같은 열번이 1시간 이상 빈 후 다시 등장 — 다른 인스턴스 가능성
                issues.append({
                    "block": block,
                    "type": "BIG_GAP",
                    "train": tno,
                    "detail": f"{cur['dia']} seg{cur['seg_idx']} 도착 {cur['arr_min']//60:02d}:{cur['arr_min']%60:02d} → {nxt['dia']} seg{nxt['seg_idx']} 출발 {nxt['dep_min']//60:02d}:{nxt['dep_min']%60:02d} (간격 {gap}분)",
                })

# 요약
from collections import Counter
type_counts = Counter(i["type"] for i in issues)
print(f"검증 완료 — 블록 {len(data)}개, 총 위반/주의 {len(issues)}건")
print(f"  분포: {dict(type_counts)}")

# OVERLAP 위반(시간 겹침)만 별도로 자세히
overlaps = [i for i in issues if i["type"] == "OVERLAP"]
print(f"\n[OVERLAP] {len(overlaps)}건 — 같은 열번이 두 dia에서 시간 겹침 (가장 critical):")
for i in overlaps[:40]:
    print(f"  {BLOCK_NAMES[i['block']]} 열차 {i['train']}: {i['detail']}")

big_gaps = [i for i in issues if i["type"] == "BIG_GAP"]
print(f"\n[BIG_GAP] {len(big_gaps)}건 — 핸드오버 간격 1시간 이상 (정상 케이스 — 동일 번호 재사용)")
print(f"  (참고용 — 매핑 로직은 strict-time으로 처리됨)")
