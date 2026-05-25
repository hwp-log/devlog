# 0032 회고: Prisma + Supabase 연동

- **작성일**: 2026-05-22
- **소요 시간**: 약 4시간 (= 23:00 ~ 03:30 / 함정 8개 박힌 본질)
- **관련 커밋**: 5개 (= 아래 4. 코드 작성 & 수정 섹션 참고)

---

## 1. 한 줄 요약

Prisma 7 + Supabase PostgreSQL 연동 완료. ORM 계층 도입 (= Story / SpotFinder / CostPlan / My Dots 다대다 관계 대비). Node 22 LTS 갈음 + prisma.config.ts + dotenv 직접 의존성. 커밋 5개 atomic 분할.

---

## 2. 왜 / 목적 / 이유

### a) Prisma 도입 결정

- 왜 = DevLog 단일 테이블(til_entries) → Dotrip 5+ 테이블 (= Story / Spot / Tag / CostPlan / Bookmark)
- 목적 = 타입 안전성 + 다대다 관계 + JOIN 쿼리 + 마이그레이션 추적
- 이유 = 기획 단계(2026.02)에선 "Prisma 빼자" 박혀 있었는데, Dotrip 도메인 복잡도 박혀서 갈음. 멘토 시연 본질로 ORM 패턴 박힘.

### b) Node 22 LTS 갈음

- 왜 = Prisma 7 = Node 20.19 이상 박힘. 현재 Node 20.9 박혀 있음.
- 목적 = Prisma 7 동작 박힘 + 미래 호환성
- 이유 = 다운그레이드(= Prisma 6.x) 박지 않고 Node 갈음 박는 본질이 멘토 시연 본질로 인프라 관리 박힘. `.nvmrc` 박아서 프로젝트별 Node 박힘.

### c) prisma.config.ts 박음 (= Prisma 7 신규 표준)

- 왜 = Prisma 7부터 `prisma db execute` 박힐 때 `prisma.config.ts` 박혀 있어야 함
- 목적 = `.env.local` 박는 본질 (= Next.js 표준)
- 이유 = `--env-file` 플래그 박힘 (= tsx 런타임 전용 / Prisma CLI 박지 못함). dotenv-cli 박은 본질도 박힘 (= `prisma db execute`가 환경변수 박혀 있어도 못 읽음). `prisma.config.ts`가 진짜 박힐 본질.

### d) dotenv 직접 의존성 박음

- 왜 = `prisma.config.ts`가 `import { config } from "dotenv"` 박음
- 목적 = `.env.local` 박는 본질 박음
- 이유 = dotenv-cli 박은 본질이 박지 못함 / dotenv-cli 제거 박힐 때 dotenv도 같이 제거 박힐 위험 박힘. 명시적 의존성 박힘.

### e) DATABASE_URL `connection_limit=1` 박음

- 왜 = `prepared statement "s1" already exists` 에러 박힘
- 목적 = pgbouncer + prisma db execute 박힌 본질 함정 박지 않음
- 이유 = `?pgbouncer=true` 박혀 있어도 박힘. `&connection_limit=1` 추가 박은 본질이 박힘.

### f) 비번 URL 인코딩 박음

- 왜 = DB 비번에 `!`, `$` 박혀 있음
- 목적 = URL 형식 박힘 (= 특수문자 → `%XX` 박음)
- 이유 = `!` → `%21`, `$` → `%24` 박음. 박지 못하면 인증 실패 박힘.

### g) `.gitignore` 예외 박음

- 왜 = `.env*` 패턴이 `.env.example`도 무시 박음
- 목적 = `.env.example` 커밋 가능 박힘 (= 미래 협업자 / 너 박힌 본질)
- 이유 = `!.env.example` 박음 (= `.env*` 박힌 줄 바로 아래 박는 게 본질).

### h) 커밋 5개 atomic 분할

- 왜 = atomic 커밋 원칙 (= 한 본질당 한 커밋)
- 목적 = git log 박힌 본질 명확 / 멘토 시연 본질
- 이유 = `.gitignore`를 커밋 1에 묶으면 본질 박힘 박지 못함. 별도 커밋 박는 게 본질.

