# 0037 — 스토리 상세 페이지 + 수정/삭제

## 한 줄 요약

/story/[id] 상세 페이지 + /story/[id]/edit 수정 페이지 + 본인 글만 수정/삭제 가능하게 권한 검증.

## 왜 · 목적 · 이유

0036에서 스토리 작성은 됐지만 작성 후 다시 손볼 수 없었다. 오타 수정도 못하고, 잘못 올린 글 삭제도 못함. velog 패턴 매칭으로 상세 페이지 + 수정/삭제 기능 추가.

처음엔 "본인 글 카드 클릭 시 바로 수정 페이지로" 박을까 했지만, 멘토링 직전 검색해서 velog 패턴을 따르기로 결정:
- 모든 카드 클릭 가능 → /story/[id] 상세 페이지
- 상세 페이지에서 본인 글만 [수정][삭제] 버튼 표시

이게 직관적이고 다른 사람 글도 차분히 읽을 수 있는 구조.

## 작성한 프롬프트

```
[패턴 = velog 매칭]
- 모든 카드 클릭 → 상세 페이지
- 상세 페이지에 본인 글이면 [수정] [삭제] 버튼 박힘
- 수정 페이지 = 작성 페이지와 같은 폼 박음

[변경 범위]

1. app/story/page.tsx — 갈음
   - 카드 전체를 Link로 감쌈 (= href="/story/[id]")
   - hover 효과 추가

2. app/story/[id]/page.tsx — 신규 (상세 페이지)
   - Server Component / dynamic route
   - prisma.story.findUnique + include user/tags
   - 본인 글이면 [수정] [삭제] 버튼 박힘
   - 권한 검증: currentUser?.id === story.userId

3. app/story/[id]/edit/page.tsx — 신규 (수정 페이지)
   - 본인 글 아니면 redirect /story/[id]
   - StoryWriteForm에 initialData prop으로 박음
   - action = updateStoryAction.bind(null, story.id)

4. app/story/new/StoryWriteForm.tsx — 갈음
   - props 추가: initialData?, storyId?
   - isEditMode = !!initialData
   - input/textarea에 defaultValue
   - 버튼 분기: !isEditMode → "스토리 등록" / isEditMode → "수정"

5. app/story/[id]/actions.ts — 신규
   - updateStoryAction(storyId, prevState, formData)
   - deleteStoryAction(storyId)
   - 권한 검증 (= story.userId === user.id)

6. app/story/[id]/DeleteButton.tsx — 신규 (Client)
   - 'use client'
   - window.confirm + deleteStoryAction 호출

[하지 말 것]
❌ 댓글 빼
❌ 좋아요 빼
❌ markdown 렌더링 빼 (= 일반 텍스트 / whitespace-pre-wrap)

[검수]
- ★★★★★ updateStoryAction / deleteStoryAction (= 권한 검증 필수)
- ★★★ app/story/[id]/page.tsx (= 본인 글 분기)

[커밋]
feat: 0037 스토리 상세 페이지 + 수정/삭제 기능 추가
```

## 코드 작성 & 수정

### 1. /story/page.tsx — 카드 클릭 가능하게

```tsx
<Link
  key={story.id}
  href={`/story/${story.id}`}
  className="glass-outer p-6 block hover:shadow-lg transition-all duration-300 ease-in-out cursor-pointer"
>
  <article>...</article>
</Link>
```

처음엔 `transition-shadow`만 썼는데 너무 즉시 적용돼서 어색. `duration-300 ease-in-out` 추가해서 부드럽게.

### 2. /story/[id]/page.tsx — 상세 페이지

```tsx
const supabase = await createClient();
const { data: { user: currentUser } } = await supabase.auth.getUser();
const story = await prisma.story.findUnique({
  where: { id },
  include: { user: true, tags: true },
});
if (!story) notFound();

const isOwner = currentUser?.id === story.userId;
```

레이아웃:
- glass-outer 카드
- h1 (text-3xl)
- 작성자 이메일 + 날짜
- 본문 (whitespace-pre-wrap)
- 태그
- isOwner 시 우측 상단에 [수정] Link + [삭제] DeleteButton

### 3. /story/[id]/actions.ts — Server Actions (★★★★★)

```typescript
export async function updateStoryAction(storyId, prevState, formData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story || story.userId !== user.id) {
    return { error: '권한 없음' };
  }

  const title = formData.get('title')?.toString().trim() ?? '';
  const content = formData.get('content')?.toString().trim() ?? '';
  if (!title) return { error: '제목을 입력해주세요' };
  if (!content) return { error: '본문을 입력해주세요' };

  await prisma.story.update({
    where: { id: storyId },
    data: { title, content },
  });
  redirect(`/story/${storyId}`);
}

export async function deleteStoryAction(storyId) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story || story.userId !== user.id) {
    throw new Error('권한 없음');
  }

  await prisma.story.delete({ where: { id: storyId } });
  redirect('/story');
}
```

★★★★★ 핵심:
- 인증 검증 (getUser)
- 소유권 검증 (story.userId === user.id)
- 두 검증을 모두 통과해야 update/delete 실행

### 4. StoryWriteForm.tsx — props 확장

