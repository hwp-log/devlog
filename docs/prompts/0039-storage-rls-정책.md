# 0039: Supabase Storage 버킷 + RLS 정책 4개

## 한 줄 요약

`story-photos` 버킷 생성 + `storage.objects` 테이블에 RLS 정책 4개(SELECT/INSERT/UPDATE/DELETE) 추가해서 0040 이미지 업로드의 권한 기반을 완성.

## 왜·목적·이유

0040(Tiptap 이미지 업로드)을 시작하려면 먼저 파일을 어디에 저장하고 누가 어떤 권한으로 접근할지 결정돼 있어야 함. 이번 작업은 그 기반.

핵심 결정 4가지:

1. **버킷 이름 `story-photos`**: Story와 1:1 매핑이 명확하고, 나중에 Spot 사진은 별도 버킷(`spot-photos`)으로 분리 가능.
2. **Public 버킷**: Dotrip은 공개 여행 플랫폼. 사진도 공개가 자연스럽고, signed URL은 오버엔지니어링.
3. **RLS 정책 4개를 DB RLS와 별도로 추가**: Storage RLS는 `storage.objects` 테이블 대상 — 0033에서 다룬 `public.story` RLS와는 완전히 다른 레이어임을 인지.
4. **파일 경로 `{userId}/{uuid}.{ext}`**: RLS의 `(storage.foldername(name))[1]`이 userId여야 권한 검증 가능. 폴더 첫 세그먼트로 소유자 식별.

작업 전 web_search로 확인한 최신 정보:
- Supabase 새 키 형식(`sb_publishable_xxx`/`sb_secret_xxx`)이 표준 — 우리 `.env.local`은 이미 새 형식 사용 중.
- 2025년 1월 AI 도구로 만든 앱 170개가 DB 노출 — RLS 의식이 우리의 차별점.
- SQL Editor는 RLS를 우회함 → 검증은 반드시 클라이언트 SDK로.
- 성능 권장: RLS만 의존하지 말고 클라이언트 쿼리에 같은 필터 추가.

## 작성한 프롬프트

```
# 0039: Supabase Storage 버킷 + RLS 정책 설정

## 배경
0040(이미지 업로드) 기반 작업. Story 작성 시 사진을 저장할 곳이 필요.

⚠️ 사전 작업: Supabase 대시보드에서 버킷 직접 생성 (코드로 안 됨)

## 목표
story-photos 버킷 + 4개 RLS 정책으로 권한 제어.
0040에서 바로 쓸 수 있는 상태까지 완성.

## 작업 범위
Step 1: Supabase 대시보드에서 버킷 수동 생성
  - Name: story-photos
  - Public: ON
  - File size limit: 5 MB
  - Allowed MIME types: image/jpeg, image/png, image/webp

Step 2: 마이그레이션 SQL 작성
  - prisma/migrations/[timestamp]_storage_rls/migration.sql
  - SELECT (public): bucket_id = 'story-photos'
  - INSERT (authenticated): bucket_id + auth.uid()::text = (storage.foldername(name))[1]
  - UPDATE (authenticated): USING + WITH CHECK 양쪽 (폴더 이동 차단)
  - DELETE (authenticated): 동일 권한 검증

Step 3: 마이그레이션 적용
  - npx prisma migrate dev --name storage_rls --create-only
  - SQL 검수 (★★★★★)
  - npx prisma migrate deploy

Step 4: 파일 경로 규약 결정
  - {userId}/{uuid}.{ext}
  - 이유: RLS의 (storage.foldername(name))[1]이 userId 필요

## 하지 말 것
- 사용자 코드(actions.ts 등) 작성 — 0040 영역
- 실제 업로드 동작 테스트 — 0040에서 통합 검증
- public 대신 private 사용 — 오버엔지니어링
- SQL Editor에서 INSERT/SELECT 테스트 (RLS 우회됨, 클라이언트 SDK로 검증)

## 참조 패턴
- prisma/migrations/[기존]_rls/migration.sql (0033)
- CREATE POLICY ... FOR ... TO ... USING/WITH CHECK 동일 패턴

## 검수 모드
- ★★★★★ migration SQL — 4개 정책 줄 단위, auth.uid() 명시 확인
- ★★★ 버킷 설정 — MIME 타입, 크기 제한, public 확인
- ★ docs (DECISIONS.md 결정 추가)

## 커밋 2개
- chore: Supabase story-photos 버킷 생성
- feat: 0039 Storage RLS 정책 4개 추가
```

## 코드 작성 & 수정

### 마이그레이션 SQL

`prisma/migrations/20260523074954_storage_rls/migration.sql`

