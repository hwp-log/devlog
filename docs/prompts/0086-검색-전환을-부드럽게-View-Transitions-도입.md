# 0086 회고: 검색 전환을 부드럽게 — View Transitions 도입과 한글 IME 처리

작성일: 2026-06-10
소요: 약 4시간
관련 커밋: 8f4facd (feat: 0086 페이지 이동 및 검색 화면전환에 View Transitions 적용, 검색 깜박임 및 한글 IME 처리)

## 1. 한 줄 요약
검색 결과 갱신 시의 깜박임과 한글 입력 조합 문제를 잡으려 View Transitions와 IME(조합) 처리를 도입하고, 그 김에 페이지 전환에도 View Transitions를 확장 적용했다.

## 2. 왜 / 목적 / 이유

**왜 (동기/문제)**
두 가지 문제가 있었다. ① 검색어를 입력해 결과가 바뀔 때 목록이 툭 갈리며 깜박여 거슬렸다. ② 한글로 검색할 때, 자모가 조합되는 중간 글자(예: "ㅈ", "저")로 검색이 실행돼 결과가 튀었다. 한글은 조합 과정에서도 입력 이벤트(onChange)가 매번 발생하기 때문이다.

**목적 (도달할 상태 / 사용자 가치)**
검색 결과 갱신을 부드럽게 보여 깜박임을 없앤다. 한글 검색이 글자 조합을 마친 뒤에만 실행돼 정확한 검색어로 동작하게 한다.

**이유 (채택 근거 / 의사결정)**
결과 갱신 깜박임은 "같은 자리에서 내용만 바뀌는" 상황이라 View Transitions의 crossfade가 적합했다. 한글 조합 문제는 `compositionStart`/`compositionEnd` 이벤트로 조합 중에는 검색을 보류하고 조합 완료 후에만 실행해 해결했다. 다만 이때 페이지 이동 전환에도 같은 `page-fade`를 확장 적용했는데, 이 판단이 나중에 스크롤 점프의 원인이 됐다(0088에서 철회).

## 3. 작성한 프롬프트
(0086 당시 CC 프롬프트가 있으면 기입. 없이 직접 수정했으면 "프롬프트 없이 직접 수정"으로 기입.)

## 4. 코드 작성 & 수정

### 한글 IME 처리 + debounce (핵심)

```tsx
// app/story/_components/TagSearchBar.tsx
const isComposing = useRef(false);
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// debounce: 입력이 멈춘 뒤 300ms 후에만 검색 (타이핑마다 요청하지 않음)
const scheduleSearch = useCallback((val: string) => {
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => {
    const normalized = val.trim().replace(/\s/g, '');
    const url = normalized ? `/story?q=${encodeURIComponent(normalized)}` : '/story';
    router.replace(url);
  }, 300);
}, [router]);

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
  if (!isComposing.current) scheduleSearch(e.target.value); // 조합 중엔 보류
};

// 한글 자모 조합 시작/종료 감지
const handleCompositionStart = () => { isComposing.current = true; };
const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
  isComposing.current = false;
  scheduleSearch(e.currentTarget.value); // 조합 완료 후 검색
};
```

`onCompositionStart`/`onCompositionEnd`(새 개념): 한글·일본어처럼 글자를 조합해 입력하는 IME에서, 조합이 시작·종료되는 시점을 알려주는 이벤트. 이걸로 "조합 중"인지 판별해 불완전한 글자로 검색되는 것을 막는다.

### View Transitions 적용

```tsx
// next.config.ts — Next.js의 View Transitions 통합 활성화
experimental: { viewTransition: true }

// app/story/page.tsx — 검색 결과 갱신 전환
// listKey가 바뀌면(검색 결과가 달라지면) ViewTransition이 트리거됨
const listKey = stories.map(s => s.id).join('-') || '__empty__';
<ViewTransition key={listKey} default="page-fade"> ...목록... </ViewTransition>

// app/story/layout.tsx — 페이지 이동 전환 (← 0088에서 철회)
<ViewTransition default="page-fade">{children}</ViewTransition>
```

```css
/* app/globals.css */
::view-transition-old(.page-fade),
::view-transition-new(.page-fade) {
  animation-duration: 0.8s;
}
```

## 5. 결과 / 배운점
- 결과: 검색 결과 갱신이 crossfade로 부드러워져 깜박임이 사라졌고, 한글 검색이 조합 완료 후에만 실행돼 정확해졌다.
- 배운점 1 (한글 IME): `onChange`는 한글 조합 중에도 매번 발생한다. 조합 입력을 다루는 검색·입력에서는 `compositionStart`/`compositionEnd`로 조합 완료 시점을 잡아야 불완전한 글자로 동작하는 것을 막을 수 있다.
- 배운점 2 (씨앗): 검색 깜박임은 "같은 자리, 다른 내용"이라 crossfade가 맞는 적용이었다. 그러나 페이지 이동은 "다른 자리"인데도 같은 `page-fade`를 확장 적용했고, 이 차이를 당시에 가르지 못했다. 이것이 0088의 스크롤 점프로 이어진다 — 같은 도구가 어떤 자리에는 맞고 어떤 자리에는 어긋난다는 것을 0088에서 확인하게 된다.