```typescript
interface StoryWriteFormProps {
  action: (prevState, formData) => Promise<ActionState>;
  initialData?: { title: string; content: string };
}

export function StoryWriteForm({ action, initialData }: StoryWriteFormProps) {
  const isEditMode = !!initialData;
  // ...
  <input defaultValue={initialData?.title ?? ''} />
  <textarea defaultValue={initialData?.content ?? ''} />
  <button>
    {initialData
      ? (isPending ? '수정 중...' : '수정')
      : (isPending ? '등록 중...' : '스토리 등록')}
  </button>
}
```

Jason Watmore 패턴 매칭 (= initialData 있으면 edit mode).

### 5. /story/[id]/edit/page.tsx — 수정 페이지

```tsx
const story = await prisma.story.findUnique({ where: { id } });
if (!story) notFound();

const { data: { user } } = await supabase.auth.getUser();
if (!user || user.id !== story.userId) redirect(`/story/${id}`);

const boundAction = updateStoryAction.bind(null, story.id);

return (
  <StoryWriteForm
    action={boundAction}
    initialData={{ title: story.title, content: story.content }}
  />
);
```

`bind(null, story.id)` → storyId가 고정된 새 함수 박힘. useActionState 시그니처(`(prevState, formData) => result`) 매칭.

### 6. DeleteButton.tsx — Client Component

```tsx
'use client';
import { useTransition } from 'react';

export function DeleteButton({ storyId }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    startTransition(() => { deleteStoryAction(storyId); });
  }

  return (
    <button onClick={handleClick} disabled={isPending}>
      {isPending ? '삭제 중...' : '삭제'}
    </button>
  );
}
```

window.confirm 박음 (= MVP / 모달 라이브러리 안 박음).

## 결과 · 배운점

### 결과

커밋 2개:
- `feat: 0037 스토리 상세 페이지 + 수정/삭제 기능 추가`
- `fix: 0037 스토리 카드 hover transition 부드럽게 갈음`

검증:
- /story 카드 클릭 → /story/[id] 상세 진입 ✅
- 본인 글 상세 → [수정] [삭제] 노출 ✅
- 다른 사람 글 상세 → 버튼 숨김 ✅
- 비로그인 상태에서도 상세 페이지 조회 가능 ✅
- 수정 페이지 → 기존 내용 prefill ✅
- 수정 제출 → /story/[id]로 리다이렉트 ✅
- 삭제 → confirm 다이얼로그 → /story로 리다이렉트 ✅
- hover transition 부드럽게 동작 ✅

### 함정

이번 작업은 시간 압박(멘토링 20분 전) 속에서 강행했음에도 큰 함정 없이 통과. 이유:
- 0034~0036 작업의 패턴이 누적됨 (= 인증/권한/폼/redirect)
- velog 패턴이라는 명확한 참조 모델
- Jason Watmore 패턴 검색으로 폼 재사용 방법 확정

다만 카드 hover 효과가 너무 즉시 적용돼서 어색한 점 발견 → 별도 커밋으로 fix.

### 배운점

- **권한 검증의 2단계 패턴**:
  1. 인증 (getUser → 없으면 redirect)
  2. 소유권 (story.userId === user.id)
  → ★★★★★ 작업은 이 두 단계 모두 거쳐야 함. UI에서 숨겨도 백엔드에서 막아야 진짜 보호.

- **Server Action bind 패턴**: `action.bind(null, fixedArg)`로 부분 적용 함수 만들어서 useActionState에 넘김. 동적 라우트의 id 같은 값을 form action에 주입할 때 유용.

- **velog 패턴의 분리**: 카드 클릭 = 누구나 상세 보기 / 수정·삭제 = 본인만. 이 분리가 사용자에게 자연스러움. 처음 생각했던 "본인 글만 카드 클릭" 방식은 다른 사람 글을 못 읽는 이상한 UX였음.

- **Jason Watmore의 add/edit 패턴**: 같은 폼 컴포넌트가 props.initialData 유무로 mode 분기. React 생태계 표준. 폼 두 개 따로 만들 필요 없음.

- **window.confirm의 위치**: MVP 단계에서는 충분. 디자인 라이브러리 모달은 다음 단계. 우선순위 명확히.

- **transition-all + duration**: hover 효과는 `transition-all duration-300 ease-in-out`이 부드러움. `transition-shadow`만 쓰면 duration 미지정으로 즉시 적용되어 어색.

- **시간 압박 속의 안전망**: 0034~0036 누적된 패턴 덕분에 ★★★★★ 작업도 큰 사고 없이 통과. 개별 작업을 단단히 박아두면 다음 작업이 가속됨.

### 멘토 피드백 (= 다음 작업 방향)

멘토에게 받은 피드백:
1. **WYSIWYG Editor (= Quill)**: 본문 textarea → 위지윅 에디터
2. **File Uploader (= S3 아키텍처)**: 사진 업로드 / 위지윅 안 이미지
3. **지도 + 마커**: 마커 클릭 → 여행지 설명

다음 작업 계획:
- 0038: Work/Spot 테이블 + 시드 (= 데이터 모델)
- 0039: 카카오맵 박음 (= SpotFinder MVP)
- 0040: Quill 위지윅 에디터 박음
- 0041: Supabase Storage 박음 (= 파일 업로더 / S3 대신)
