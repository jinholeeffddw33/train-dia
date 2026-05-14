"""
schedules.ts의 m 약호 정합성 자동 수정.
1000번대(1xxx) / 2000번대(20xx) 출고로 시작하는 세그먼트의 m이 '기상'으로 시작 안 하면 '기상' 삽입.
1500번대는 별도 검토 필요로 두고 건드리지 않음.
"""
import re, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

SRC = "src/data/schedules.ts"
content = open(SRC, encoding="utf-8").read()
lines = content.split("\n")

fixed_count = 0
fix_log = []

for idx, ln in enumerate(lines):
    md = re.match(r'^(\s*"[^"]+":\s*\{.*?m:")([^"]+)("[^}]*?g:\[)(.+)(\]\}.*)$', ln)
    if not md:
        continue
    prefix, m_field, mid, g_inner, suffix = md.group(1), md.group(2), md.group(3), md.group(4), md.group(5)
    m_segs = m_field.split(",")
    g_strs = re.findall(r'\{d:"[^"]+",a:"[^"]+",n:\[([^\]]+)\]\}', g_inner)
    if len(m_segs) != len(g_strs):
        continue

    new_segs = list(m_segs)
    changed = False
    for i, (seg, ns) in enumerate(zip(m_segs, g_strs)):
        try:
            first_train = int(ns.split(",")[0])
        except ValueError:
            continue
        # 1000-1499 또는 2000-2099
        in_1xxx = 1000 <= first_train <= 1499
        in_20xx = 2000 <= first_train <= 2099
        if not (in_1xxx or in_20xx):
            continue
        if seg.startswith("기상"):
            continue
        if seg.startswith("기"):
            new_seg = "기상" + seg[1:]
            new_segs[i] = new_seg
            changed = True
            fix_log.append({
                "line": idx + 1,
                "train": first_train,
                "from": seg,
                "to": new_seg,
            })

    if changed:
        new_m = ",".join(new_segs)
        # 원본 라인에서 m 필드만 정확히 교체
        new_ln = prefix + new_m + mid + g_inner + suffix
        lines[idx] = new_ln
        fixed_count += 1

# 저장
open(SRC, "w", encoding="utf-8", newline="\n").write("\n".join(lines))

print(f"수정된 다이아 라인 수: {fixed_count}")
print(f"수정된 세그먼트 수: {len(fix_log)}\n")
for f in fix_log:
    print(f"  L{f['line']:>4} train {f['train']} : '{f['from']}' → '{f['to']}'")
