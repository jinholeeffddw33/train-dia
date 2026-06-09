# 분재 실사 이미지 자산

ZenBonsai 모듈이 자동으로 읽어들이는 분재 이미지. 파일이 있으면 실사 이미지, 없으면 SVG 일러스트로 자동 폴백.

## 파일명 규칙

`{plantId}-{stage}.webp`

- `plantId`: 15종 — 기본 9종 + Tier 2 6종 (도감 완성자용)
- `stage`: 5단계 — `0`(씨앗) · `1`(새싹) · `2`(어린 나무) · `3`(자란 나무) · `4`(완성·꽃 핀 상태)

총 **15 × 5 = 75장** 필요.

## 권장 스펙

| 항목 | 값 |
|------|-----|
| 포맷 | **WebP** (PNG도 가능하나 용량↑) |
| 해상도 | **640 × 720** (3:3.5) |
| 배경 | **투명** (alpha channel) |
| 장당 크기 | 80~250KB |

## 통일된 아트 스타일

모든 식물·단계에서 같은 화분·각도·라이팅·배경 유지 → AI 프롬프트에 공통 키워드 고정 권장.

**공통 베이스 프롬프트 예** (Midjourney/SDXL):
```
small ceramic bonsai pot, traditional Korean ceramic, soft studio lighting,
shallow depth of field, isolated on transparent background, photorealistic,
top-down 30° angle, museum-quality, clean composition --ar 4:5 --style raw
```

**식물별 추가 키워드**

| plantId | 한국명 | 추가 프롬프트 |
|---------|--------|--------------|
| pine | 소나무 | Korean pine bonsai, gnarled trunk, dark green pine needles |
| maehwa | 매화 | Korean plum blossom bonsai, pale pink blossoms, dark slender branches |
| maple | 단풍 | Japanese maple bonsai, deep crimson autumn leaves |
| bamboo | 대나무 | dwarf bamboo, straight green culms, narrow leaves |
| orchid | 난초 | Korean orchid in shallow pot, lavender flowers, long arching leaves |
| camellia | 동백 | camellia bonsai, glossy dark green leaves, bright red blossoms |
| cherry | 벚나무 | cherry blossom bonsai, pale pink soft petals, spring atmosphere |
| chrysanthemum | 국화 | chrysanthemum bonsai, golden yellow flowers, fall season |
| ginkgo | 은행 | ginkgo bonsai, fan-shaped yellow autumn leaves, ancient gnarled trunk |
| mugunghwa | 무궁화 | rose of sharon (Korean national flower) bonsai, lavender purple blossoms with dark red center, deep green leaves |
| lotus | 연꽃 | lotus plant in shallow water bowl, pink lotus flower fully open, large round leaves above water |
| magnolia | 목련 | white magnolia bonsai, large creamy white petals, bare branches in early spring |
| birch | 자작나무 | birch bonsai, distinctive white papery bark, slender black-streaked trunk, small bright green leaves |
| hydrangea | 수국 | hydrangea bonsai, large rounded clusters of pale blue and pink flowers, lush green leaves |
| ancient | 천년 분재 | legendary ancient bonsai, gnarled and weathered thousand-year trunk, golden glow around it, mystic atmosphere, museum masterpiece |

**단계별 추가 프롬프트**

| stage | 설명 | 프롬프트 추가 |
|-------|------|--------------|
| 0 | 씨앗 | just planted soil, no growth, only seed visible, dark soil texture |
| 1 | 새싹 | tiny sprout, 1~2 small leaves, just emerging |
| 2 | 어린 나무 | small young plant, a few branches, sparse leaves |
| 3 | 자란 나무 | mature shape, full canopy, well-developed branches |
| 4 | 완성 | fully grown, abundant leaves/flowers in peak season, glorious appearance |

## 권장 생성 방식

1. **Midjourney** v6+ 또는 **SDXL** 사용
2. 15종 × 5단계 = 75회 생성 (기본 9종 먼저, Tier 2는 천천히)
3. PNG → WebP 변환 (cwebp 또는 squoosh.app, quality 85)
4. 알파 채널 보존 (`cwebp -q 85 -alpha_q 90 in.png -o out.webp`)
5. 파일명 정확히 맞춰 이 디렉토리에 배치
6. 새로고침 시 자동 반영

## 누락된 자산 처리

- 파일이 없거나 404면 `onError` 핸들러가 호출되어 이미지 unmount
- 기존 SVG 일러스트가 그대로 보임
- 즉, **일부만 만들어 넣어도 OK** — 만든 단계만 실사로 보이고 나머진 SVG
