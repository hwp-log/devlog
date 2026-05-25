# 0038: Tiptap WYSIWYG 도입

## 한 줄 요약

Story 작성 폼의 `<textarea>`를 Tiptap 기반 WYSIWYG 에디터로 교체. StarterKit의 Link extension 중복 경고를 소스 직접 확인으로 해결.

## 왜·목적·이유

- 멘토 Hayden의 피드백 3개 중 1번: "WYSIWYG Editor (Quill?)"
- 기존 Story 작성 폼이 `<textarea>` 한 덩어리로 일기장 수준이었음. 여행 포트폴리오답게 만들려면 사진/제목/굵게/리스트가 섞이는 풍부한 글이 필요
- 멘토가 짚은 Quill은 2026 기준 레거시 분류. web_search 결과 "Tiptap is the default choice for most React projects in 2026... Quill is legacy — functional but no longer getting meaningful updates" 확인
- 멘토의 "Quill?" 물음표는 라이브러리 추천이 아니라 "WYSIWYG 카테고리 자체를 도입해라"의 신호로 해석. 라이브러리는 본인이 검토해서 정함

## 작성한 프롬프트

```
# 0038: Tiptap 도입 (textarea → WYSIWYG)

## 배경
현재 Story 작성/수정 폼의 <textarea>를 일기장 수준 → WYSIWYG으로.

## 목표
StoryWriteForm.tsx의 <textarea> 영역을 Tiptap 에디터로 교체.
content는 HTML 문자열로 저장(스키마 변경 없음).
작성 모드(/story/new)와 수정 모드(/story/[id]/edit) 모두 동작.

## 작업 범위
1. 패키지 설치
   - @tiptap/react, @tiptap/starter-kit, @tiptap/pm
   - @tiptap/extension-image, extension-link, extension-placeholder
2. TiptapEditor.tsx Client Component 작성
   - "use client" 지시문 필수
   - props: content, onChange, placeholder?
3. 툴바 6개 (H1, H2, Bold, Italic, BulletList, Link)
   - Image 버튼은 자리만 만들어두고 onClick은 alert("0040에서 구현")
4. StoryWriteForm.tsx에 통합
   - hidden input으로 HTML 전달

## 하지 말 것
- 이미지 업로드 실제 구현 (0040 작업)
- sanitize / DOMPurify (0041 작업)
- Story.content 컬럼 타입 변경 (계속 String)
- JSON 저장 형식 (HTML로 통일)
- Server Component에서 Tiptap import (빌드 깨짐)

## 추가 누락 보강 (검수 후)
1. useEditor에 immediatelyRender: false 박기 (hydration mismatch 방지)
2. if (!editor) return null 가드
3. EditorContent 컴포넌트 렌더링 명시
4. Link 버튼 null/빈값 처리 (window.prompt 취소/해제/설정 3분기)
```

## 코드 작성 & 수정

### 1. 패키지 설치

```
@tiptap/react @tiptap/starter-kit @tiptap/pm
@tiptap/extension-image @tiptap/extension-link @tiptap/extension-placeholder
```

### 2. TiptapEditor.tsx (Client Component)

```tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function TiptapEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),  // ← 중복 해결
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? '내용을 입력하세요...' }),
    ],
    content,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  if (!editor) return null;

  function handleLink() {
    if (!editor) return;
    const url = window.prompt('URL을 입력하세요:');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  }

  // 툴바 + EditorContent JSX
  return (
    <div className="border-[0.5px] border-black/15 rounded-[10px]">
      <div className="border-b border-black/10 p-2 flex gap-1">
        {/* H1, H2, Bold, Italic, BulletList, Link, Image 7개 버튼 */}
      </div>
      <EditorContent editor={editor} className="tiptap-content min-h-[260px] px-[14px] py-3 text-sm" />
    </div>
  );
}
```

### 3. StoryWriteForm.tsx 통합

```tsx
const [content, setContent] = useState(initialData?.content ?? '');

<TiptapEditor content={content} onChange={setContent} placeholder="..." />
<input type="hidden" name="content" value={content} />
```

기존 Server Action 코드는 0% 변경. FormData에서 `content` 그대로 받음.

### 4. globals.css

`.tiptap-content` 하위 h1/h2/ul/a/placeholder 스타일 추가.

### 5. 콘솔 경고 해결 (예상 못한 디버깅)

빌드 후 콘솔에서:

```
[tiptap warn]: Duplicate extension names found: ['link']. This can lead to issues.
```

원인 추적:
1. StarterKit에 Link extension이 자동 포함된다는 가정 → 소스 직접 확인 필요
2. `@tiptap/starter-kit` 패키지 소스 검토 → Link는 포함, Image는 미포함 확인
3. `StarterKit.configure({ link: false })`로 비활성화 → 우리가 import한 Link가 살아남

추측으로 `image: false`까지 박았다면 빌드 깨졌을 것 (StarterKit에 image는 없으니까).

### 커밋 4개

| 커밋 | 내용 |
|---|---|
| `276e07e` | chore: tiptap 패키지 설치 |
| `81552cd` | feat: 0038 Tiptap WYSIWYG 에디터 도입 |
| `58b68b1` | style: 0038 Tiptap 본문 텍스트 색 명시 |
| `6659c2b` | fix: 0038 Tiptap link extension 중복 경고 해결 |

## 결과·배운점

### 결과

- `/story/new`, `/story/[id]/edit` 모두 WYSIWYG으로 동작
- H1/H2/Bold/Italic/BulletList/Link 6개 툴바 작동
- 저장된 HTML이 DB에 그대로 들어감 (Story.content는 String 유지)
- 콘솔 경고 0개로 마감

### 배운점

**1. `immediatelyRender: false`는 Tiptap v3 + Next.js App Router의 필수 옵션**

Server Component → Client Component 경계에서 Tiptap이 첫 렌더 시 DOM에 접근하려 함. immediatelyRender를 false로 박아야 클라이언트 마운트 후에 렌더되어 hydration mismatch가 안 남.

**2. 라이브러리 문서 신뢰 vs 소스 직접 확인**

StarterKit에 어떤 extension이 포함되는지는 문서에 명시 안 돼 있었음. 콘솔 경고 보고 추측("Link만 중복")으로 박았다가, 만약 추측이 틀려서 image: false까지 박았다면 존재하지 않는 옵션이라 빌드 깨졌을 것. → **라이브러리 동작에 대해 가정이 들어갈 때는 패키지 소스를 직접 확인**.

**3. hidden input + React state 패턴**

Tiptap의 HTML 출력을 Server Action에 넘기는 가장 단순한 방법. `<textarea name="content">`을 `<input type="hidden" name="content" value={content}>`로 교체. Server Action 코드 0% 변경. 라이브러리가 바뀌어도 Server Action 인터페이스는 안 깨짐.

**4. 멘토의 "Quill?"이 시그널**

물음표가 "Quill 추천한다"가 아니라 "WYSIWYG 카테고리 도입해라"의 의미. 시니어가 던지는 라이브러리 이름은 그 카테고리의 대명사로 던지는 경우가 많음. 직접 검토해서 더 나은 선택지(Tiptap) 고른 게 정답.

**5. modifier 의도 분리**

이미지 업로드(0040), sanitize(0041), 안전 렌더링(0042)는 의식적으로 분리. 한 번에 다 박으면 디버깅 범위가 커지고 빌드 깨질 위험. "하지 말 것"에 명시한 게 후속 작업 분리를 강제하는 장치.
