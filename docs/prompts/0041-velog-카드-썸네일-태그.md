# 0041: velog 스타일 카드 + 썸네일 추출 + 태그 입력

## 한 줄 요약

`lib/story/extract-thumbnail.ts` 신설로 본문 HTML에서 첫 이미지·텍스트 미리보기 추출 + `/story` 목록을 velog 스타일 카드(16:9 썸네일 + 제목 + 미리보기 + 태그 + 메타)로 전환 + 태그 입력 UI(Enter 추가, × 삭제, 5개 제한) 완성.

## 왜·목적·이유

0040까지 끝나서 Story 작성·이미지 업로드·저장·상세 조회는 다 동작. 그런데 `/story` 목록 페이지가 단순한 텍스트 리스트라 "여행 포트폴리오답지 않음". velog/Medium 수준의 카드 그리드로 갈음할 차례.

핵심 결정:

1. **썸네일 = 본문 첫 이미지 자동 추출**: 사용자가 별도로 대표 이미지 지정할 필요 없음 — UX 단순화. velog/Notion도 같은 방식.
2. **미리보기 = 본문에서 HTML 태그 제거 후 120자**: 카드에서 글 분위기 파악용. 너무 길면 디자인이 무너짐.
3. **`http(s)`와 `/` 시작 경로만 허용**: XSS 방지 + 시드 데이터의 로컬 이미지(`/seed/*.png`) 지원 동시 충족.
4. **태그는 칩(chip) UI + Enter 추가**: Notion/velog 패턴. 5개 제한으로 무한 추가 방지.
5. **Server Action에서 `connectOrCreate` + `set:[]` 후 재연결**: Prisma 다대다 관계의 표준 갱신 패턴.

## 작성한 프롬프트

```
# 0041: /story 목록 velog 스타일 카드 + 썸네일 자동 추출 + 태그 입력

## 배경
0040까지 끝나서 Story CRUD + 이미지 업로드 동작. 그런데 목록이 텍스트 리스트라 포트폴리오답지 않음.
velog 스타일 카드 그리드로 갈음.

## 목표
1. 본문 HTML에서 첫 이미지·텍스트 미리보기 자동 추출 함수 (lib/story/extract-thumbnail.ts)
2. /story 목록을 카드 그리드로 (16:9 썸네일 + 제목 + 미리보기 + 태그 + 메타)
3. 태그 입력 UI (Enter로 추가, × 삭제, 5개 제한)
4. Server Action: 태그 다대다 관계 갱신 (connectOrCreate + set:[])

## 작업 범위

### 1. lib/story/extract-thumbnail.ts (신설)
- extractFirstImage(html: string): string | null
  - 정규식으로 첫 <img src="..."> 추출
  - http(s) 시작 또는 / 시작만 허용 (XSS 방지)
- extractTextPreview(html: string, maxLength = 120): string
  - HTML 태그 제거 (replace(/<[^>]+>/g, ''))
  - 공백 정리, maxLength 자르기

### 2. /story 목록 카드 그리드
- grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- 카드: 16:9 썸네일 + 제목 + 미리보기 + 태그 chip + 작성일/작성자

### 3. 태그 입력 UI (StoryWriteForm.tsx)
- input + Enter로 추가
- 추가된 태그는 chip으로 표시, × 클릭으로 삭제
- 5개 제한
- 폼 제출 시 JSON.stringify로 hidden input에 담아 전송

### 4. Server Action 태그 갱신
- create: connectOrCreate (이름 기준 중복 방지)
- update: set: [] 로 기존 연결 끊고 → connectOrCreate 재연결

## 하지 말 것
- 태그 자동 완성/추천 — 차후
- 이미지 lazy loading 라이브러리 도입 — Next.js Image 컴포넌트가 이미 처리
- 무한 스크롤 — 일단 단순 목록
- 정렬 옵션 — 일단 최신순 고정

## 참조 패턴
- velog 카드 레이아웃
- Notion 태그 UI
- 0036 Server Action 패턴

## 검수 모드
- ★★★ extract-thumbnail.ts (XSS 방지 정규식, 빈 HTML 처리)
- ★★★ Server Action 태그 갱신 (set:[] 후 connectOrCreate)
- ★★ 카드 UI (반응형, 이미지 없을 때 폴백)
- ★ 태그 입력 UX

## 커밋
- feat: 0041 velog 카드 + 썸네일 + 태그 입력 UI 추가
```

