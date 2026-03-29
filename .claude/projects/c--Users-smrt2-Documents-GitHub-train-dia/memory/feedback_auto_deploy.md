---
name: 자동 커밋·푸시·배포
description: 작업 완료 시 커밋/push/Vercel 배포까지 자동 수행, 확인 질문 금지
type: feedback
---

작업 완료 시 자동으로 커밋 → push → Vercel 배포까지 수행할 것.

**Why:** 사용자가 매번 확인하는 것을 원치 않음. main push 시 Vercel 자동 배포됨.

**How to apply:** 코드 수정 → npm run build 통과 → git add → git commit → git push origin main. "할까요?" 묻지 말고 바로 실행.