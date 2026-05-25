# 0035 — 로그인/회원가입 버튼 loading indicator

## 한 줄 요약

React 19의 `useActionState` 3번째 반환값 `isPending`으로 로그인/회원가입 버튼에 로딩 상태 추가.

## 왜 · 목적 · 이유

로그인/회원가입 폼 제출 후 서버 응답 대기 중 사용자 피드백이 없었다. 버튼이 활성 상태로 그대로 있어 사용자가 중복 클릭하거나, 제출이 됐는지 확신하지 못하는 상황이 발생할 수 있었다.

UX 개선 목적의 작은 작업이지만, 다음 작업(0036 스토리 작성)의 폼 패턴 기준을 만드는 의미도 있었다. 한 번 정한 패턴을 모든 폼에 일관되게 적용해야 했다.

## 작성한 프롬프트

```
[배경]
0034 완료. 로그인/회원가입 폼의 버튼이 클릭 후 응답 대기 시 피드백 없음.
사용자가 두 번 클릭하거나 알아채지 못할 수 있음.

[목표]
로그인 / 회원가입 버튼에 loading indicator 추가:
- 클릭하면 버튼 비활성화 (disabled)
- 버튼 텍스트 변경 ("로그인 중..." / "가입 중...")
- 응답 완료 후 원래 상태로 복원

[변경 범위]
1. app/(auth)/login/LoginForm.tsx
2. app/(auth)/signup/SignupForm.tsx

[기술]
- useTransition 또는 useActionState 사용
- 추가 라이브러리 추가하지 마

[하지 말 것]
❌ 다른 페이지 손대지 마
❌ 디자인 시스템 바꾸지 마
❌ spinner 라이브러리 추가하지 마

[커밋]
feat: 0035 로그인/회원가입 버튼 loading indicator 추가
```

## 코드 작성 & 수정

### 핵심 발견: React 19의 useActionState

Claude Code가 React 버전(19.2.4) 확인 후, useTransition 대신 useActionState의 3번째 반환값 `isPending`을 사용하기로 결정.

```typescript
// 변경 전
const [state, formAction] = useActionState(action, null);

// 변경 후
const [state, formAction, isPending] = useActionState(action, null);
```

이유:
- `formAction`에 이미 연결돼 있어 추가 핸들러 불필요
- `<form action={formAction}>` 구조 그대로 유지
- React 19 + Server Action 표준 패턴
- useTransition 별도 작성보다 코드 간결

### 버튼 갈음

```typescript
<button
  type="submit"
  disabled={isPending}
  className="... disabled:opacity-60 disabled:cursor-not-allowed"
>
  {isPending ? '로그인 중...' : '로그인'}
</button>
```

Tailwind의 `disabled:` 변형 활용 (CSS 직접 작성 불필요).

### 두 파일 동일 패턴

`LoginForm.tsx`: "로그인 중..." / "로그인"  
`SignupForm.tsx`: "가입 중..." / "회원가입"

코드 구조는 동일, 텍스트만 다름.

## 결과 · 배운점

### 결과

단일 커밋:
- `feat: 0035 로그인/회원가입 버튼 loading indicator 추가`

검증:
- 로그인 폼 제출 → 버튼 "로그인 중..." + 회색 + 비활성 ✅
- 회원가입 폼 제출 → 버튼 "가입 중..." + 회색 + 비활성 ✅
- 응답 완료 후 원래 상태로 복원 ✅

### 시간

예상 30분 → 실제 약 15분. 작업 자체가 단순했고 패턴이 명확했음.

### 배운점

- **useActionState의 isPending**: React 19에서 추가된 3번째 반환값. useTransition을 별도로 쓸 필요 없이 같은 훅에서 로딩 상태 받을 수 있음. Server Action과 짝지을 때 가장 깔끔한 패턴.
- **Tailwind disabled: 변형**: `disabled:opacity-60 disabled:cursor-not-allowed`로 별도 클래스 토글 없이 비활성 스타일 처리. button의 `disabled` 속성만 토글하면 됨.
- **패턴 재사용 기준 만들기**: 작은 작업이지만 0036 StoryWriteForm, 0037 수정 폼도 같은 패턴 적용. 한 번 정해두면 일관성 확보.
- **버전 확인 먼저**: Claude Code가 `node -e "require('react/package.json').version"`으로 React 버전 먼저 확인하고 plan 작성. React 18이었으면 useTransition 패턴 썼을 것.

### 다음 작업 연결

0036의 StoryWriteForm도 동일 패턴 그대로 복제:
- `useActionState`로 `isPending` 받기
- "스토리 등록 중..." / "스토리 등록"
- disabled 처리

0037의 수정 폼도 동일 패턴 적용 (mode='edit'일 때 "수정 중..." / "수정").
