# DevLog Decisions

DevLog 프로젝트의 기술 결정 이력.
시간 역순 (최신 위).

매 결정 후 추가. 새 결정이 기존 결정과 충돌 시 명시적으로 폐기/수정 표시.

---

## 마일스톤 약어

- **M1**: 랜딩 페이지
- **M2**: 인증 시스템
  - M2.1: Supabase 클라이언트 초기화
  - M2.2: SSR 3파일 구조 분리
  - M2.3: 회원가입/로그인 UI
- **M3**: TIL CRUD
- **M4**: 대시보드
- **M5**: 배포

---

## 2026-04-27

### TDD 도입 결정
- **결정**: Jest + React Testing Library 도입, TDD 사이클(Red-Green-Refactor) 적용
- **근거**:
  - AI 출력은 비결정적 (같은 입력에도 다른 출력 가능)
  - 테스트가 "결과가 올바른가?"의 객관적 기준 역할
  - 새 기능 추가 시 기존 기능 회귀 방지를 위한 안전망
  - 증강 코딩(Augmented Coding) 방법론은 TDD를 전제로 작동. TDD가 빠지면 AI 출력 통제가 무너지고 vibe coding으로 회귀.
- **참조**: 켄트 벡의 증강 코딩(Augmented Coding) 개념 (2025)

### 프롬프트 양식 업그레이드 (완료 조건 섹션 추가)
- **결정**: prompts/ 파일 양식에 "완료 조건" 섹션 추가
- **근거**: 
  - AI는 자체 판단으로 "완료" 응답하지만 개발자 기대와 다를 수 있음
  - 구체적/측정 가능/검증 가능한 완료 조건이 있어야 객관적 검증 가능
  - 예: "빠르게 동작" → "API 응답 300ms 이내"
- **양식**: 메타정보 / 작업개요 / 작업대상 / 판단근거 / 구현요구사항 / 스코프경계 / **완료조건** / TDD적용여부 / 커밋계획 / Plan출력요구사항 / 실행결과

---

## 2026-04-26

### 비밀번호 확인 필드 유지
- **결정**: 회원가입 폼에 비밀번호 확인 필드 유지
- **근거**:
  - 운영 비용 (이메일 재설정 비용 직접 부담)
  - Show Password 토글의 육안 검증 한계
  - 한국 사용자 관습 (네이버, 카카오 등)
  - 포폴 맥락 (가입 전환율이 핵심 KPI 아님)
- **인지된 반대 의견**: UX Movement, Echobind 등 업계 주류는 제거 권장 (전환율 56.3% 증가)
- **결론 프레임**: 업계 무시 아닌 맥락 재해석

### Show Password 토글 미도입
- **결정**: 비밀번호 입력 필드에 Show Password 토글 추가하지 않음
- **근거**:
  - 토글 사용 시 사용자 비밀번호 검증을 시각 의존
  - 복잡한 비밀번호일수록 한 글자 오타 육안 발견 어려움
  - 결국 비밀번호 재설정 요청 증가 → 이메일 발송 비용 증가
  - (중요!) 1인 개발자가 감당하기 어려운 운영 비용
- **대체**: 비밀번호 확인 필드로 오타 방지
- **다른 의견**: UX Movement, NN/g (Nielsen Norman Group, 사용자 경험 컨설팅 기관) 등은 토글 권장
- **결론 프레임**: 업계 권고 무시 아닌 운영 비용 맥락 재해석
- **재검토 시점**: 사용자 트래픽/비용 데이터 누적 후

### 비밀번호 강도 표시 추가 (회원가입만)
- **결정**: 회원가입 폼에 비밀번호 강도 인디케이터 추가
- **근거**: 
  - 사용자가 비밀번호 강도를 시각적으로 인지하면 자연스럽게 강한 비밀번호 선택 유도 (강제 복잡도 규칙보다 효과적)
  - 강제 규칙(대소문자/숫자/특수문자 의무) 없이 길이 + 강도 표시로 유도하는 방향
- **참조**: NN/g 강도 표시 권장
- **적용 범위**: 회원가입 페이지만 (로그인 페이지 제외)

### 로그인/회원가입 페이지 컴포넌트 타입
- **결정**:
  - 로그인 페이지: Server Component
  - 회원가입 페이지: Client Component
- **근거**:
  - 로그인: 폼 제출만 필요 → Server Action으로 충분
  - 회원가입: 비밀번호 강도 실시간 계산 필요 → useState 필요 → Client 필수
- **참조**: CLAUDE.md "Required Patterns > Next.js 16" (Server Component 우선 원칙)

---

## 2026-04-23 ~ 2026-04-24

### M2.3 단계 분리 (5단계)
- **결정**: M2.3 회원가입+로그인 페이지를 5단계로 분리
- **단계**:
  1. layout.tsx (Server Component) — 4/23 커밋 8bdbb42
  2. globals.css @custom-variant 4개 — 4/24 커밋 338ccd8
  3. login/page.tsx
  4. signup/page.tsx
  5. 통합 검증
- **근거**:
  - AI 컨텍스트 윈도우 제한 대응 (한 번에 큰 작업 시 일관성 저하)
  - 실패 비용 최소화 (작은 단위 실패 시 토큰/시간 손실 적음)
  - 단계별 검증으로 회귀 조기 발견

