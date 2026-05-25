# 0036 — 스토리 작성 기능

## 한 줄 요약

/story/new 페이지 + "+ 스토리" 버튼 + Server Action으로 스토리 생성 MVP 구현.

## 왜 · 목적 · 이유

0034에서 /story 피드 페이지를 만들었지만 글 작성 진입점이 없었다. 시드 데이터로만 글이 채워지는 상태. 사용자가 직접 글을 작성할 수 있어야 실제로 동작하는 서비스라고 볼 수 있다.

청사진(시안 HTML)에는 작품/태그/사진/지도까지 있었지만, MVP로 제목+본문만 먼저 구현. 멘토링까지 시간이 빠듯해서 핵심 기능만 빠르게.

## 작성한 프롬프트

```
[목표]
MVP 박음:
1. /story 헤더에 "+ 스토리" 버튼 (= 로그인 시만)
2. /story/new 페이지
3. 제목 + 본문만 (= 작품/태그/사진/지도 빼)
4. Server Action으로 prisma.story.create
5. 작성 후 /story로 리다이렉트

[디자인 본질]
- "+ 스토리" 버튼: 검은 배경 + 흰 텍스트 + rounded-full
- /story/new 페이지:
  - 큰 제목: "새 스토리 작성"
  - 부제: "다녀온 그 장소, 당신의 이야기를 남겨주세요"
  - glass-outer 카드에 폼
  - 제목 input + 본문 textarea
  - "스토리 등록" 버튼 + loading indicator (= 0035 패턴 매칭)

[변경 범위]
1. app/story/layout.tsx — "+ 스토리" 버튼 추가
2. app/story/new/page.tsx — 신규 (Server Component)
3. app/story/new/StoryWriteForm.tsx — 신규 (Client Component)
4. app/story/new/actions.ts — 신규 (Server Action)

[하지 말 것]
❌ 작품 / 태그 / 사진 / 지도 빼 (= MVP)
❌ 임시 저장 빼
❌ markdown 에디터 빼 (= 일반 textarea)
❌ 새 라이브러리 추가하지 마
❌ schema.prisma 손대지 마

[검수]
- 등급: ★★★ (= 새 기능)
- /story/new 접속 (= 로그인 필요 / proxy.ts에 있음)
- 폼 제출 → /story로 리다이렉트
- 새 글이 피드 상단에 노출

[커밋]
feat: 0036 스토리 작성 기능 추가 (/story/new + 폼 + Server Action)
```

## 코드 작성 & 수정

### 1. /story/layout.tsx — "+ 스토리" 버튼

기존 헤더의 NavLinks와 사용자 정보 사이에 추가:

```tsx
{user && (
  <Link
    href="/story/new"
    className="bg-[#1A1A1A] text-white px-4 py-1.5 rounded-full text-sm"
  >
    + 스토리
  </Link>
)}
```

조건부 렌더(user 있을 때만). 비로그인 사용자는 버튼 안 보임.

### 2. /story/new/page.tsx — Server Component

```tsx
import { StoryWriteForm } from './StoryWriteForm';
import { createStoryAction } from './actions';

export default function StoryNewPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">새 스토리 작성</h1>
      <p className="text-sm text-slate-500 mb-6">
        다녀온 그 장소, 당신의 이야기를 남겨주세요
      </p>
      <div className="glass-outer p-8">
        <StoryWriteForm action={createStoryAction} />
      </div>
    </div>
  );
}
```

시안 매칭. 부제는 시안에서 그대로 가져옴.

### 3. /story/new/StoryWriteForm.tsx — Client Component

0035의 LoginForm.tsx 패턴 그대로 복제:

```tsx
'use client';
import { useActionState } from 'react';

export function StoryWriteForm({ action }) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction}>
      <input name="title" placeholder="제목" required />
      <textarea name="content" rows={10} placeholder="본문" required />
      {state?.error && <p className="text-red-500">{state.error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? '등록 중...' : '스토리 등록'}
      </button>
    </form>
  );
}
```

- `useActionState`로 isPending 받기
- 0035의 disabled + 텍스트 변경 패턴 매칭
- 에러는 state.error로 받아 표시

### 4. /story/new/actions.ts — Server Action

```typescript
'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function createStoryAction(prevState, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const title = formData.get('title')?.toString().trim() ?? '';
  const content = formData.get('content')?.toString().trim() ?? '';

  if (!title) return { error: '제목을 입력해주세요' };
  if (!content) return { error: '본문을 입력해주세요' };

  await prisma.story.create({
    data: { title, content, photoUrl: null, userId: user.id },
  });

  redirect('/story');
}
```

핵심:
- 인증 검증 우선 (= 로그인 안 되어 있으면 /login으로)
- 빈값 검증 (= 제목/본문)
- `userId: user.id` → 0034의 signUp 갈음 덕분에 public.users에 row 있어서 외래키 만족
- 작성 후 `redirect('/story')` → 피드로 이동

## 결과 · 배운점

### 결과

단일 커밋:
- `feat: 0036 스토리 작성 기능 추가 (/story/new + 폼 + Server Action)`

검증:
- "+ 스토리" 버튼 /story 헤더에 노출 (로그인 시) ✅
- /story/new 폼 작성 → /story로 리다이렉트 ✅
- 새 글이 피드 상단에 노출 ✅
- test@dotrip.com 계정으로 "이태원 클라스 - 단밤 그 골목, 박새로이가 서 있던 자리" 작성 성공 ✅
- 다른 사용자(hwp2024dev) 글과 함께 피드에 표시 ✅

### 함정

거의 없음. 0034에서 public.users 동기화가 끝나 있었고, 0035에서 폼 패턴이 확립되어 있어서 거의 보일러플레이트 작성 수준.

유일한 짚을 점:
- **시안과 MVP의 간극**: 시안에는 작품/태그/사진/지도 다 있는데 MVP는 제목+본문만. 멘토에게 "MVP라서 빼고, 다음 작업에서 추가할 본질"로 명확히 설명할 필요.

### 배운점

- **0034가 0036을 가능하게 함**: signUp의 prisma.user.create 덕분에 외래키 제약이 만족됨. 만약 0034를 건너뛰었으면 createStoryAction에서 `user_id is not present in table "users"` 에러 났을 것.
- **0035 패턴 재사용**: useActionState + isPending + disabled 패턴을 그대로 복제. 매번 새로 짤 필요 없음. 일관된 UX.
- **Server Action redirect의 함정 회피**: redirect()는 throw 방식이라 try/catch 안에 두면 안 됨. createStoryAction에서는 prisma.story.create 후 바로 redirect → 정상 작동.
- **MVP 정의의 가치**: "지금 빼는 것"을 명확히 결정하면 시간 박힘 박힐 위험 줄어듦. 작품/태그/사진/지도를 시간에 쫓겨 어설프게 박는 것보다, 다음 작업에서 제대로 박는 게 본질.

### 시간

예상 50분 → 실제 약 30분. 패턴이 명확해서 빠르게 진행.

### 다음 작업 연결

0036 완료 후:
- 스토리 작성 가능 → 0037에서 본인 글 수정/삭제 진입점 가능
- StoryWriteForm 존재 → 0037에서 props 확장으로 수정 폼 재사용 (= Jason Watmore 패턴)
