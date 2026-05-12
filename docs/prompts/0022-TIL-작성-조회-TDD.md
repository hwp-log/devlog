# 0022 회고: TIL 작성/조회 TDD

**작성일**: 2026-05-12
**소요 시간**: 약 6시간 (5/11 ~ 5/12 분산)
**관련 커밋**: feat - 0022 TIL 작성/조회 추가 (스키마 + Server Action + 페이지)

---

## 한 줄 요약

til_entries 스키마 + RLS 임시 정책 + createTilEntry / getTilEntries Server Action TDD + 작성/목록 페이지 구현.
LLM 관성으로 Refactor 단계에 새 동작 박힘 → Cycle 1.5로 분리해서 기존 TDD 흐름(RED/GREEN/Refactor)을 방해하지 않고 유지.

> **RLS (Row Level Security)**
> Postgres의 행 단위 접근 제어 기능.
> Supabase에서 "본인 글은 본인만 본다" 같은 정책을 DB 차원에서 강제할 때 사용.
> 클라이언트가 anon key로 직접 DB 접근해도 RLS 정책이 차단.
> 
> **0022 RLS 임시 정책 적용 이유**:
> - RLS 없이 생성할 경우: anon key 노출시 DB내용 접근 가능 (보안 약함)
> - RLS만 활성화: 모든 접근 거부로 인해, 기본 테스트(작성/조회) 확인이 불가 (작업 막힘)
> - 임시 정책으로 anon 차단 + 인증된 테스트 사용자들만 작업 허용. 사용자별 볼 수 있는 한도 격리는 0023에서.
> 
> ```sql
> -- 임시 정책: 인증된 사용자 전체 접근 허용 (anon key만 차단)
> CREATE POLICY "auth_users_full_access_temp" ON til_entries
>   FOR ALL
>   TO authenticated
>   USING (true)
>   WITH CHECK (true);
> ```
> - `TO authenticated`: 인증된 테스트 계정들만 정책 대상 (anon 차단)
> - `USING (true)`: 조회 시 모든 행 허용
> - `WITH CHECK (true)`: 작성 시 모든 입력 허용
> - 0023 정식: `USING (auth.uid() = user_id)` 로 교체 (본인 행만 = 사용자 격리)

> **위험 인지**: 
> production은 자동 배포되지만 시연용 단계로 외부 URL 공유 X.
> 위험은 인지하고 있어 테스트 데이터만 입력, 실제 개인 데이터는 입력하지 않은 상태.
> 다음 단계 0023 작업에서는 정식 격리 정책(RLS) 반드시 적용할 것.
> 또한 실무에서도 RLS를 바로 적용하여 테스트 할 것.

> **anon key**
> Supabase가 자동 생성하는 클라이언트용 공개 API 키.
> 브라우저에 노출되어 누구나 보유 가능.
> 실제 데이터 접근 권한은 RLS 정책이 결정.
> 즉 anon key 자체는 "DB 접근 시도" 권한만, 실제 접근 가능 여부는 RLS가 통제.

> **Server Action**
> Next.js 13+에서 서버에서 실행되는 함수.
> form 제출이나 클라이언트 이벤트로 호출 가능.
> 'use server' 지시어로 선언.
> 데이터 처리(DB 작업, 인증 검증) 담당.

> **TDD Cycle**
> Red → Green → Refactor 3단계 반복.
>
> Red: 실패하는 테스트 먼저 작성.
> Green: 테스트 통과시키는 최소 코드 작성.
> Refactor: 동작 유지하면서 코드 정리.

---

## 이번 작업의 3가지 핵심 요소

### 1. LLM 관성과 Cycle 분리

createTilEntry Cycle 1 Refactor 단계에서 Claude Code가 DB 에러 핸들링을 함께 추가하려 함. DB 에러 핸들링은 새 동작이라 Refactor 영역이 아닌데, LLM이 "함수를 미완성으로 두지 않으려는 관성" 때문에 한 번에 작성하는 경향을 보임.

