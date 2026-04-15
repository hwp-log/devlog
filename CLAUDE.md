@AGENTS.md

# DevLog Project

개발자 학습 기록 대시보드. 현재는 개인 + 지인 대상 프로토타입.

## Environment
- OS: macOS
- Package Manager: npm
- Node: 20.x
- Editor: VS Code

## Tech Stack
- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- TanStack Query (서버 상태)
- Jotai (클라이언트 상태)
- Supabase (DB + Auth)
- Vercel (배포)

## Folder Structure
- `app/` — Next.js App Router
- `lib/` — Supabase 클라이언트, 유틸 함수
- 그 외 폴더는 필요할 때만 생성 (미리 잡지 않음)

## Coding Conventions
- TypeScript strict 모드 유지
- 컴포넌트는 PascalCase, 변수/함수는 camelCase
- 폴더명은 kebab-case
- 한 파일 한 책임

## Commit Convention
- 형식: `<type>: <한국어 설명>`
- type: feat, fix, refactor, style, chore, docs
- 파일 단위 X, 논리적 단위로 커밋
- 의존성 추가와 기능 구현은 별도 커밋
- **구조 변경(refactor)과 행동 변경(feat/fix)은 같은 커밋에 섞지 말 것**

## Critical Rules — DO NOT
- 사용자가 명시적으로 요청하지 않은 파일은 수정/생성 X
- 기존 폴더 구조를 임의로 재배치 X
- `.env.local`을 git에 커밋 X
- 테스트가 실패하면 테스트를 수정하지 말고 사용자에게 보고
- Supabase RLS 정책을 임의로 변경 X

## Working Style
- Plan Mode로 계획 먼저, 사용자 승인 후 실행
- 한 번에 수정하는 파일 3개 이내
- 변경 후 뭘 왜 바꿨는지 짧게 설명
- 모르는 부분은 추측하지 말고 질문