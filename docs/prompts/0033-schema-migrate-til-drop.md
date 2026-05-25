# 0033 회고: schema.prisma 도메인 테이블 + migrate + RLS + 시드

- **작성일**: 2026-05-22
- **소요 시간**: 약 1시간 35분 (= 12:00 ~ 13:37)
- **관련 커밋**: 4개
  - `d4df561` feat: User/Story/Tag 모델 추가 (schema.prisma)
  - `5c406cc` feat: User/Story/Tag 테이블 마이그레이션 적용
  - `e1c11dd` feat: RLS 정책 SQL 추가
  - `3555cda` feat: prisma seed 스크립트 추가

---

## 1. 한 줄 요약

DevLog 도메인(til_entries) 제거 후 Dotrip 도메인 테이블 3개(User/Story/Tag) 추가. Prisma migrate로 DB 적용, RLS 12개 정책 설정, 이태원 클라쓰 촬영지 시드 스크립트 작성. 커밋 4개 atomic 분할.

---

## 2. 왜 / 목적 / 이유

### a) til_entries 제거 결정

- **왜** = DevLog → Dotrip 컨셉 전환. til_entries는 학습 기록용 단일 테이블이라 여행 도메인에 맞지 않음.
- **목적** = 새 도메인 깔끔하게 시작. 마이그레이션 히스토리에 til_entries 흔적 남기지 않음.
- **이유** = 데이터 보존 가치 없음 (= 테스트 데이터만 있음). cross-schema FK 제약(`auth.users` 참조)도 같이 정리 필요.

### b) User + Story + Tag만 추가 (Spot/CostPlan 제외)

- **왜** = MVP 본질 = 글 작성 + 피드. Spot/CostPlan은 v2 본질.
- **목적** = 0035에서 글 작성 기능 박을 본질의 최소 기반.
- **이유** = 도메인 복잡도 늘리면 0035 박힘 위험. 미래 마이그레이션으로 추가 가능 (= Prisma migrate 본질).

### c) RLS = Supabase SQL Editor에서 별도 적용

- **왜** = Prisma는 RLS 인식 못 함.
- **목적** = velog 본질 보안 적용 (= 누구나 읽음 / 본인만 작성/수정/삭제).
- **이유** = migrate에 RLS 포함하면 박힘 위험. SQL Editor에서 즉시 검증 가능 + 파일은 `prisma/sql/rls.sql`에 저장해 git 추적.

### d) `--create-only` 박은 다음 검수 박는 본질

- **왜** = ★★★★ 등급 (= DB 변경 / 비가역).
- **목적** = SQL 박힌 다음 DB 적용 전에 줄 단위 검수.
- **이유** = `prisma migrate dev`는 SQL 박음 + DB 적용 + generate 한꺼번에. 박힌 다음 검수하면 비가역 박힘. `--create-only`는 SQL만 박고 멈춤. 검수 통과 후 `migrate dev` (= 박힌 migration 적용).

### e) til_entries DROP은 Supabase SQL Editor에서 직접

- **왜** = Prisma introspect가 cross-schema FK (= `til_entries.user_id → auth.users.id`) 박지 못함.
- **목적** = P4002 에러 회피 + 깔끔한 migration.
- **이유** = schema.prisma에 `schemas = ["public", "auth"]` 박는 옵션도 있지만, auth 스키마는 Supabase 관리 영역이라 박지 않음 (= 권한 박지 못함).

### f) 시드 = 이태원 클라쓰 단밤 포차 박힌 본질

- **왜** = 한국 + 촬영지 박힌 본질 = Dotrip 컨셉 매칭.
- **목적** = 멘토 시연 본질 강화 (= "왜 Dotrip이냐" 즉시 박힘).
- **이유** = 도쿄/라멘 (= 초기안)은 일본 박힌 본질. Dotrip은 한국 타겟. 실제 촬영지 (= 후암동 오리올) 박은 본질이 진정성 박힘.

### g) 커밋 4개 atomic 분할

- **왜** = atomic 커밋 원칙 (= 0032에서 학습한 본질).
- **목적** = git log 명확 / bisect 가능 / 멘토 시연.
- **이유** = schema / migration / RLS / seed = 네 본질. 한 커밋에 묶으면 본질 박힘 박힘 박힘.

---

## 3. 작성한 프롬프트

원본 prompt = `/mnt/user-data/outputs/0033-schema-migrate-prompt-v2.md`

핵심 본질:

