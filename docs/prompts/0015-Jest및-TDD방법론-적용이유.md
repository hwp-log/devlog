# 0015 - Jest및 TDD 방법론 적용이유

## 메타정보

- **작성일**: 2026-04-28
- **커밋 번호**: 0015
- **작업 유형**: chore (테스트 환경 구성)
- **소요 시간**: 약 1세션
- **관련 결정**: DECISIONS.md - "TDD 도입 결정" (2026-04-27)
- **비고**: 사후 작성. 작업 완료 후 판단 근거 정리 목적.

## 작업개요

DevLog 프로젝트에 Jest 기반 테스트 환경을 구축한다. 로그인 페이지 작성 전 필수 선행 작업으로, TDD 사이클 (Red-Green-Refactor)을 강제할 수 있는 최소 환경을 확보한다.

테스트 프레임워크는 Jest, React 컴포넌트 테스트는 Testing Library, 환경 통합은 `next/jest` helper를 사용한다.

## 작업대상

- `package.json` (의존성 + scripts)
- `jest.config.ts` (신규)
- `jest.setup.ts` (신규)
- `.gitignore` (`/coverage` 추가)

## 판단근거 (왜)

### 왜 Jest인가

- Next.js 16 공식 가이드가 Jest와 Vitest 둘 다 지원하지만, **Testing Library 통합 사례**가 Jest 쪽이 압도적으로 풍부

### 왜 `next/jest` helper인가 (단순 `ts-jest` preset 대신)

- Next.js 16은 SWC 컴파일러를 사용하는데, `next/jest`가 이를 자동으로 활용 → `ts-jest`보다 빌드 속도 빠름
- Next.js 환경 변수 (`NEXT_PUBLIC_*`) 자동 로드
- 경로 alias (`@/*`) 자동 처리 (별도 `moduleNameMapper` 부담 감소)
- Next.js 버전 업그레이드 시 호환성 자동 관리

→ `ts-jest` 직접 설정은 환경 변수/alias/SWC를 수동 관리해야 하므로 유지보수 비용이 더 큼.

### 왜 `jsdom` 환경인가

- DOM API (`document`, `window`)를 사용하는 React 컴포넌트 테스트가 다수 발생 예정 (회원가입 폼, 강도 인디케이터 등)
- `node` 환경에서는 `window` 미정의로 인한 즉시 실패
- Server Action 단위 테스트는 어차피 mock 처리하므로 `jsdom`이 양쪽 모두 커버


### 왜 `/coverage`를 .gitignore에 추가하는가

- `npm test -- --coverage` 실행 시 자동 생성되는 디렉토리
- 빌드 산출물이라 버전 관리 대상 아님
- CI에서 매번 새로 생성되므로 커밋 시 충돌 원인이 됨

## 구현요구사항

### 1. 의존성 설치

```bash
npm install --save-dev \
  jest \
  @types/jest \
  ts-node \
  jest-environment-jsdom \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event
```

- `ts-node`: `jest.config.ts`를 TypeScript로 작성하기 위해 필요
- `jest-environment-jsdom`: Jest 28+ 부터 별도 설치 필수

### 2. `jest.config.ts` 생성 (프로젝트 루트)

```typescript
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
```

### 3. `jest.setup.ts` 생성 (프로젝트 루트)

```typescript
import '@testing-library/jest-dom'
```

- `toBeInTheDocument()`, `toHaveTextContent()` 같은 DOM 매처 활성화

### 4. `package.json` scripts 추가

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### 5. `.gitignore` 보강

```
# testing
/coverage
```

## 스코프경계

- Jest + Testing Library 최소 동작 환경
- TypeScript 설정 파일 (`jest.config.ts`)
- DOM 매처 확장 (`@testing-library/jest-dom`)

## 커밋계획

본 작업은 두 커밋으로 작업한다:

```
chore: Jest 및 Testing Library 의존성 추가
chore: Jest 설정 파일 추가
```

