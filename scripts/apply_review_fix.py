"""
사용자가 직접 제공한 5건 m 약호 수정.
"""
import re, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SRC = "src/data/schedules.ts"
content = open(SRC, encoding="utf-8").read()
lines = content.split("\n")

# (line_no(1-based), dia, seg_idx, new_value)
FIXES = [
    (147, "79", 1, "기방화마답"),  # 평평
    (223, "79", 1, "기방화마답"),  # 휴평
    (228, "84", 1, "기방마답"),    # 휴평
    (261, "79", 1, "기방화방"),    # 휴휴 (사용자 입력 그대로)
    (266, "84", 1, "기방마답"),    # 휴휴
]

for ln_no, dia, seg_idx, new_val in FIXES:
    idx = ln_no - 1
    ln = lines[idx]
    # 안전 검증: 다이아 키 일치
    md = re.match(r'^(\s*"' + re.escape(dia) + r'":\s*\{.*?m:")([^"]+)(".*)$', ln)
    if not md:
        print(f"L{ln_no}: dia {dia} 매칭 실패 — 스킵")
        continue
    prefix, m_field, suffix = md.group(1), md.group(2), md.group(3)
    segs = m_field.split(",")
    if seg_idx >= len(segs):
        print(f"L{ln_no}: seg_idx {seg_idx} 초과 — 스킵")
        continue
    old_val = segs[seg_idx]
    segs[seg_idx] = new_val
    new_m = ",".join(segs)
    new_ln = prefix + new_m + suffix
    lines[idx] = new_ln
    print(f"L{ln_no} dia {dia} seg{seg_idx}: '{old_val}' → '{new_val}'")

open(SRC, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
print("\n저장 완료.")