### 프롬프트 기록 시스템 도입
- **결정**: docs/prompts/ 폴더에 NNNN-한국어-제목.md 형식으로 기록
- **번호 규칙**: 커밋 순서 = 프롬프트 파일 번호 (Initial commit = 0001)
- **양식**: 메타정보 / 작업개요 / 작업대상 / 판단근거 / 구현요구사항 / 스코프경계 / 커밋계획 / Plan출력요구사항 / 실행결과
- **커밋 규칙**: 프롬프트 파일은 해당 작업 커밋과 함께 staging
- **근거**: AI 협업 흔적 명시화, 면접 자료, 회고 자료

### 색상 토큰 미도입
- **결정**: @theme inline 색상 토큰 도입하지 않고 slate 직접 사용
- **근거**: 토큰 도입은 색상 변경 시점에 의미. 현재 단계에선 과도한 추상화
- **재검토 시점**: 멘토 컨펌 후 디자인 시스템 정립 시

---

## 2026-04-22

### @supabase/ssr 3파일 구조 (M2.2 완료)
- **결정**: lib/supabase/ 폴더에 client.ts / server.ts / middleware.ts 3파일 분리
- **근거**: Next.js 16 App Router 환경에서 Server Component, Client Component, Middleware 각각 다른 Supabase 클라이언트 필요
- **참조**: Supabase 공식 문서 @supabase/ssr 권장 패턴
- **커밋**: e58542b (refactor: Supabase 클라이언트를 SSR 구조 3파일로 분리)

### @supabase/auth-helpers-nextjs 사용 금지
- **결정**: deprecated 라이브러리이므로 사용 금지
- **대체**: @supabase/ssr 사용

### Co-Authored-By 트레일러 금지
- **결정**: 커밋 메시지에 Co-Authored-By 트레일러 사용하지 않음
- **근거**: AI 협업 흔적은 prompts/ 파일에서 명시적으로 관리. 커밋 트레일러는 중복.
- **커밋**: b10b58c (docs: CLAUDE.md에 Co-Authored-By 금지 규칙 추가)

---

## 2026-04-21

### @supabase/ssr 의존성 추가
- **결정**: Next.js 16 App Router 호환을 위해 @supabase/ssr 패키지 도입
- **근거**: SSR 환경에서 쿠키 기반 세션 관리 필요
- **커밋**: 03448e2 (chore: @supabase/ssr 의존성 추가)

---

## 2026-04-20

### CLAUDE.md 5섹션 구조 재편
- **결정**: CLAUDE.md를 5섹션 구조로 재편
- **섹션**: Context / Required Patterns / DO NOT / Conventions / Working Style
- **근거**: AI 기본 편향(구식 패턴) 교정, 하네스 엔지니어링 적용
- **커밋**: aa7fa97 (docs: CLAUDE.md를 5섹션 구조로 재편하고 규칙 보강)

### Supabase 클라이언트 의도 주석 추가
- **결정**: lib/supabase.ts에 의도 주석 추가
- **근거**: 단일 파일 구조의 한시적 사용임을 명시 (이후 SSR 3파일로 분리 예정)
- **커밋**: c83310e

---

## 2026-04-15

### Supabase 클라이언트 초기화 + 환경 변수 검증 (M2.1 완료)
- **결정**: lib/supabase.ts 단일 파일로 클라이언트 초기화, env 변수 검증 로직 포함
- **근거**: M2.1 최소 구현. 추후 SSR 3파일 구조로 리팩터링 예정.
- **커밋**: 00bf2fa (feat: Supabase 클라이언트 초기화 및 env 검증 추가)

### Claude Code 작업 가이드 도입 (CLAUDE.md 최초 작성)
- **결정**: 프로젝트 루트에 CLAUDE.md 작성, Claude Code와 협업 규칙 명시
- **근거**: 하네스 엔지니어링 시작점. AI의 즉흥적 행동 제약.
- **커밋**: 611ef99 (docs: Claude Code 작업 가이드 추가)

### DevLog 프로젝트 소개 및 로드맵 작성
- **결정**: README.md에 프로젝트 개요 + 마일스톤 로드맵 작성
- **근거**: 외부 가독성 + 자기 작업 추적
- **커밋**: 23db55a (docs: DevLog 프로젝트 소개 및 로드맵 추가)

---

## 2026-04-14

### 핵심 의존성 선택 (TanStack Query, Jotai, Supabase)
- **결정**: 서버 상태(TanStack Query), 클라이언트 상태(Jotai), DB+Auth(Supabase) 채택
- **근거**:
  - TanStack Query: 서버 상태 표준, Next.js App Router 호환
  - Jotai: 원자 단위 상태 관리, Redux 대비 경량
  - Supabase: BaaS로 백엔드 구축 시간 절감, 무료 티어 충분
- **커밋**: 1ad99fa (chore: TanStack Query, Jotai, Supabase 의존성 추가)

### DevLog 랜딩 페이지 추가 (M1 완료)
- **결정**: 첫 진입 페이지 작성
- **커밋**: c4f6fa7 (feat: DevLog 랜딩 페이지 추가)

---

## 2026-04-13

### 프로젝트 초기화 (Create Next App)
- **결정**: Next.js 16 App Router로 프로젝트 시작
- **근거**:
  - Next.js: React 풀스택 표준, Vercel 통합 배포
  - App Router: 최신 권장 (Pages Router 대비)
  - TypeScript: 타입 안전성
  - Tailwind CSS v4: 유틸리티 우선 + AI 친화적
- **커밋**: 7cfcd52 (Initial commit from Create Next App)