```
[배경]
0032에서 Prisma 7 + Supabase 연동 완료. schema.prisma는 generator + datasource 블록만.
til_entries 제거 후 User / Story / Tag 3개 모델 추가 + DB 마이그레이션.

[목표]
1. schema.prisma에 도메인 모델 3개 추가 (User / Story / Tag)
2. prisma migrate dev로 DB 적용 (= til_entries drop / 새 테이블 생성)
3. RLS 정책 설정 (= 보안 ★★★★ / Supabase SQL Editor에서 별도)
4. 시드 데이터 1개 추가 (= 더미 스토리)

[Prisma 7 주의사항]
- schema.prisma에는 datasource.url / directUrl 박지 마
- migrate 실패 시 즉시 추가 디버깅 박지 말고, 에러 메시지 그대로 보고
- driver adapter 박힌 본질에서 prisma migrate dev가 정상 박힐지 검증

[하지 말 것]
❌ til_entries의 데이터 백업
❌ Spot / CostPlan 모델 추가 (= 미래 마이그레이션)
❌ Story 작성 UI 작업 (= 0035)
❌ /dashboard → /story 라우트 갈음 (= 0034)
❌ schema.prisma에 datasource.url 박지 마
❌ Co-Authored-By 커밋 메시지에 추가

[검수 모드]
- 등급 = ★★★★ (= DB 변경 + RLS / 줄 단위 검토 필수)
```

추가 박은 본질 (= 함정 박힌 다음):
- til_entries DROP을 Supabase SQL Editor에서 직접 진행 결정
- `--create-only` 패턴 박음 (= SQL 검수 단계 추가)
- 커밋 메시지 한국어 + "테이블" 표현으로 amend

---

## 4. 코드 작성 & 수정

### 변경 파일 (= 6개)

1. `prisma/schema.prisma` (수정) - User / Story / Tag 모델 추가
2. `prisma/migrations/<timestamp>_init_dotrip_domain/migration.sql` (신규)
3. `prisma/sql/rls.sql` (신규) - RLS 정책 12개
4. `prisma/seed.ts` (신규) - 이태원 클라쓰 시드
5. `package.json` (수정) - `db:seed` script + tsx 의존성
6. `package-lock.json` (자동 갱신)

### 커밋 4개

```
d4df561 feat: User/Story/Tag 모델 추가 (schema.prisma)
  - prisma/schema.prisma

5c406cc feat: User/Story/Tag 테이블 마이그레이션 적용
  - prisma/migrations/<timestamp>_init_dotrip_domain/

e1c11dd feat: RLS 정책 SQL 추가
  - prisma/sql/rls.sql

3555cda feat: prisma seed 스크립트 추가
  - prisma/seed.ts
  - package.json
  - package-lock.json
```

### 핵심 코드 박힌 본질

**prisma/schema.prisma** (= 도메인 모델 3개)
```prisma
model User {
  id        String   @id @db.Uuid
  email     String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  
  stories   Story[]
  
  @@map("users")
}

model Story {
  id        String   @id @default(cuid())
  title     String
  content   String   @db.Text
  photoUrl  String?  @map("photo_url")
  userId    String   @map("user_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tags      Tag[]
  
  @@map("stories")
  @@index([userId])
  @@index([createdAt])
}

model Tag {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  
  stories   Story[]
  
  @@map("tags")
}
```

설계 결정:
- `User.id = String @db.Uuid` = Supabase auth.users.id 매칭
- `Story.id / Tag.id = cuid` = 짧고 충돌 없음
- `Story.photoUrl = nullable` = 사진 없는 글 허용
- `Story-Tag = 다대다` = Prisma가 `_StoryToTag` 자동 생성
- `onDelete: Cascade` = User 삭제 시 Story도 삭제
- `@@map` = snake_case 테이블/컬럼 이름 (= PostgreSQL 관례)

**prisma/migrations/<timestamp>_init_dotrip_domain/migration.sql** (= 자동 생성 / 줄 단위 검수)

```sql
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stories" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "photo_url" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_StoryToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_StoryToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- 인덱스 5개
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "stories_user_id_idx" ON "stories"("user_id");
CREATE INDEX "stories_created_at_idx" ON "stories"("created_at");
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");
CREATE INDEX "_StoryToTag_B_index" ON "_StoryToTag"("B");

-- 외래키 3개 (모두 Cascade)
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_StoryToTag" ADD CONSTRAINT "_StoryToTag_A_fkey" 
  FOREIGN KEY ("A") REFERENCES "stories"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_StoryToTag" ADD CONSTRAINT "_StoryToTag_B_fkey" 
  FOREIGN KEY ("B") REFERENCES "tags"("id") 
  ON DELETE CASCADE ON UPDATE CASCADE;
```

