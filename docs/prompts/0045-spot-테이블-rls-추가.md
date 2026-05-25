# 0045 회고: Spot 테이블 + RLS 정책 추가

- **작성일**: 2026-05-25
- **소요 시간**: 약 2시간 30분
- **관련 커밋**: 2개
  - `73bd485` feat: 0045 Spot 테이블 추가
  - `7b903e3` feat: 0045 Spot RLS 정책 SQL 추가

---

## 1. 한 줄 요약

0046 Mapbox 마커 시각화 전에 Spot 테이블(schema.prisma + migration)을 추가하고, RLS 4개 정책(SELECT/INSERT/UPDATE/DELETE)을 Supabase SQL Editor에서 적용. 0033 패턴(테이블은 Prisma migration, RLS는 SQL Editor 분리) 재사용. 커밋 2개 atomic 분할.

---

## 2. 왜 / 목적 / 이유

### a) Spot 테이블 = 0046 이전 선행 작업

- **왜**: 0046에서 Mapbox 마커 UI를 작성할 때 DB 스키마가 없으면 작업 진행 불가.
- **목적**: Story 한 개 안에 여러 촬영지(Spot)를 마커로 시각화하기 위한 데이터 모델 확보.
- **이유**: UI 작업과 스키마 작업을 분리하면 각 커밋의 책임이 명확해짐. Mapbox 도입(0046)과 이미지 업로드(0047) 범위를 이번 작업에 포함하면 커밋 단위가 지나치게 커짐.

### b) Spot RLS = EXISTS 서브쿼리 패턴

- **왜**: Spot 테이블에 직접 user_id가 없어서 stories.user_id와 직접 비교 불가.
- **목적**: Story 소유자만 Spot을 추가·수정·삭제할 수 있도록 행 단위 보안 적용.
- **이유**: Spot에 user_id를 역정규화하면 스키마 중복이 발생하고 stories.user_id와의 동기화 문제가 생김. EXISTS 서브쿼리로 stories.user_id를 조회하면 단일 진실 공급원(single source of truth) 유지 가능.

### c) RLS 분리 = 0033 패턴 재사용

- **왜**: Prisma는 RLS를 인식하지 못해 migration.sql에 RLS를 포함하면 shadow DB에서 실패 가능성이 있음.
- **목적**: RLS SQL을 `prisma/sql/spots-rls.sql`로 분리해 git 추적하고, Supabase SQL Editor에서 별도 적용.
- **이유**: 0033에서 동일한 구조로 작업한 전례가 있고, 테이블과 보안 정책의 변경 빈도 및 책임이 다름. 분리하면 마이그레이션 히스토리가 테이블 DDL만 담게 되어 drift 감지가 명확해짐.

---

## 3. 작성한 프롬프트

```
[배경]
Story 한 개 안에 여러 촬영지(Spot)를 마커로 시각화 + 폴리라인으로 동선 연결할 예정.
0046부터 Mapbox 도입 + 마커 추가 UI 작성 예정이라, 먼저 데이터 모델 + RLS 작업.
Spot은 직접 authorId 없음 → Story 통해서만 소유자 검증 (EXISTS 서브쿼리 패턴).

[목표]
1. Prisma schema에 Spot 모델 추가 + Story에 spots 관계 추가
2. 마이그레이션 생성 후 적용
3. RLS 4개 정책: SELECT(public) / INSERT / UPDATE / DELETE (authenticated)
4. 커밋 2개 분리: 테이블 / RLS

[하지 말 것]
- 마커 추가 UI / Mapbox 코드 (0046 범위)
- Spot 사진 업로드 로직 (0047 범위)
- Co-Authored-By 커밋 메시지

[검수 모드 ★★★★★]
- auth.uid() 호출은 반드시 (select auth.uid()) 감싸기 (Supabase lint 0003)
- UPDATE 정책 USING + WITH CHECK 양쪽
- EXISTS 서브쿼리 컬럼명: stories, story_id, user_id
- onDelete: Cascade 확인
- 인덱스 2개: [storyId] + [storyId, order]
```

플랜 검토 중 추가된 수정 사항:
- 원래 프롬프트의 `"Story"`, `"storyId"`, `"authorId"` → 실제 DB 컬럼명 `stories`, `story_id`, `user_id`로 교정
- `::uuid` 캐스팅 제거 (stories.user_id가 UUID 타입이므로 불필요)
- `migrate dev --create-only` → P3006 발생 후 `migrate diff --from-config-datasource` 우회 절차 추가

---

## 4. 코드 작성 & 수정

### 변경 파일 (3개)

1. `prisma/schema.prisma` (수정) — Spot 모델 추가 + Story 역관계 추가
2. `prisma/migrations/20260525170000_add_spot_table/migration.sql` (수동 생성)
3. `prisma/sql/spots-rls.sql` (신규)

### 커밋 2개