```sql
-- SELECT: 모든 사람이 사진 조회 가능
CREATE POLICY "story_photos_select" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'story-photos');

-- INSERT: 로그인한 사람만 본인 폴더에 업로드
CREATE POLICY "story_photos_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'story-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE: 본인 업로드만 수정 (USING + WITH CHECK 양쪽)
CREATE POLICY "story_photos_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'story-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'story-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: 본인 업로드만 삭제
CREATE POLICY "story_photos_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'story-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 사전 작업: Supabase 대시보드

- Storage → New bucket → `story-photos`
- Public: ON
- File size limit: 5MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

### 커밋 2개

```
2ad2c56 chore: Supabase story-photos 버킷 생성
6121d5c feat: 0039 Storage RLS 정책 4개 추가
```

중간에 git rebase가 꼬여서 `git reset --soft`로 정리하고 다시 커밋. Vim rebase는 위험하니 다음부터는 `git config --global core.editor "code --wait"`로 VSCode를 갈음해 사용 고려.

## 결과·배운점

**잘 된 점**

- 4개 정책 깔끔하게 추가, 마이그레이션 한 번에 성공.
- 0040에서 바로 `supabase.storage.from('story-photos').upload(...)` 호출 가능한 상태까지 완성.
- web_search로 SQL Editor RLS 우회 함정 미리 인지 → 검증을 클라이언트 SDK 단계로 미룸.

**알게 된 것 — Storage RLS는 별도 레이어**

처음에 "0033에서 했던 RLS와 같은 패턴이니까 금방 한다"고 생각했는데, 깊이 들어가니 완전히 다른 영역이었음.

| 항목 | DB RLS (0033) | Storage RLS (0039) |
|---|---|---|
| 대상 테이블 | `public.story`, `public.users` 등 | `storage.objects` |
| 식별 기준 | `auth.uid() = user_id` 컬럼 비교 | `auth.uid()::text = (storage.foldername(name))[1]` 경로 파싱 |
| 조회 권한 | authenticated 일반 | public (URL만 있으면 누구나) |
| 키 검증 | `id` 컬럼 | `name` 컬럼(파일 경로 문자열) |

**`storage.foldername(name)`이 핵심**: 파일 경로 문자열을 `/` 단위로 잘라서 배열로 반환. `[1]`은 첫 번째 세그먼트(= 우리 규약상 userId). 이게 동작하려면 파일 경로가 반드시 `{userId}/...` 형태여야 함 — 0040 업로드 코드 작성 시 이 규약 위반하면 권한이 완전히 풀림.

**UPDATE 정책에 USING + WITH CHECK 양쪽 적용한 이유**

처음에는 USING만 적었는데, 한 번 더 생각해보니 폴더 이동 공격이 가능했음:

- USING만: "내 폴더에 있는 파일을 수정할 수 있음" → 통과
- 공격 시나리오: `userA/photo.jpg`를 `userB/photo.jpg`로 이름 변경(=move) → USING은 변경 전 경로 검사라 통과 → 다른 사람 폴더에 파일 잠입 가능
- WITH CHECK 추가: 변경 후 경로도 검사 → 본인 폴더 밖으로 이동 차단

이건 web_search 결과에서 본 게 아니라 정책 의미를 곱씹다가 발견. 0033 DB RLS에는 이런 함정이 없음(컬럼 값을 사용자가 마음대로 못 바꾸니까). Storage는 경로가 사용자 입력이라 더 조심해야 함.

**Public 버킷 + RLS의 의미**

처음에 헷갈렸음 — "Public이면 누구나 볼 수 있는데 SELECT 정책이 왜 필요해?"

- Public = 버킷 자체가 공개 = URL이 있는 사람은 누구나 다운로드 가능
- SELECT 정책 = `storage.objects` 테이블 조회 권한 = "어떤 파일들이 있는지 목록 조회"
- 즉 Public이어도 SELECT 정책 없으면 파일 목록 API가 동작 안 함

→ 이 두 개념이 분리돼 있다는 걸 처음 알게 됨. 0040에서 사용자가 본인 업로드 목록을 보려면 SELECT 정책이 필수.

**다음 작업 우선순위 발견 — 보안 알림 8개**

마이그레이션 적용 후 Supabase 대시보드 Advisor에서 알림 8개 발견:

1. ★★★★★ `_prisma_migrations` 테이블 RLS 없음 (Critical) — 다음에 즉시 처리
2. ★★★★ `auth.uid()` 호출 7곳 성능 최적화 (`(select auth.uid())`로 감쌈)
3. ★★★ Function Search Path 미고정
4. ★★ Leaked Password Protection 비활성화

이번 회고에는 다루지 않지만, 8개 모두 별도 작업으로 분류해서 차후 처리 예정. RLS는 "정책을 추가하면 끝"이 아니라 성능과 우회 가능성까지 검토하는 영역이라는 걸 체감.

**현재 위치**

0039 완료 → 0040(이미지 업로드) 시작 가능.

`{userId}/{uuid}.{ext}` 규약과 RLS가 준비됐으니, 0040에서는 `supabase.storage.from('story-photos').upload()`만 호출하면 권한 검증이 자동 적용. Server Action에서 `auth.uid()`로 userId를 얻어 경로를 조립하는 방식으로 갈 예정.