## 코드 작성 & 수정

### lib/story/extract-thumbnail.ts (신설)

```typescript
const ALLOWED_SCHEMES = /^(https?:\/\/|\/)/

export function extractFirstImage(html: string): string | null {
  if (!html) return null
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/)
  if (!match) return null
  const src = match[1]
  return ALLOWED_SCHEMES.test(src) ? src : null
}

export function extractTextPreview(html: string, maxLength = 120): string {
  if (!html) return ''
  const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text
}
```

### app/story/page.tsx 카드 그리드로 갈음

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {stories.map((story) => {
    const thumbnail = extractFirstImage(story.content)
    const preview = extractTextPreview(story.content)
    return (
      <Link key={story.id} href={`/story/${story.id}`}>
        <article className="...">
          {thumbnail ? (
            <div className="aspect-video">
              <img src={thumbnail} alt="" />
            </div>
          ) : (
            <div className="aspect-video bg-gray-100" />  {/* 폴백 */}
          )}
          <h2>{story.title}</h2>
          <p>{preview}</p>
          <div className="flex gap-1">
            {story.tags.map(t => <span key={t.id} className="chip">#{t.name}</span>)}
          </div>
          <div className="meta">{story.author.name} · {formatDate(story.createdAt)}</div>
        </article>
      </Link>
    )
  })}
</div>
```

### 태그 입력 UI (StoryWriteForm.tsx)

```typescript
const [tags, setTags] = useState<string[]>(initialTags)
const [tagInput, setTagInput] = useState('')

const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    const trimmed = tagInput.trim()
    if (!trimmed || tags.includes(trimmed) || tags.length >= 5) return
    setTags([...tags, trimmed])
    setTagInput('')
  }
}

const removeTag = (target: string) => {
  setTags(tags.filter(t => t !== target))
}

// JSX
<div className="flex flex-wrap gap-2">
  {tags.map(tag => (
    <span key={tag} className="chip">
      #{tag}
      <button onClick={() => removeTag(tag)}>×</button>
    </span>
  ))}
  {tags.length < 5 && (
    <input
      value={tagInput}
      onChange={(e) => setTagInput(e.target.value)}
      onKeyDown={handleTagKeyDown}
      placeholder="태그 입력 후 Enter"
    />
  )}
</div>
<input type="hidden" name="tags" value={JSON.stringify(tags)} />
```

### Server Action 태그 갱신

```typescript
// create
await prisma.story.create({
  data: {
    title, content, authorId,
    tags: {
      connectOrCreate: tags.map(name => ({
        where: { name },
        create: { name },
      })),
    },
  },
})