**배운점**: TDD에서 Refactor 단계는 동작 변경 없이 코드 구조만 정리하는 단계. 새 동작(에러 분기 추가)을 Refactor에 넣으면 "테스트 없이 작성된 코드"가 생김. LLM이 자동으로 채우려는 부분을 인지하고 별도 Cycle + 0.5(DB 에러 핸들링)로 분리해서 Red → Green 흐름 유지. 0019에서도 동일 패턴이 짚인 적 있어서 두 번째 인지. 이 분리 덕분에 모든 동작에 대응 테스트가 작성된 상태로 끝남.

### 2. RLS 임시 정책 단계적 도입

til_entries 테이블 생성 시 Supabase 대시보드가 "RLS 없이 생성" vs "RLS 활성화" 옵션을 제시. RLS 없이 생성하면 anon key로 누구나 접근 가능한 보안 구멍 발생. RLS 활성화하면 정책이 없어서 모든 접근이 거부되어 오늘 작업 자체가 막힘.

**배운점**: 작성/조회 기능테스트를 위한 임시 정책(`FOR ALL TO authenticated USING (true)`)을 적용. 이 정책은 anon key 접근을 차단하면서 인증된 사용자에게는 전체 접근을 허용. 0023에서 정식 정책(`auth.uid() = user_id`)으로 교체하기로 계획.

### 3. Server Component와 Server Action의 테스트 분리

createTilEntry / getTilEntries(비즈니스 로직)는 TDD 5사이클 + 3사이클로 작성. 반면 /til/new 페이지 / /til 페이지(렌더링)는 TDD 없이 구현하고 통합 검증으로 갈음.

**배운점**: 검증 방식을 책임에 따라 분리. Server Action은 인증 / 입력 검증 / DB 호출 / 에러 처리 같은 분기 로직이 많아서 TDD로 각 분기를 격리 검증할 가치가 큼. Server Component는 데이터를 받아 JSX로 렌더링하는 시각적 영역이라 브라우저 통합 검증이 더 효과적. 모든 코드에 일률적으로 TDD 적용하지 않고 "검증 방식의 목적"을 생각하며 효율적인 테스트 방식을 결정해야 함.

---

## 작업에서 작성한 프롬프트

### til_entries 임시 스키마 마이그레이션

```
[배경]
0021(대시보드+로그아웃+인증가드)에서 인증 시스템 완성. 배포 검증 끝.
이제 DevLog 핵심 테이블 til_entries 필요. 오늘(5/11) 컨디션 이슈로 3시간 모드, 임시 스키마만.

[목표]
til_entries 테이블 임시 스키마 마이그레이션. 5컬럼(id/user_id/title/content/created_at).

[하지 말 것]
- RLS 정책 ❌ (5/13 학습 모드)
- tags 컬럼 ❌ (5/13 정식 설계)
- updated_at ❌ (수정 기능 작업 시)
- 인덱스 ❌ (5/13 학습 모드)
- TypeScript 타입 자동 생성 ❌ (다음 작업)

[검수 모드]
- Supabase 마이그레이션 파일: supabase/migrations/YYYYMMDD_create_til_entries.sql
- FK: user_id → auth.users(id) on delete cascade
- 타입: uuid / text / timestamptz
- 적용: 대시보드 SQL Editor (CLI 미설치)

plan 요청.
```

> **마이그레이션 (Migration)**
> DB 스키마 변경 이력을 파일로 관리하는 방법.
> SQL 파일 1개 = 1번의 스키마 변경.
> 같은 파일을 어디서 실행해도 동일한 DB 구조 재현 가능.
> 0022에서는 대시보드 SQL Editor에 직접 적용, 파일은 git 이력 관리용.

### createTilEntry Server Action