분리 이유:
- 의존성 변경과 설정 파일은 회귀 시 롤백 단위가 다름
- `package.json` 변경만으로 빌드 깨지면 의존성 커밋만 revert 가능
- 변경 이력 추적 시 "왜 이 의존성이 추가됐는가" 검색 용이

## 완료 조건

- [x] `npm install` 완료, `package-lock.json` 갱신 확인
- [x] `jest.config.ts`, `jest.setup.ts` 루트에 생성
- [x] `npm test` 실행 시 "No tests found" 정상 출력 (오류 없음)
- [x] `/coverage` `.gitignore` 반영
- [x] 두 개 chore 커밋으로 분리 완료

검증 가능 기준:
- `npm test` 종료 코드 0
- `jest --showConfig` 실행 시 `testEnvironment: "jsdom"` 출력 확인

## TDD 관련 내용

- **인프라**: Jest + Testing Library 환경 구성 (본 사이클의 핵심 작업)
- **규칙**: CLAUDE.md에 Testing(TDD) 섹션 신설, DO NOT에 Testing 금지 항목 추가, Conventions에 Testing 섹션 추가
- **결정 기록**: DECISIONS.md에 "TDD 도입 결정" 등록

- **TDD 도입 자체의 근거 (DECISIONS.md와 동일)**:
1. AI 출력은 비결정적 (같은 입력에도 다른 출력 가능)
2. 테스트가 "결과가 올바른가?"의 객관적 기준 역할
3. 새 기능 추가 시 기존 기능 회귀 방지를 위한 안전망
4. 증강 코딩(Augmented Coding) 방법론은 TDD를 전제로 작동. TDD가 빠지면 AI 출력 통제가 무너지고 vibe coding으로 회귀.

### 완료된 작업

- 5개 패키지 설치: `jest`, `ts-node`, `@types/jest`, `jest-environment-jsdom`, `@testing-library/{react, jest-dom, user-event}`
- `jest.config.ts` 생성 (`next/jest` helper 기반)
- `jest.setup.ts` 생성 (DOM 매처 확장)
- `package.json` scripts 3개 추가 (`test`, `test:watch`, `test:coverage`)
- `.gitignore`에 `/coverage` 추가
- `npm test` 검증 성공 ("No tests found in /Users/.../devlog" 정상 출력)

## 결정

### 1. TDD 도입 (Jest + React Testing Library)
- **결정**: Jest + React Testing Library 도입, TDD 사이클(Red-Green-Refactor) 적용
- **근거**:
  - AI 출력은 비결정적 (같은 입력에도 다른 출력 가능)
  - 테스트가 "결과가 올바른가?"의 객관적 기준 역할
  - 새 기능 추가 시 기존 기능 회귀 방지를 위한 안전망
  - 증강 코딩(Augmented Coding) 방법론은 TDD를 전제로 작동. TDD가 빠지면 AI 출력 통제가 무너지고 vibe coding으로 회귀.
- **참조**: 켄트 벡의 증강 코딩(Augmented Coding) 개념 (2025)
- **수정 (2026-05-16)**: 4단계 사이클 도입으로 TDD = 3차 리팩토링 시점에만 강제 적용 (1차 바이브 시점에는 테스트 없이 구현 OK)

### 2. 프롬프트 양식 업그레이드 (완료 조건 섹션 추가)
- **결정**: prompts/ 파일 양식에 "완료 조건" 섹션 추가
- **근거**:
  - AI는 자체 판단으로 "완료" 응답하지만 개발자 기대와 다를 수 있음
  - 구체적/측정 가능/검증 가능한 완료 조건이 있어야 객관적 검증 가능
  - 예: "빠르게 동작" → "API 응답 300ms 이내"
- **수정 (2026-05-16)**: 회고 양식 = 5섹션 경량 양식으로 변경 (완료 조건 별도 섹션 X / 5번 결과 섹션에 통합)