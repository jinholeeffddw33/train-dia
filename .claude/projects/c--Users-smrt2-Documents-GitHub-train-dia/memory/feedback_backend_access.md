---
name: Supabase 백엔드 직접 작업 권한
description: 사용자가 Supabase 백엔드 관련 작업을 직접 수행해달라고 요청함. .env에 로컬 키 있음.
type: feedback
---

Supabase 백엔드 작업은 직접 수행할 것.

**Why:** 사용자가 .env에 Supabase 키를 로컬에 설정해두었고, 백엔드 관련 작업을 직접 처리해달라고 명시적으로 권한을 부여함.

**How to apply:** API 라우트, DB 스키마, Supabase 쿼리 등 백엔드 작업 시 사용자에게 되묻지 말고 직접 구현/수정할 것.