```
[배경]
0022 til_entries 스키마 + RLS + 임시 정책까지 적용. 
이제 INSERT하는 Server Action 작성.

[목표]
createTilEntry Server Action TDD 작성. 3사이클(성공/인증가드/입력검증).

[하지 말 것]
- UI 컴포넌트 ❌ (다음 작업)
- updateTilEntry ❌ (수정 기능)
- deleteTilEntry ❌ (삭제 기능)
- tags 처리 ❌ (5/13 학습 모드)
- 0019 인증 가드 헬퍼 추출 ❌ (Refactor 단계에서 검토만)

[참조 패턴]
0019 signInAction의 Server Action 분리 패턴.
- 컴포넌트와 같은 파일 X, 별도 actions.ts
- jest.mock으로 supabase 클라이언트 mock
- 결과 타입: { data } | { error } union

[검수 모드]
- TDD Red → Green → Refactor 3사이클 분리
- Cycle 1: 성공 케이스 (INSERT 성공 + 결과 반환)
- Cycle 2: 인증 가드 (세션 없으면 에러)
- Cycle 3: 입력 검증 (title/content 빈 문자열 거부)
- 각 Cycle 끝날 때 npm test 통과 확인

plan 요청.
```

### TIL 작성 페이지 /til/new

```
[배경]
0022 Phase 1(createTilEntry 5사이클 TDD) 완료.
이제 사용자가 폼에서 TIL 작성하는 페이지 필요.

[목표]
/til/new 페이지 = TIL 작성 폼. createTilEntry 호출 → 성공 시 /til로 redirect.

[하지 말 것]
- TDD ❌ (시간 압박, 패턴 검증된 영역)
- TIL 목록 페이지 ❌ (Phase 4)
- 인증 가드 추가 ❌ (proxy.ts 처리)

[참조 패턴]
0019/0020 로그인/회원가입 페이지 3파일 분리 패턴.
- page.tsx (Server Component, 그릇)
- TilForm.tsx (Client Component, useActionState)
- actions.ts (Server Action, formData → createTilEntry 호출)

[검수 모드]
- Server Component / Client Component 분리
- useActionState 패턴
- (protected) 라우트 그룹
- 성공 시 /til로 redirect

plan 요청.
```

### getTilEntries Server Action

```
[배경]
0022 Phase 1(createTilEntry 3사이클) + Phase 2(/til/new) 완료.
이제 조회 Server Action 작성.

[목표]
getTilEntries Server Action TDD 작성. 2사이클(본인 글만 조회 / 인증 가드).

[하지 말 것]
- UI 컴포넌트 ❌ (Phase 4)
- updateTilEntry ❌
- deleteTilEntry ❌
- 페이지네이션 ❌
- 정렬 옵션 ❌ (created_at DESC 고정)

[참조 패턴]
0022 Phase 1 createTilEntry 패턴.
- 같은 파일에 추가
- 응답 형식: { data: { entries } } | { error: string }
- DB 에러 핸들링: Cycle 1.5로 분리

[검수 모드]
- TDD Red → Green → Refactor 2사이클 분리
- Cycle 1: 본인 글만 조회 (user_id 필터 + created_at DESC)
- Cycle 1.5: DB 에러 (createTilEntry 패턴 일관)
- Cycle 2: 인증 가드 (세션 없으면 에러)

plan 요청.
```

### TIL 목록 페이지 /til

```
[배경]
0022 Phase 3(getTilEntries TDD 3사이클) 완료.
이제 TIL 목록 페이지 작성.

[목표]
/til 페이지 = 본인 TIL 목록 표시. 카드 UI 단순.

[하지 말 것]
- TDD ❌ (Server Component, 통합 검증으로 갈음)
- 페이지네이션 ❌
- 검색/필터 ❌
- 상세 페이지 링크 ❌
- 수정/삭제 버튼 ❌

[참조 패턴]
0021 대시보드 페이지.
- Server Component (async)
- (protected) 라우트 그룹
- await로 데이터 조회

[검수 모드]
- Server Component (async)
- await getTilEntries() 호출
- 빈 상태 처리 ("아직 TIL이 없어요" + /til/new 링크)
- 카드 UI: title / content 일부 / created_at
- Tailwind 기본 (slate 컬러 일관)

plan 요청.
```