검수 포인트 (= ★★★★):
- 4개 테이블 ✅
- 타입 매칭 (UUID vs TEXT) ✅
- NOT NULL / nullable 정확 ✅
- 인덱스 5개 ✅
- 외래키 3개 + Cascade ✅
- til_entries 박지 않음 (= Supabase에서 직접 DROP)

**prisma/sql/rls.sql** (= 12개 정책)

```sql
-- users (3개)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_all" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert_own" ON users FOR INSERT
  WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (auth.uid() = id);

-- stories (4개)
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories_read_all" ON stories FOR SELECT USING (true);
CREATE POLICY "stories_insert_own" ON stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "stories_update_own" ON stories FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "stories_delete_own" ON stories FOR DELETE
  USING (auth.uid() = user_id);

-- tags (2개)
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_read_all" ON tags FOR SELECT USING (true);
CREATE POLICY "tags_insert_authenticated" ON tags FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- _StoryToTag (3개)
ALTER TABLE "_StoryToTag" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_tag_read_all" ON "_StoryToTag" FOR SELECT USING (true);
CREATE POLICY "story_tag_insert_own" ON "_StoryToTag" FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM stories WHERE id = "A")
  );
CREATE POLICY "story_tag_delete_own" ON "_StoryToTag" FOR DELETE
  USING (
    auth.uid() = (SELECT user_id FROM stories WHERE id = "A")
  );
```

velog 본질 매칭:
- 모든 사용자 = 모든 글 읽음
- 본인 글만 작성/수정/삭제
- 태그는 로그인한 사람 누구나 추가 (= 삭제 불가 / 안전)

**prisma/seed.ts** (= 이태원 클라쓰 시드)

