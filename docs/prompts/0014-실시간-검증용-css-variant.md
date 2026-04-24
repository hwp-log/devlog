## 작업 개요

실시간 폼 검증에 사용할 Tailwind @custom-variant 선언 4개를 
app/globals.css에 추가한다.

이후 단계 3(로그인 페이지), 단계 4(회원가입 페이지)에서 
HTML+CSS 기반 실시간 검증 UI에 활용.

## 작업 대상

수정: `app/globals.css`

## 판단 근거

### 왜 @custom-variant를 쓰는가

Tailwind의 "variant"는 조건부 스타일 문법. `hover:bg-blue-500`에서 
`hover:`가 variant 예시. "마우스 올렸을 때만 이 스타일" 의미.

Tailwind v4는 `:user-invalid`(실시간 검증 실패 상태) variant를 기본 제공 안 함.
`@custom-variant`로 직접 등록하면 `className="user-invalid:border-red-500"` 
처럼 기본 variant처럼 쓸 수 있음.

대안인 `[&:user-invalid]:border-red-500` 문법도 작동하지만, 매번 길게 쓰면
가독성 나쁨. 여러 페이지에서 반복 사용할 variant라 한 번 등록이 이득.

### 왜 HTML+CSS 실시간 검증인가

일반적 React 방식: useState로 입력값 추적 → 매번 검증 → 색 변경.
이 방식은 Client Component 필수 (useState 때문).

우리 방식: HTML의 required, type="email" 등이 브라우저 내장 검증 발동시킴.
CSS :user-invalid가 그 결과를 시각적으로 반영. JavaScript 0줄.

결과: 로그인 페이지를 Server Component로 유지하면서 실시간 UX 확보.
번들 크기 증가 없음.

### 왜 지금 단계에서 선언하는가

CSS 도구 먼저 준비 → 이후 단계에서 페이지 만들 때 바로 사용.
단계 3(로그인), 단계 4(회원가입)에서 재사용 예정.

선행 커밋 0013(레이아웃)과는 독립된 논리라 별도 커밋.
한 커밋에 여러 목적 섞이면 커밋 이력 불명확.

## 구현 요구사항

### 추가할 선언

```css
@custom-variant user-invalid (&:user-invalid);
@custom-variant user-valid (&:user-valid);
@custom-variant has-invalid (&:has(input:user-invalid));
@custom-variant has-valid (&:has(input:user-valid));
```

### 각 variant 역할

- `user-invalid`: input 자체가 실시간 검증 실패 상태일 때
- `user-valid`: input 자체가 실시간 검증 성공 상태일 때
- `has-invalid`: 부모 요소가 내부에 검증 실패 input을 가진 상태일 때 (에러 메시지 표시용)
- `has-valid`: 부모 요소가 내부에 검증 성공 input을 가진 상태일 때

### 추가 위치

기존 `@import "tailwindcss";` 아래, 다른 @theme 또는 @layer 선언이 있다면 그 위에 추가.
선언 그룹 위에 간단한 한 줄 주석으로 의도 표시:

```css
/* 실시간 폼 검증용 variant (user-valid/invalid, :has() 활용) */
```

## 스코프 경계 (하지 말 것)

- 기존 globals.css 내용 수정/삭제 금지 (추가만)
- @theme 색상 토큰 등 다른 변경 금지
- 실제 스타일 규칙 작성 금지 (선언만)
- 타 파일 수정 금지

## 커밋 계획

**커밋 메시지:**
feat: 실시간 폼 검증용 CSS variant 선언 추가

**커밋 시 주의:**
- Co-Authored-By 트레일러 포함하지 말 것
- 프롬프트 파일도 같이 스테이징

**스테이징 대상:**
```bash
git add app/globals.css "docs/prompts/0014-실시간-검증용-css-variant.md"
```

## Plan 출력 요구사항

Claude Code는 Plan Mode로 다음을 제시:

1. **현재 globals.css 내용** (기존 선언 확인)
2. **추가 위치** (정확히 어디에 삽입할지)
3. **최종 globals.css 예상 모습** (추가 후 전체 구조)

Plan 승인 후 실행. 실행 중 판단 애매한 지점 발생 시 즉시 중단하고 질문.

## 추가 확인 사항

- Tailwind CSS v4 문법 (v3 addVariant 플러그인 방식 아님)
- CLAUDE.md의 "DO NOT" 규칙 준수

## 실행 결과 (작업 후 기록)

- 실제 작업 시간: 약 10분
- 예상과 다른 지점: 없음
- 학습한 것: Claude Code Plan Mode의 diff 미리보기가 검토를 수월하게 만듬응 