---

## 3. 작성한 프롬프트

(원본 프롬프트 = `/mnt/user-data/outputs/0032-prisma-prompt.md` 박힌 본질)

핵심 박힌 본질:
```
[배경]
DevLog → Dotrip 개수 작업 중. Story / SpotFinder / CostPlan / My Dots
4개 도메인 박히면서 다대다 관계와 JOIN 쿼리 늘어남.
타입 안전성과 마이그레이션 추적 위해 Prisma 도입.

[목표]
Prisma를 Supabase PostgreSQL에 연결하고 schema.prisma 초기 박힘 완료.
이번 작업 = 연동만 박음. migrate / 시드 / 도메인 모델은 0033에서.

[변경 범위]
1. 의존성 박음
2. 환경변수 박음 (.env.example + .env.local)
3. prisma 폴더 박음
4. Prisma 싱글톤 박음
5. package.json scripts 박음

[검수 모드]
- 등급 = ★★★ (= 인프라 설정 / 환경변수 / 싱글톤 패턴)
- 작동 확인:
  1. npm install 정상 완료
  2. npx prisma generate 정상 완료
  3. npx prisma db execute --stdin <<< "SELECT 1" 박힘
  4. 기존 npm run dev 정상 / 로그인·회원가입·TIL CRUD 회귀 없음
```

추가 박힌 본질 (= 함정 박힌 다음 추가 박은 프롬프트):
- Step 5-4: prisma.config.ts 박음
- Step 5-5~7: dotenv 직접 박음 + dotenv-cli 제거
- DATABASE_URL에 connection_limit=1 박음

---

## 4. 코드 작성 & 수정

### 변경 파일 (= 8개)

1. `.nvmrc` (신규) — `22`
2. `.gitignore` (수정) — `!.env.example` 추가
3. `package.json` (수정) — dependencies + devDependencies + scripts
4. `package-lock.json` (자동 갱신)
5. `.env.example` (신규) — DB URL 템플릿
6. `prisma/schema.prisma` (신규) — generator + datasource
7. `prisma.config.ts` (신규) — Prisma 7 표준
8. `lib/prisma.ts` (신규) — 싱글톤

### 커밋 5개

```
커밋 1: chore: Node 22 LTS 적용
  - .nvmrc

커밋 2: chore: prisma + dotenv 의존성 추가
  - package.json
  - package-lock.json

커밋 3: chore: .gitignore에 .env.example 예외 추가
  - .gitignore

커밋 4: feat: prisma schema + config 초기 설정
  - prisma/schema.prisma
  - prisma.config.ts
  - .env.example

커밋 5: feat: prisma 싱글톤 추가
  - lib/prisma.ts
```

### 핵심 코드 박힌 본질

**prisma/schema.prisma** (= 12줄)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// 도메인 모델은 0033에서 박을 예정
// Story / Spot / Tag / CostPlan / MyDots
```

**prisma.config.ts** (= 11줄)
```typescript
import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

