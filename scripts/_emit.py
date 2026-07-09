# -*- coding: utf-8 -*-
import json
data=json.load(open("scripts/_route_data.json",encoding="utf8"))

def seg_ts(s):
    vb=",".join(str(x) for x in s['viewBox'])
    paths=",".join('"%s"'%p for p in s['paths'])
    nodes=",".join('{x:%s,y:%s}'%(n['x'],n['y']) for n in s['nodes'])
    pills=",".join('{t:"%s",x:%s,y:%s%s}'%(p['t'],p['x'],p['y'],(',hs:true' if p.get('hs') else '')) for p in s['pills'])
    def txt(t):
        extra=(',anchor:"%s"'%t['anchor']) if t.get('anchor') and t['anchor']!='start' else ''
        extra+=',dep:true' if t.get('dep') else ''
        return '{t:"%s",x:%s,y:%s,kind:"%s"%s}'%(t['t'],t['x'],t['y'],t['kind'],extra)
    texts=",".join(txt(t) for t in s['texts'])
    return '{viewBox:[%s],paths:[%s],nodes:[%s],pills:[%s],texts:[%s]}'%(vb,paths,nodes,pills,texts)

def dia_ts(segs): return '{segs:[%s]}'%(",".join(seg_ts(s) for s in segs))

lines=[]
lines.append('// ⚠️ 자동 생성 (scripts/gen_route_diagrams.py) — 직접 수정 금지. 원본: 답십리사업소_행로표 .xlsm')
lines.append("import { isHoliday } from '@/lib/schedule';")
lines.append("""
export interface RDText { t: string; x: number; y: number; anchor?: 'start'|'end'|'middle'; kind: 'time'|'km'; dep?: boolean }
export interface RDPill { t: string; x: number; y: number; hs?: boolean }
export interface RDSeg { viewBox: [number,number,number,number]; paths: string[]; nodes: {x:number;y:number}[]; pills: RDPill[]; texts: RDText[] }
export interface RDDiagram { segs: RDSeg[] }
""")
for v in data:
    entries=",".join('"%s":%s'%(dn,dia_ts(segs)) for dn,segs in sorted(data[v].items(),key=lambda kv:int(kv[0])))
    lines.append('const V_%s: Record<string, RDDiagram> = {%s};'%(v,entries))
allv=",".join('"%s":V_%s'%(v,v) for v in data)
lines.append('const BY_VARIANT: Record<string, Record<string, RDDiagram>> = {%s};'%allv)
night=sorted(set(dn for dn in data.get('평평',{})),key=int)
lines.append('const NIGHT_DIAS: ReadonlySet<string> = new Set([%s]);'%(",".join('"%s"'%d for d in night)))
lines.append('''
/** 교번+날짜 → 행로도. 현재는 '평일 주간근무'만 라이브(야간·휴일은 미검증 → 미표시, 기존 텍스트 유지) */
export function getRouteDiagram(dia?: string | null, date?: Date): RDDiagram | undefined {
  if (!dia) return undefined;
  const key = dia.replace(/\\D/g, '');
  if (NIGHT_DIAS.has(key)) return undefined;          // 야간 미표시
  const d = date ?? new Date();
  if (isHoliday(d)) return undefined;                  // 휴일 미표시
  return BY_VARIANT['평일']?.[key];                    // 평일 주간만
}
''')
open("src/data/routeDiagrams.ts","w",encoding="utf8").write("\n".join(lines))
print("wrote src/data/routeDiagrams.ts", sum(len(v) for v in data.values()),"diagrams")

# 몽타주 (평평 야간)
html=['<title>행로도 검증 — 평평</title><style>body{margin:0;background:#0f172a;font-family:sans-serif;padding:16px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px}',
'.c{background:#1e293b;border:1px solid rgba(148,163,184,.14);border-radius:12px;padding:8px}',
'.h{font-size:13px;color:#a78bfa;font-weight:700;margin-bottom:4px}svg{display:block;width:100%;height:auto}',
'.ln{stroke:#f1f5f9;stroke-width:2;fill:none}.nd{fill:#f1f5f9}.tm{font-size:13px;fill:#94a3b8;paint-order:stroke;stroke:#1e293b;stroke-width:3px}',
'.dep{font-size:17px;font-weight:800;fill:#f1f5f9;paint-order:stroke;stroke:#1e293b;stroke-width:3.5px}.km{font-size:13px;font-weight:800;fill:#ef4444}',
'.pill{fill:#1e293b;stroke:#8b5cf6;stroke-width:1.3}.px{font-size:13px;font-weight:700;fill:#f1f5f9}',
'.pillhs{fill:#1a2e05;stroke:#a3e635;stroke-width:2}.pxhs{font-size:13px;font-weight:800;fill:#d9f99d}</style>']
def svg(s):
    e=['<svg viewBox="%s">'%(" ".join(str(x) for x in s['viewBox']))]
    for p in s['paths']: e.append('<path class="ln" d="%s"/>'%p)
    for n in s['nodes']: e.append('<circle class="nd" cx="%s" cy="%s" r="4"/>'%(n['x'],n['y']))
    for t in s['texts']:
        cls={'time':'tm','km':'km'}[t['kind']]; 
        if t.get('dep'): cls='dep'
        a=t.get('anchor','start')
        e.append('<text class="%s" x="%s" y="%s" text-anchor="%s">%s</text>'%(cls,t['x'],t['y'],a,t['t']))
    for p in s['pills']:
        pc='pillhs' if p.get('hs') else 'pill'; tc='pxhs' if p.get('hs') else 'px'
        e.append('<g><rect class="%s" x="%s" y="%s" width="46" height="22" rx="11"/><text class="%s" x="%s" y="%s" text-anchor="middle">%s</text></g>'%(pc,p['x'],p['y'],tc,p['x']+23,p['y']+15,p['t']))
    e.append('</svg>'); return "".join(e)
for dn,segs in sorted(data['평평'].items(),key=lambda kv:int(kv[0])):
    for i,s in enumerate(segs):
        html.append('<div class="c"><div class="h">교번 %s · %d근무</div>%s</div>'%(dn,i+1,svg(s)))
open("scripts/_montage.html","w",encoding="utf8").write("".join(html))
print("wrote montage")
