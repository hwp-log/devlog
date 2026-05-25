# 0034 — signUp 동기화 + Story 피드 + 라우트 정리

## 한 줄 요약

회원가입 시 public.users 자동 생성 + /dashboard 제거 후 /story 피드 페이지 신설.

## 왜 · 목적 · 이유

0033에서 도메인 테이블(User/Story/Tag/_StoryToTag)을 만들었지만, 사용자가 회원가입해도 public.users는 비어 있었다. Supabase Auth가 관리하는 auth.users와 우리 도메인 테이블 public.users가 분리되어 있어, 두 테이블을 동기화하는 코드가 필요했다.

동시에 DevLog 시절의 /dashboard 라우트는 Dotrip 컨셉(velog 형식의 누구나 보는 피드)과 맞지 않아 제거하고, /story 라우트로 전환했다.

## 작성한 프롬프트

```
[배경]
0033에서 도메인 테이블 작성 완료. 회원가입해도 public.users는 비어있는 상태.

[목표]
1. signUp Server Action에 prisma.user.create 추가 (auth.users + public.users 동기화)
2. /dashboard 폴더 제거 + /story 폴더 신설
3. /story 피드 페이지 (Server Component / prisma.story.findMany)
4. proxy.ts 갈음 (/dashboard 보호 제거, /story/new 보호 추가)
5. NavLinks의 /dashboard 링크를 /story로 갈음

[하지 말 것]
❌ /story/new 작성 페이지 (= 0036)
❌ 수정/삭제 기능
❌ 기존 auth.users → public.users 마이그레이션 (= 새 계정만)
❌ schema.prisma 손대지 마

[검수]
- ★★★★★ signUp 갈음 (보안/인증)
- ★★★ /story 피드 페이지
- ★★ 라우트 갈음

[커밋 계획]
3개 분할:
1. feat: signUp Server Action 갈음
2. refactor: /dashboard 제거 + /story 라우트 신설
3. feat: Story 피드 페이지 추가
```

## 코드 작성 & 수정

### 1. signUp 동기화 (lib/auth/actions.ts)

```typescript
const { data, error } = await supabase.auth.signUp({ email, password });

if (error) return { error: error.message };

if (data.user) {
  try {
    await prisma.user.create({
      data: { id: data.user.id, email: data.user.email! },
    });
  } catch (e) {
    console.error('public.users 생성 실패:', e);
  }
}
```

핵심:
- `data.user.id`를 그대로 public.users.id로 사용 (= auth.users와 동일 UUID)
- try/catch로 prisma 실패가 auth.users 생성을 방해하지 못하게 격리

### 2. 라우트 정리

- `app/(protected)/dashboard/` 폴더 통째로 삭제 (5개 파일)
- `app/(protected)/dashboard/LogoutButton.tsx`를 `app/(protected)/_components/`로 이전
- signOut 로직을 `lib/auth/actions.ts`로 통합 (signIn/signUp과 같은 위치)
- proxy.ts에서 /dashboard 보호 제거 + /story/new 보호 추가 + /dashboard → /story 리다이렉트
- NavLinks의 isActive 로직 단순화 (pathname.startsWith)

### 3. /story 피드 페이지

`app/story/page.tsx` (Server Component):

```typescript
const stories = await prisma.story.findMany({
  include: { user: true, tags: true },
  orderBy: { createdAt: 'desc' },
});
```

`app/story/layout.tsx`: 조건부 헤더 (로그인 시 NavLinks + 사용자 정보 + 로그아웃 / 비로그인 시 로그인 링크).

### 4. 추가 발견: /dashboard 잔존

grep으로 확인하니 3개 파일에 /dashboard 남아 있었음:
- `app/(auth)/login/actions.ts:12` (redirect)
- `app/page.tsx:10` (홈 리다이렉트)
- `app/(auth)/login/__tests__/actions.test.ts` (테스트)

모두 /story로 갈음.

### 5. 시드 환경변수 로드 수정

`npm run db:seed` 실행 시 DATABASE_URL이 undefined. ESM 환경에서 `lib/prisma` import가 dotenv 호출보다 먼저 평가되는 문제. 해결: `package.json`에서 `--env-file=.env.local` 플래그 사용 (Node 22 기본 지원).

```json
"db:seed": "node --env-file=.env.local node_modules/.bin/tsx prisma/seed.ts"
```

## 결과 · 배운점

### 결과