// update
await prisma.story.update({
  where: { id },
  data: {
    title, content,
    tags: {
      set: [],  // 기존 연결 끊기
      connectOrCreate: tags.map(name => ({
        where: { name },
        create: { name },
      })),
    },
  },
})
```

### 커밋 2개

```
b7e3871 feat: 0041 velog 카드 + 썸네일 + 태그 chip
3d00a36 feat: 0041 태그 입력 UI + Server Action 갱신
```

## 결과·배운점

**잘 된 점**

- `/story` 목록이 velog 분위기로 한 번에 갈음. 사용자가 봤을 때 "어, 여행 포트폴리오답네" 첫인상 확보.
- 썸네일·미리보기를 별도 컬럼으로 저장하지 않고 본문에서 추출 → 데이터 모델 단순 유지(스토리지 정합성 문제 없음).
- 태그 다대다 관계가 Prisma `connectOrCreate` + `set: []` 패턴으로 깔끔하게 동작.

**알게 된 것 — `set: []` 후 `connectOrCreate` 패턴**

처음에는 update 시 그냥 `connectOrCreate`만 했는데 기존 태그가 안 사라짐. 다대다 관계는 "현재 연결 상태"를 유지하는 게 기본이라, 명시적으로 끊어줘야 함.

```typescript
tags: {
  set: [],  // 1단계: 기존 연결 모두 끊기
  connectOrCreate: [...],  // 2단계: 새로 연결 (없으면 생성)
}
```

이 두 단계를 한 트랜잭션에 함께 적으면 Prisma가 알아서 순서대로 실행. SQL로 풀면 `DELETE FROM _StoryToTag WHERE storyId = ?` 후 `INSERT INTO _StoryToTag ...`.

**XSS 방지 정규식의 의미**

`extractFirstImage`에서 `http(s)` 또는 `/`로 시작하는 src만 허용한 이유:

- 차단해야 할 패턴: `javascript:alert(1)`, `data:text/html,<script>...`
- 허용해야 할 패턴: `https://...supabase.../story-photos/...` (업로드 이미지), `/seed/danbam.png` (시드 데이터)

`<img>` 태그 자체는 Tiptap이 안전하게 처리하지만, **본문에서 추출한 URL을 별도로 카드에 보여줄 때** 추가 검증이 필요. 본문 안에서는 브라우저가 `javascript:` 스킴을 막아도, 우리가 추출한 URL을 다른 컨텍스트(예: 메타 태그, og:image)에서 쓰면 막히지 않을 수도 있음.

→ 추출 시점에서 화이트리스트 검증하는 게 안전.

**시드 데이터 호환성 발견**

처음에 `http(s)`만 허용했더니 0043에서 시드 데이터 작성할 때 로컬 경로(`/seed/danbam.png`)가 차단당함. 정규식을 `/^(https?:\/\/|\/)/`로 갈음해서 절대 경로도 허용. 

이게 함정 같지만 사실 합리적 — `/`로 시작하는 경로는 도메인 내부 리소스라 외부 공격 벡터가 없음. `//evil.com` 같은 프로토콜 상대 URL은 첫 두 글자가 `//`라 정규식이 통과시키지만, 브라우저가 `http(s):` 컨텍스트로 해석할 위험 있음 — 다음에 정규식을 좀 더 엄격하게(`/^(https?:\/\/[^\/]|\/[^\/])/`) 개선할 여지 있음.

**미리보기 길이 결정 — 120자**

- 너무 짧음(80자): 카드가 휑함
- 너무 김(200자): 모바일에서 카드가 너무 큼, 그리드 균형 무너짐
- 120자 = 한국어 약 60자 = 대략 2~3문장 → 분위기 파악 가능

velog는 160자 정도, Medium은 약 100자. 우리는 중간값 선택.

**태그 입력 UX 결정 — 5개 제한**

velog는 무제한, Notion은 무제한. 우리는 5개 제한:
- 6월 취업 포트폴리오 = 다양한 콘텐츠보다 잘 정돈된 인상이 중요
- 태그가 많으면 카드 디자인이 무너짐(2줄 이상 차지 가능)
- 사용자가 "이 글을 대표하는 5개"로 압축하는 게 좋은 글쓰기 훈련

이건 의도적 제약. velog/Notion이 무제한이라고 따라가지 않음.

**다음 작업 = 0042 4열 그리드 + 반응형 조정**

3열까지 갈음했는데, 큰 모니터(xl 이상)에서는 카드가 너무 커서 한 화면에 적게 들어감. 4열로 확장하고 layout.tsx의 max-w-5xl도 max-w-7xl로 갈음할 차례.