### proxy.ts 인증 가드 확장

```
[배경]
/til/new + /til 페이지 작성 완료. 
인증 가드 확인하니 proxy.ts guard 조건에 /til 누락.

[목표]
proxy.ts guard 조건에 /til 추가. 비로그인 사용자 차단.

[하지 말 것]
- 다른 라우트 추가 ❌
- 로직 변경 ❌ (조건만 추가)

[참조 패턴]
0021 proxy.ts. 현재 가드: pathname.startsWith('/dashboard')

[검수 모드]
- guard 조건 한 줄 수정
- /til과 /til/new 모두 매칭되는 패턴

plan 요청.
```

---

## 코드 변화 (실제 결과물)

### 1. til_entries 스키마 + RLS 임시 정책 (신규)

```sql
-- supabase/migrations/20260511_create_til_entries.sql
CREATE TABLE til_entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE til_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_users_full_access_temp" ON til_entries
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

### 2. Server Action (createTilEntry + getTilEntries) (신규)

```typescript
// lib/til/actions.ts
import { createClient } from '@/lib/supabase/server';

export async function createTilEntry(title: string, content: string) {
  if (title.trim() === '') {
    return { error: '제목을 입력해주세요' };
  }
  if (content.trim() === '') {
    return { error: '내용을 입력해주세요' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다' };
  }

  const { data, error } = await supabase
    .from('til_entries')
    .insert({ user_id: user.id, title, content })
    .select()
    .single();

  if (error) {
    return { error: 'TIL 저장에 실패했습니다' };
  }

  return { data: { entry: data } };
}

export async function getTilEntries() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: '로그인이 필요합니다' };
  }

  const { data, error } = await supabase
    .from('til_entries')
    .select()
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return { error: 'TIL 조회에 실패했습니다' };
  }

  return { data: { entries: data } };
}
```

### 3. TIL 작성 페이지 폼 액션 (신규)

```typescript
// app/(protected)/til/new/actions.ts
'use server';
import { redirect } from 'next/navigation';
import { createTilEntry } from '@/lib/til/actions';

export async function createTilEntryAction(_prevState: unknown, formData: FormData) {
  const result = await createTilEntry(
    formData.get('title') as string,
    formData.get('content') as string,
  );
  if (result && 'data' in result) {
    redirect('/til');
  }
  return result;
}
```

### 4. TIL 목록 페이지 (Server Component) (신규)

```typescript
// app/(protected)/til/page.tsx
import { getTilEntries } from '@/lib/til/actions';
import Link from 'next/link';

export default async function TilPage() {
  const result = await getTilEntries();

  if ('error' in result) {
    return <p className="text-sm text-red-600">{result.error}</p>;
  }

  const entries = result.data.entries as TilEntry[];

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-slate-500">
        <p>아직 TIL이 없어요</p>
        <Link href="/til/new">첫 TIL 작성하기</Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {entries.map((entry) => (
        <li key={entry.id}>
          <h3>{entry.title}</h3>
          <p className="line-clamp-2">{entry.content}</p>
          <time>{new Date(entry.created_at).toLocaleDateString('ko-KR')}</time>
        </li>
      ))}
    </ul>
  );
}
```

### 5. proxy.ts 인증 가드 확장 (변경)

```typescript
// proxy.ts (인증 가드 조건 확장: /dashboard → /dashboard + /til)

// 변경 전
if (!user && pathname.startsWith('/dashboard')) {
  return NextResponse.redirect(new URL('/login', request.url))
}

// 변경 후
if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/til'))) {
  return NextResponse.redirect(new URL('/login', request.url))
}
```

---

## 다음 작업

0023 RLS 정식 정책 (auth.uid() = user_id) 적용 → 0024 연속 기록일 통계 위젯 작성 → 0025 TIL 상세/수정/삭제 추가