커밋 6개 push:
- `73e13c0` feat: signUp Server Action 갈음 - public.users 자동 생성
- `73bff70` refactor: /dashboard 제거 + /story 라우트로 proxy/NavLinks + LogoutButton 이전
- `c227459` feat: Story 피드 페이지 추가
- `a6d593e` fix: 0034 로그인/홈 리다이렉트 dashboard에서 story로 변경
- `9cb570e` fix: 0034 /story 헤더에 NavLinks/사용자 정보 조건부 추가
- `85c233f` fix: 0034 시드 환경변수 로드 + 디버깅 로그 제거

검증:
- 새 계정 회원가입 → auth.users + public.users 동시 생성 ✅
- npm run db:seed → 이태원 클라쓰 단밤 포차 글 생성 ✅
- /story → 글 + 작성자 + 태그 + 날짜 표시 ✅
- 비로그인 사용자도 /story 접근 가능 ✅
- 다른 사용자 글도 표시 (RLS read_all 정상 작동) ✅

### 함정 8개

1. **dashboard 폴더 삭제하니 LogoutButton 사라짐**
   - layout.tsx가 dashboard/LogoutButton를 import 중이었음
   - 즉흥적으로 `_components/` 폴더 신설해서 이전

2. **amend 시 staged 안 된 파일 누락**
   - `git add` 명시적으로 안 하면 새 파일은 amend에 포함 안 됨
   - "9 files changed"인데 `_components/LogoutButton.tsx`가 deleted 목록에만 있고 created에 없는 걸 보고 발견

3. **import만 갈음하면 JSX/Link 잔존**
   - Claude Code가 첫 시도에 import만 갈음
   - JSX의 `signOutAction` props와 Link의 `href="/dashboard"`는 별도 갈음 필요
   - diff 검수 단계에서 발견하지 못하면 빌드 실패

4. **/dashboard 잔존 위치 3곳**
   - 처음에 proxy.ts와 NavLinks만 보고 끝낸 줄 알았음
   - 로그인했더니 /dashboard로 리다이렉트되어서 발견
   - grep으로 전수 조사 필수

5. **seed.ts ESM dotenv 함정**
   - `import { config } from "dotenv"` 추가했는데 효과 없음
   - 이유: ESM에서 모든 import가 먼저 평가됨 → `lib/prisma`의 PrismaPg가 undefined DATABASE_URL로 초기화됨
   - 해결: `node --env-file=.env.local` (Node 22 기본 지원)

6. **Supabase 이메일 rate limit**
   - 회원가입 디버깅 중 여러 번 시도하다가 `over_email_send_rate_limit` (429)
   - 무료 플랜은 시간당 이메일 발송 제한
   - 해결: Confirm Email 토글 OFF

7. **Email provider 토글 잘못 끔**
   - "Confirm Email"을 끄려다 "Enable Email Signups"를 꺼서 `email_provider_disabled` 에러
   - Supabase UI에서 두 토글이 비슷한 위치에 있어 혼동
   - 정확히 "Confirm Email"만 OFF

8. **auth.users vs public.users 혼동**
   - "테이블 다 지웠는데 어떻게 로그인이 되지?"라고 혼란
   - auth.users는 Supabase가 관리하는 별도 스키마 → 우리가 삭제 안 했음
   - 0033의 til_entries DROP은 public 스키마만 영향
   - 두 사용자 테이블의 역할 분리를 다시 명확히 인식

### 배운점

- **Supabase의 두 사용자 테이블**: auth.users는 인증 전용 (Supabase 관리), public.users는 도메인 데이터용 (우리 관리). 회원가입 시 두 테이블 동기화 필요.
- **try/catch 격리 패턴**: 보조 작업(prisma.user.create) 실패가 주 작업(auth.users 생성)을 방해하지 못하게 격리. 로그만 남기고 사용자에게는 성공으로 응답.
- **ESM dotenv 함정 회피**: Node 22의 `--env-file` 플래그가 가장 안전. import 평가 순서 문제 자체를 우회.
- **diff 검수의 한계**: import만 갈음됐는데 끝난 줄 알기 쉬움. JSX/Link/문자열 grep으로 전수 조사 필수.
- **개발 환경 Supabase 설정**: Confirm Email은 OFF (rate limit 회피). 프로덕션에서는 반드시 ON.
- **컴포넌트 위치 결정**: dashboard 같은 페이지 폴더에 공용 컴포넌트(LogoutButton) 두면 페이지 제거 시 부작용. `_components/` 같은 공용 위치가 안전.

### 다음 작업 연결

0034 완료 후:
- public.users에 데이터 있어 외래키 만족 → 0036에서 Story 생성 가능
- /story 피드 페이지 존재 → 0036에서 새 글 작성 후 리다이렉트 가능
- signOut을 lib/auth/actions.ts로 통합 → 일관된 import 경로
