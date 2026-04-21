@AGENTS.md

# DevLog Project

개발자 학습 기록 대시보드. 현재는 개인 + 지인 대상 프로토타입.

이 문서는 Claude Code와의 협업 규칙을 담는다.
다음 두 가지 개념을 적용해 구성했다:

- **하네스(Harness)**: AI 에이전트의 자율 행동에 제약을 걸어
  예측 가능한 범위에서 작업하게 만드는 규칙 구조
- **증강 코딩(Augmented Coding, Kent Beck)**: AI가 코드를 생성하되
  모든 단계를 사용자가 통제하는 협업 방식
  (Plan → 검토 → 승인 → 실행 → diff 검토 → 작동 확인 → 커밋)

규칙은 다섯 섹션으로 분류된다:
1. Context — 프로젝트 맥락
2. Required Patterns — 강제 패턴
3. DO NOT — 금지 행동
4. Conventions — 프로젝트 표준
5. Working Style — 증강 코딩 사이클 진입 조건

---

## 1. Context

### Environment
- OS: macOS
- Package Manager: npm
- Node: 20.x
- Editor: VS Code

### Tech Stack
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- TanStack Query (서버 상태)
- Jotai (클라이언트 상태)
- Supabase (DB + Auth, @supabase/ssr 기반 SSR 구조)
- Vercel (배포)

### Folder Structure
- `app/` — Next.js App Router
- `lib/` — Supabase 클라이언트, 유틸 함수
- 그 외 폴더는 필요할 때만 생성 (미리 잡지 않음)

---

## 2. Required Patterns

### Next.js 16
- 폼 제출은 Server Action 사용 (API Route 금지)
- 초기 데이터는 Server Component에서 직접 조회 (useEffect + fetch 금지)
- `params`, `searchParams`, `cookies()`는 async (반드시 `await` 붙여 접근)
- `middleware.ts` 대신 `proxy.ts` 사용
- TypeScript `PageProps<'/경로'>` 헬퍼 사용 가능

### Supabase
- 현재 `lib/supabase.ts` 단일 파일 (M2.1에서 생성)
- M2.2에서 `@supabase/ssr` 기반 3파일 구조로 분리 예정
  (`lib/supabase/client.ts` / `server.ts` / `middleware.ts`)
- `@supabase/auth-helpers-nextjs` 사용 금지 (deprecated)

---

## 3. DO NOT

- 사용자가 명시적으로 요청하지 않은 파일은 수정/생성 금지
- 기존 폴더 구조를 임의로 재배치 금지
- `.env.local`을 git에 커밋 금지
- 테스트가 실패하면 테스트를 수정하지 말고 사용자에게 보고
- Supabase RLS 정책을 임의로 변경 금지

---

## 4. Conventions

### Coding
- TypeScript strict 모드 유지
- 컴포넌트는 PascalCase, 변수/함수는 camelCase
- 폴더명은 kebab-case
- 한 파일 한 책임

### Commit
- 형식: `<type>: <한국어 설명>`
- type: feat, fix, refactor, style, chore, docs
- 파일 단위 X, 논리적 단위로 커밋
- 의존성 추가와 기능 구현은 별도 커밋
- 구조 변경(refactor)과 행동 변경(feat/fix)은 같은 커밋에 섞지 말 것
- Co-Authored-By 트레일러 사용 금지

---

## 5. Working Style

- Plan Mode로 계획 먼저, 사용자 승인 후 실행
- 한 번에 수정하는 파일 3개 이내
- 변경 후 뭘 왜 바꿨는지 짧게 설명
- 모르는 부분은 추측하지 말고 질문