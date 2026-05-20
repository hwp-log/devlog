# Dotrip Project

Dotrip — 한국 콘텐츠 촬영지 탐방·기록·여행계획 플랫폼

이 문서는 AI 코딩 에이전트와의 협업 규칙을 담는다.
다음 두 가지 개념을 적용해 구성했다:

- **하네스(Harness)**: AI 에이전트의 자율 행동에 제약을 걸어
  예측 가능한 범위에서 작업하게 만드는 규칙 구조
- **증강 코딩(Augmented Coding, Naive)**: AI가 코드를 생성하되
  단계별로 사용자가 통제하는 협업 방식
  (바이브 → 검수 → 리팩토링 → 검수의 4단계 사이클)

규칙은 여섯 섹션으로 분류된다:
1. Context — 프로젝트 맥락
2. Required Patterns — 강제 패턴
3. DO NOT — 금지 행동
4. Conventions — 프로젝트 표준
5. Session & Workflow — 작업 흐름
6. Next.js 16 경고 — 학습 데이터 함정 안내

> Claude Code 전용 규칙 (Plan Mode 등)은 `CLAUDE.md` 참조.

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
- Jest + React Testing Library (3단계 : 리펙토링 시행 시, 진행하는 테스트)

### Folder Structure
- `app/` — Next.js App Router
- `lib/` — Supabase 클라이언트, 유틸 함수
- `__tests__/` — 각 폴더 내 테스트 (코드 옆에 배치)
- `docs/prompts/` — 회고 기록 (NNNN-한국어-제목.md)
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
- `lib/supabase/` 3파일 구조 (`client.ts` / `server.ts` / `middleware.ts`)
- `@supabase/auth-helpers-nextjs` 사용 금지 (deprecated)

### Build Cycle (4단계 사이클)

증강 코딩(Naive)을 단계별로 적용한다.
한 페이지 / 큰 기능을 다음 4단계로 작업한다.

| 묶음 | 단계 | 코드 상태 | 테스트 상태 | TDD? | 필수? |
|---|---|---|---|---|---|
| **전반부**: 바이브 + 검수 (필수) | 1차 | 작성 (바이브) | 없음 | X | 필수 |
|  | 2차 | 그대로 | TDD-Green 작동만 확인 | X | 필수 |
| **후반부**: 리팩토링 + 검수 (선택) | 3차 | 리팩토링 | 활용 + 추가 | O | 선택 |
|  | 4차 | PR | 검증 | - | 선택 |

1. **1차: 바이브** — 기능 단위로 작동하는 코드 작성
   - atomic 커밋 적용 (1개 기능 = 1개 커밋)
   - 테스트 없음 / 계획 단계 없음
   - 작동 확인 우선
   - 구조 / 중복 / 네이밍은 3차 리팩토링에서 개선

2. **2차: TDD-Green 작동만 확인** — 바이브 코딩의 작동여부 확인
   - 핵심 동작에 대한 그린 테스트 작성
   - 1차 코드는 그대로 유지
   - 회귀 방지용 안전망 확보

3. **3차: TDD 리팩토링 (선택)** — 가치 검증 후 진행
   - 계획 단계 필수 (영역 설정 → 플랜 → 컨펌 → AI 리팩토링 → 검증)
   - Red-Green-Refactor 사이클 적용
   - atomic 커밋 적용
   - 검토 우선순위 ★★★★★ ~ ★★ 영역만 진행 (★ 스킵)

4. **4차: PR + 멘토 리뷰 (선택)** — 최종 검증
   - PR 생성
   - 멘토 리뷰 대기
   - 피드백 반영

**커밋 단위**:
- 1개 기능 = 1개 커밋 (atomic)
- 너무 잘게 나누지 않음 (균형 유지)
- 예시: "feat: StreakWidget 추가" / "feat: 헤더 사용자 정보 추가" / "style: 호버 효과 추가"

**회고 단위**:
- 1차 바이브 묶음 = 회고 1개
- 3차 리팩토링 묶음 = 회고 1개

### Review Priority (코드 검토 우선순위)

AI 생성 코드는 다음 우선순위로 검토한다.
모든 코드를 동등하게 검토하지 않음 (Naive 증강 코딩).