```
73bd485 feat: 0045 Spot 테이블 추가
  - prisma/schema.prisma
  - prisma/migrations/20260525170000_add_spot_table/migration.sql

7b903e3 feat: 0045 Spot RLS 정책 SQL 추가
  - prisma/sql/spots-rls.sql
```

### 핵심 코드

**prisma/schema.prisma** — Spot 모델 + Story 역관계

```prisma
// prisma/schema.prisma (기존 Story 모델 안에 추가)
model Story {
  // 기존 필드 유지
  spots     Spot[]      // 역관계 추가 (0045)
}

model Spot {
  id          String   @id @default(cuid())
  storyId     String   @map("story_id")
  story       Story    @relation(fields: [storyId], references: [id], onDelete: Cascade)
  order       Int
  name        String
  description String?
  lat         Float
  lng         Float
  photoUrl    String?  @map("photo_url")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("spots")
  @@index([storyId])
  @@index([storyId, order])
}
```

설계 결정:
- `storyId @map("story_id")` — snake_case DB 컬럼명 유지 (프로젝트 표준)
- `onDelete: Cascade` — Story 삭제 시 Spot 자동 삭제
- `@@index([storyId, order])` — 순서 정렬 쿼리 최적화

**prisma/migrations/20260525170000_add_spot_table/migration.sql** — 수동 생성

```sql
-- CreateTable
CREATE TABLE "spots" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spots_story_id_idx" ON "spots"("story_id");

-- CreateIndex
CREATE INDEX "spots_story_id_order_idx" ON "spots"("story_id", "order");

-- AddForeignKey
ALTER TABLE "spots" ADD CONSTRAINT "spots_story_id_fkey"
  FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

적용 절차 (P3006 우회):

```bash
# 1. SQL 생성 (shadow DB 없이 실제 DB 기준 diff)
pnpm prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script

# 2. 폴더 수동 생성 후 SQL 저장
# prisma/migrations/20260525170000_add_spot_table/migration.sql

# 3. 실제 DB에 적용
pnpm prisma db execute --file ./prisma/migrations/20260525170000_add_spot_table/migration.sql

# 4. Prisma 메타데이터에 기록
pnpm prisma migrate resolve --applied 20260525170000_add_spot_table

# 5. 상태 확인
pnpm prisma migrate status
# → "Database schema is up to date!"
```

**prisma/sql/spots-rls.sql** — RLS 4개 정책

```sql
-- RLS 활성화
ALTER TABLE "spots" ENABLE ROW LEVEL SECURITY;

-- SELECT: 모든 사람이 스팟 조회 가능
CREATE POLICY "spots_select" ON "spots"
FOR SELECT TO public
USING (true);

-- INSERT: Story 소유자만 스팟 추가 가능
CREATE POLICY "spots_insert" ON "spots"
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = spots.story_id
    AND stories.user_id = (select auth.uid())
  )
);

-- UPDATE: Story 소유자만 스팟 수정 가능 (USING + WITH CHECK 양쪽)
CREATE POLICY "spots_update" ON "spots"
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = spots.story_id
    AND stories.user_id = (select auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = spots.story_id
    AND stories.user_id = (select auth.uid())
  )
);

-- DELETE: Story 소유자만 스팟 삭제 가능
CREATE POLICY "spots_delete" ON "spots"
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = spots.story_id
    AND stories.user_id = (select auth.uid())
  )
);
```

---

## 5. 결과 / 배운점

### 결과

- spots 테이블 Supabase DB에 적용 완료 (대시보드 시각 확인)
- RLS 4개 정책 적용 완료 (Supabase SQL Editor → "Success. No rows returned")
- `prisma migrate status` → "Database schema is up to date!" 확인
- 커밋 2개 atomic 분할 후 origin/main push 완료
- Vercel 빌드 자동 트리거

### 함정

**1. P3006 (shadow DB — storage 스키마 없음)**
- 원인: `prisma migrate dev --create-only` 실행 시 shadow DB에 기존 `20260523074954_storage_rls` 마이그레이션을 재현하는 과정에서 Supabase `storage` 스키마가 없어 실패.
- 해결: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`로 shadow DB 없이 실제 DB 기준 diff 생성. `prisma db execute`로 적용 후 `prisma migrate resolve --applied`로 메타데이터 기록.
- 학습: Supabase 전용 스키마(`storage`, `auth`)를 참조하는 마이그레이션이 히스토리에 있으면 이후 `migrate dev`가 shadow DB에서 항상 실패함. `migrate diff + db execute + migrate resolve` 절차가 표준 우회 경로.

**2. Prisma 7 CLI 플래그 변경**
- 원인: `--from-url` / `--to-schema-datamodel` 플래그가 Prisma 7에서 제거됨.
- 해결: `--from-config-datasource` / `--to-schema`로 교체.
- 학습: Prisma 버전 업그레이드 시 CLI 플래그가 breaking change 없이 교체되는 경우가 있음. 에러 메시지에서 대체 플래그를 직접 안내하므로 에러 전문 확인이 빠른 경로.