**lib/prisma.ts** (= 12줄)
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**.env.example** (= 핵심 박힌 부분)
```
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

**.env.local** (= 박힘 / .gitignore 박혀 있음)
```
DATABASE_URL="postgresql://postgres.xxx:[인코딩된비번]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.xxx:[인코딩된비번]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
```

---

## 5. 결과 / 배운점

### 결과
- Prisma 7 + Supabase PostgreSQL 연동 완료
- DB 연결 검증 박힘 (= `SELECT 1` 박힘)
- Node 22 LTS 갈음 / `.nvmrc` 박음
- 커밋 5개 atomic 분할
- 기존 기능 회귀 없음 (= 로그인 / 회원가입 / TIL 박힘)

### 배운점

**1. Prisma 7 함정 박힌 본질**
- Prisma 7부터 `prisma.config.ts` 박혀 있어야 함 (= `prisma db execute` 박힐 때)
- `--env-file` 박은 본질 = tsx 런타임 전용 / Prisma CLI 박지 못함
- dotenv-cli 박은 본질 = 환경변수 박혀도 Prisma가 못 읽음
- 진짜 박힐 본질 = `prisma.config.ts` + `dotenv` 직접 박음

**2. Supabase + Prisma 함정 박힌 본질**
- `?pgbouncer=true` 박혀 있어도 `prepared statement` 에러 박힘
- `&connection_limit=1` 추가 박혀야 박힘
- 비번에 특수문자 박혀 있으면 URL 인코딩 박혀야 함
- Supabase Connect 모달 박힌 위치 박혀 있음 (= 상단 "Connect" 버튼)

**3. `.gitignore` 박힌 본질**
- `.env*` 패턴이 `.env.example`도 무시 박음
- `!.env.example` 박은 본질이 본질
- 박힌 줄 순서 박힌 본질 (= `.env*` 박은 다음 `!.env.example` 박힘)

**4. atomic 커밋 박힌 본질**
- 한 본질당 한 커밋 박는 게 멘토 시연 본질
- `.gitignore` 변경은 별도 커밋 박힘 (= 의존성 커밋에 묶지 않음)
- 5개 박힌 본질이 본질 박힘

**5. 시간 박힌 본질**
- 예상 = 3시간 박힘
- 실제 = 4시간 박힘 (= 함정 8개 박은 본질)
- 박힐 시간 = 새로운 도구 박힐 때 학습 비용 박힘
- 다음 박힐 때 = 동일 본질 박힐 가능성 박힘 (= 함정 박힌 본질 박힘)

**6. Claude Code 박힌 본질**
- 박힌 본질 박힌 본질 박지 못하면 디버깅 박힘 (= 무한 박힘)
- 박힌 본질이 박힐 때 = 새 터미널에서 직접 박는 본질이 본질
- 백그라운드 박힌 본질 박은 다음 박힘 박지 못함

---

## 결정 (Decisions)

- **Prisma 도입**: Dotrip 도메인 복잡도 박힘 / DevLog 단일 테이블 → Dotrip 5+ 테이블 / 다대다 관계 박힘.
- **Node 22 LTS 갈음**: Prisma 7 = Node 20.19+ 박힘 / `.nvmrc` 박아서 프로젝트별 Node 박힘.
- **prisma.config.ts 박음**: Prisma 7 신규 표준 / `.env.local` 박는 본질 박음 / dotenv-cli 박지 못함.
- **dotenv 직접 의존성**: dotenv-cli 박지 못함 / 명시적 박힘.
- **`?pgbouncer=true&connection_limit=1`**: prepared statement 함정 박지 않음 / Prisma + pgbouncer 박힌 본질.
- **비번 URL 인코딩**: `!` → `%21`, `$` → `%24` 박음.
- **`.gitignore` `!.env.example` 예외**: `.env*` 패턴이 `.env.example`도 무시 박지 않게 박음.
- **커밋 5개 atomic 분할**: 한 본질당 한 커밋 / `.gitignore` 별도 박힘.
- **회귀 테스트 5번 (TIL 작성) 스킵**: 0031에서 UI 제거됨 / 다음 작업에서 박힘.

---

## 다음 작업 박힐 본질

```
0033 = schema.prisma 도메인 모델 + migrate + til drop (= ★★★★)
  - User / Story / Tag 모델 박음
  - til_entries → drop
  - prisma migrate dev 박음
  - RLS 박음

0034 = dashboard → Story 메뉴 갈음 (= velog 본질)
  - 라우트 갈음
  - 데이터 fetch 갈음
  - 디자인 청사진 70%

0035 = 스토리 작성 기능
  - /story/new 박음
  - 폼 (= 제목 / 본문 / 사진 / 태그)
  - Supabase Storage 박음

0036 = Loading indicator (= 로그인 / 회원가입 버튼) → 30m
```

→ 박힐 본질 = "til 잔재 안 됨" + "도메인 일관성 박힘" + "velog 본질 박음".