| 등급 | 범위 | 검토 깊이 |
|---|---|---|
| ★★★★★ | 비즈니스 로직 / 보안 / 인증 / 결제 / 외부 API | 줄 단위 검토 + 의도 확인 |
| ★★★★ | 데이터 무결성 / DB 변경 / 마이그레이션 | 영향 범위 검토 |
| ★★★ | 성능 / 아키텍처 / 상태 관리 구조 | 구조 검토 |
| ★★ | 단순 유틸 / 헬퍼 함수 | 테스트 통과 시 OK |
| ★ (스킵) | 보일러플레이트 / UI 디테일 / import / 타입 정의 | 스킵 가능 |

---

## 3. DO NOT

- 사용자가 명시적으로 요청하지 않은 파일은 수정/생성 금지
- 기존 폴더 구조를 임의로 재배치 금지
- `.env.local`을 git에 커밋 금지
- 테스트가 실패하면 테스트를 수정하지 말고 사용자에게 보고
- Supabase RLS 정책을 임의로 변경 금지

### Testing 관련 금지 (3차 리팩토링 시점에만 강제)

1차 바이브 시점에는 테스트 없이 구현 OK.
3차 리팩토링 진입 후에는 다음 강제:

- 테스트 없이 구현 코드 변경 금지
- 테스트와 구현을 동시에 작성 금지 (Red 단계 누락)
- 테스트 skip 또는 주석 처리 금지
- expect 조건을 느슨하게 변경 금지
- 실패 원인 분석 없이 테스트 수정 금지

---

## 4. Conventions

### Coding
- TypeScript strict 모드 유지
- 컴포넌트는 PascalCase, 변수/함수는 camelCase
- 폴더명은 kebab-case
- 한 파일 한 책임

### Testing
- 테스트 파일 위치: 코드 폴더 안 `__tests__/` 폴더
- 명명 규칙: `[원본파일이름].test.ts`
- 예: `actions.ts` → `__tests__/actions.test.ts`
- 테스트명은 동작을 설명하도록 의미 있게 작성
  - 예: `should return error when email is invalid`

### Commit
- 형식: `<type>: <한국어 설명>`
- type: feat, fix, refactor, style, chore, docs, test
- 1개 기능 = 1개 커밋 (atomic)
- 의존성 추가와 기능 구현은 별도 커밋
- 구조 변경(refactor)과 행동 변경(feat/fix)은 같은 커밋에 섞지 말 것
- Co-Authored-By 트레일러 사용 금지

### Prompt Records (회고)
- 위치: `docs/prompts/NNNN-한국어-제목.md`
- 번호: 회고 순서 = 프롬프트 파일 번호
- 묶음 단위:
  - 1차 바이브 묶음 = 회고 1개
  - 3차 리팩토링 묶음 = 회고 1개
- 양식 (5섹션 경량):
  1. 한 줄 요약
  2. 왜 / 목적 / 이유 (사고 본질)
  3. 작성한 프롬프트
  4. 코드 작성 & 수정 (실제 코드 블록 포함)
  5. 결과 / 배운점
- **회고 작성 시 반드시 `docs/prompts/0099-회고-작성-예시.md` 참고**
- 회고 파일은 해당 묶음 마지막 커밋과 함께 staging

---

## 5. Session & Workflow

- 한 작업 묶음 (NNNN 번호) = 한 세션
- 새 세션 시작 시 첫 프롬프트에 이전 작업 내용 명시
- **기술 결정 검색**: `docs/prompts/` 폴더 전체에서 검색 (각 회고 마지막 "## 결정 (Decisions)" 섹션)
- **초기 결정 검색(4/13 ~ 4/24)**: `docs/prompts/0000-초기-결정-정리.md` 참고
- 사이클 종료 시 `docs/prompts/NNNN-제목.md` 작성

### 공통 작업 원칙

- 한 번에 수정하는 파일 3개 이내
- 변경 후 뭘 왜 바꿨는지 짧게 설명
- 모르는 부분은 추측하지 말고 질문

---

## 6. Next.js 16 경고

이 프로젝트는 당신이 아는 Next.js가 아니다.

이 버전은 breaking change가 있다 — API, 컨벤션, 파일 구조가 학습 데이터와 다를 수 있다. 코드 작성 전에 반드시 `node_modules/next/dist/docs/` 안의 관련 문서를 읽을 것. deprecation 안내를 주의 깊게 확인할 것.