```typescript
import { prisma } from "../lib/prisma";

async function main() {
  const user = await prisma.user.findFirst();

  if (!user) {
    console.log("⚠️ 사용자 없음. 먼저 회원가입 후 시드 실행.");
    return;
  }

  const tag1 = await prisma.tag.upsert({
    where: { name: "촬영지" },
    update: {},
    create: { name: "촬영지" },
  });
  const tag2 = await prisma.tag.upsert({
    where: { name: "이태원클라쓰" },
    update: {},
    create: { name: "이태원클라쓰" },
  });

  await prisma.story.create({
    data: {
      title: "이태원 클라쓰 단밤 포차 - 후암동 오리올",
      content:
        "드라마 속 '단밤' 포차의 실제 촬영지인 후암동 오리올에 다녀왔다. " +
        "이태원이 아닌 후암동 남산 아랫자락에 있는 게 의외였다. " +
        "3층 루프탑에서 보는 남산뷰가 압권. " +
        "박새로이의 가게가 그대로 남아있어서 감동.",
      photoUrl: null,
      userId: user.id,
      tags: {
        connect: [{ id: tag1.id }, { id: tag2.id }],
      },
    },
  });

  console.log("✅ 시드 완료");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

설계 결정:
- `tag.upsert` = 박힌 태그 박혀 있으면 재사용 / 없으면 박음
- `story.tags.connect` = 박은 태그 ID로 연결
- `findFirst` = 첫 사용자 박음 (= 시드 실행 전 회원가입 필요)
- 시드 = 0034 끝난 다음 실행 (= public.users row 박혀 있어야 함)

---

## 5. 결과 / 배운점

### 결과
- 도메인 테이블 3개 + 다대다 조인 테이블 1개 적용
- RLS 정책 12개 적용
- 시드 스크립트 박힘 (= 실행은 0034 이후)
- 커밋 4개 atomic 분할
- Vercel 빌드 통과 ✅
- 예상 시간 2시간 → 실제 1시간 35분 (= 5분 빠름)

### 함정 박힌 본질 (= 0033)

**1. cross-schema FK 박힘 (= P4002)**
- 박힘 = til_entries.user_id가 auth.users 참조 박은 본질
- Prisma 7 = cross-schema FK 박지 않으면 introspect 박지 못함
- 해결 = Supabase SQL Editor에서 `DROP TABLE til_entries CASCADE` 박은 다음 migrate
- 학습 = Prisma는 schema 박힌 본질만 박음. 다른 스키마(auth) 박지 못함.

**2. `--create-only` 박힌 본질**
- ★★★★ 등급에서 박는 본질
- migrate dev는 SQL + DB + generate 한꺼번에 박음
- `--create-only` = SQL만 박고 DB 박지 않음
- 검수 박은 다음 `migrate dev` (= 박힌 migration 적용)
- 학습 = 프로덕션 본질에서는 반드시 박는 패턴

**3. 커밋 메시지 한국어 vs 영어**
- 박힘 = "feat: prisma migration init_dotrip_domain" (= 영어)
- 갈음 = "feat: User/Story/Tag 테이블 마이그레이션 적용"
- amend로 갈음 박음 (= push 박지 않은 상태)
- 학습 = Conventional Commits 본질은 영어 OK인데, 본문은 한국어 박는 게 본질

**4. 표현 = 도메인 → 테이블**
- "도메인 마이그레이션" 박힌 본질이 추상적
- "테이블 마이그레이션" 박힌 본질이 직관적
- 메모리 박음 (= 한국어 표현에서 추상 용어 대신 구체 용어 선호)
- 학습 = 다층 표현 가능한 경우 가장 물리적·직관적인 표현 선택

**5. 시드 실행 시점**
- 시드 박힐 때 `prisma.user.findFirst()` 박은 본질
- 박힌 위험 = public.users 비어있으면 박지 못함
- 해결 = 시드 실행은 0034 (= signUp 갈음) 끝난 다음
- 학습 = 도메인 의존성 박힌 본질 박는 본질이 본질

### 배운점 박힌 본질

**1. ★★★★ 등급 검수의 본질**
- migration SQL 박힌 본질 줄 단위로 검수 박은 본질이 본질
- Claude Code 체크리스트 박힌 본질만으로는 부족
- 실제 SQL `cat` 박은 다음 직접 박는 본질
- 학습 = 보안/DB 변경/마이그레이션 = 항상 직접 검수

**2. atomic 커밋 분할의 본질**
- 4개 본질 (= schema / migration / RLS / seed) = 4개 커밋
- 한 커밋에 묶으면 git log 박힘 박지 못함
- 미래 bisect / 회고 박힐 때 명확한 본질
- 학습 = 한 본질 = 한 커밋 (= 0032에서 학습한 본질 매칭)

**3. Prisma + Supabase 본질**
- Prisma = schema 박힌 본질 관리
- Supabase = RLS / auth 박힌 본질 관리
- 두 박힌 본질 = 별도 박는 본질이 본질
- 박힐 본질 = `prisma/sql/` 폴더 박은 본질이 git 추적용

**4. 도메인 의존성 박힌 본질**
- public.users 박혀 있어야 stories 박힘
- 회원가입 박힐 때 동기화 박는 본질이 본질 (= 0034 박을 본질)
- 학습 = 외래키 박힌 본질 = 부모 row 먼저 박는 본질

**5. 시간 예상의 정확도**
- 예상 2시간 → 실제 1시간 35분
- 함정 박힌 본질 박혔지만 박힌 시간 박힌 본질 박지 못함
- 학습 = ★★★★ 등급은 시간 박힘 박을 본질이지만, 박은 본질이 명확하면 박는 본질이 박힘

---

## 결정 (Decisions)

- **til_entries 처리**: Supabase SQL Editor에서 직접 DROP (= 데이터 보존 가치 없음 / cross-schema FK 함정 회피).
- **모델 범위**: User + Story + Tag만 (= MVP / Spot/CostPlan은 미래 마이그레이션).
- **migration 이름**: `init_dotrip_domain` (= 도메인 전환 본질 명시).
- **--create-only 박은 본질**: ★★★★ 등급에서 SQL 검수 단계 추가.
- **RLS = Supabase SQL Editor**: Prisma는 RLS 관리 박지 못함 / 파일은 `prisma/sql/rls.sql`에 저장.
- **velog 본질 RLS**: 누구나 read / 본인만 insert/update/delete / 태그는 누구나 추가.
- **시드 = 이태원 클라쓰 단밤 포차**: 한국 + 촬영지 = Dotrip 컨셉 매칭.
- **시드 실행 시점**: 0034 끝난 다음 (= public.users row 박혀 있어야 함).
- **커밋 메시지 표현**: "테이블 마이그레이션" (= 도메인 아님 / 구체 용어).
- **기존 테스트 계정**: 마이그레이션 박지 않음 (= 새 계정만 사용 / 단순함 우선).

---

## 다음 작업 박힐 본질

```
0034 = signUp 갈음 + Story 피드 라우트
  - lib/auth/actions.ts에 prisma.user.create 추가
  - /dashboard 제거 + /story 라우트 박음
  - Story 피드 페이지 박음 (= 모든 글 박힘)
  - 새 계정으로 회원가입 + 시드 실행 검증

0035 = 스토리 작성 기능
  - /story/new 박음
  - 폼 (= 제목 / 본문 / 사진 / 태그)
  - Supabase Storage 박음
  - prisma.story.create 박음

0036 = Loading indicator (= 우선순위 낮음)
```

→ 박힐 본질 = "0034 끝나면 글 박힘 / 0035 끝나면 글 작성 박힘".