**3. AI 생성 RLS 파일 — UPDATE 정책 중복 + WHERE 절 누락**
- 원인: `spots-rls.sql` 첫 생성 시 UPDATE 정책이 두 번 작성됨. 첫 번째 WITH CHECK 절의 EXISTS 서브쿼리에 WHERE 절이 누락되어 syntax error 포함.
- AI 자체 검수 보고("체크리스트 ✅")는 이 오류를 감지하지 못함.
- 해결: 파일 전체 교체 (사용자 직접 발견 + 수정본 제공).
- 학습: ★★★★★ 등급 파일은 AI 체크리스트 보고를 신뢰하지 않고 파일 원문을 직접 확인해야 함.

**4. AI 응답 렌더링 잘림 — `cat` 원문 검증**
- 원인: 두 번째 RLS 파일 교체 후 채팅 렌더링에서 내용 잘림 현상 발생. 파일 정상 여부 불확실.
- 해결: `cat prisma/sql/spots-rls.sql`로 raw 출력 확인 → 정상 확인.
- 학습: AI 응답 텍스트 != 실제 파일 상태. 렌더링 잘림 또는 응답 불일치가 의심될 때는 `cat`으로 파일 원문을 직접 확인하는 것이 ★★★★★ 작업의 표준 검수 절차.

### 배운점

**1. Supabase 전용 마이그레이션 히스토리는 `migrate dev` 차단 요인**
- `storage` / `auth` 스키마를 참조하는 마이그레이션이 히스토리에 있으면 이후 `migrate dev`(shadow DB 방식)는 사용 불가.
- `migrate diff + db execute + migrate resolve` 절차를 팀 표준으로 정립하는 것이 효율적.

**2. RLS EXISTS 서브쿼리 + `(select auth.uid())` 패턴**
- 직접 소유자 컬럼이 없는 종속 테이블의 RLS는 EXISTS 서브쿼리로 부모 테이블의 소유자를 검증.
- `auth.uid()` 직접 호출은 Row마다 재평가됨. `(select auth.uid())`로 감싸면 initPlan으로 한 번만 평가되어 성능 최적화 (Supabase lint 0003).

**3. AI 생성 코드 검수 = 파일 원문 기준**
- AI 체크리스트 보고는 실제 파일 상태를 보장하지 않음.
- ★★★★★ 등급 파일(보안/RLS/마이그레이션)은 `cat` 원문 출력 후 줄 단위 직접 검수가 필수.

### 면접 답변 재료

- "RLS 성능 신경 쓰셨어요?" → `(select auth.uid())` initPlan 최적화 적용 (Supabase lint 0003). Row마다 재평가하지 않고 쿼리 초기화 시 한 번만 평가.
- "Spot에 user_id를 직접 두지 않은 이유?" → Spot은 Story에 종속된 테이블. user_id를 역정규화하면 stories.user_id와 이중 관리가 필요하고 동기화 문제가 생김. EXISTS 서브쿼리로 단일 진실 공급원 유지.
- "UPDATE 정책에 USING과 WITH CHECK를 둘 다 쓴 이유?" → USING은 수정 대상 행 선택 조건, WITH CHECK는 수정 후 결과 검증 조건. UPDATE는 두 가지를 모두 지정해야 타인의 story_id로 이동하는 것을 차단할 수 있음.
- "Prisma migration에 RLS를 포함하지 않은 이유?" → Prisma는 RLS를 인식하지 못해 shadow DB 재현 시 실패 가능. 테이블 DDL과 보안 정책의 변경 책임이 다르므로 분리가 적절. 0033에서 검증된 패턴 재사용.

---

## 결정 (Decisions)

- **Spot RLS auth.uid() 패턴**: `(select auth.uid())` 감싸기. Supabase lint 0003 — initPlan 최적화, Row마다 재평가 없음.
- **Spot RLS 소유자 검증**: EXISTS 서브쿼리로 stories.user_id 검증. Spot에 직접 user_id 없음 → Story 통해 단일 진실 공급원 유지.
- **Spot 사진 버킷**: story-photos 재활용 + 폴더 분리 (`{userId}/spot/...`). 버킷 관리 단순화, 기존 SELECT 정책 공유 가능.
- **Supabase storage 마이그레이션 히스토리 우회**: `prisma migrate diff --from-config-datasource` + `db execute` + `migrate resolve --applied` 절차. shadow DB 불필요.

---

## 다음 작업

```
0046 = Mapbox 도입 + Story 상세 페이지에 지도 + Spot 마커 추가 UI
  - Mapbox GL JS 설치 + MapView 컴포넌트
  - Spot 마커 표시 (DB에서 조회)
  - 마커 추가 UI (클릭 → 좌표 저장)
  - prisma.spot.create 서버 액션
```
