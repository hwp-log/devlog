# 0161 회고: SpotPopup 상태 재배치 (RHF+Zod)

**작성일**: 2026-07-10
**소요**: 약 1시간 (CC 16분 + 수동 검증·검토)
**관련 커밋**: 1a33f44 (chore) / ac2dfb3 (test) / 116999b (refactor)

**기준 문서**: `docs/analysis/A004-SpotPopup-상태분류.md` ('전' 기준선)

---

## 1. 한 줄 요약

SpotPopup의 useState 16개를 A004 분류대로 재배치 — 폼 입력 8개는 RHF+Zod로, 서버 사본 4개는 `spot` props 직독으로, preview 1개는 watch 파생값으로, UI 3개만 useState 잔류.

---

## 2. 왜 / 목적 / 이유

### 상태의 질서 회복 (A003 §4 반례 해소)
- **왜**: useState 16개가 4개 클러스터에 얽혀 `enterEdit`/`cancelEdit`가 각각 8개 setState를 동시 호출 — 개별 상태가 아니라 "편집 세션" 단위로 움직이는데 코드는 낱개로 관리.
- **목적**: 각 상태를 성격에 맞는 계층에 배치. 폼 값은 폼 라이브러리에, 서버 데이터는 props에, 계산 가능한 값은 파생으로.
- **이유**: My Plan `EditorState`의 단일 소스 원칙과 동일 원리 — 같은 데이터의 사본이 여러 곳에 있으면 동기화 코드(setState 폭발)가 필연. 사본을 없애면 동기화 코드 자체가 소멸.

### 검증의 단일 소스 (Zod 스키마)
- **왜**: 파일 검증(크기·타입)은 L116-117, 이름 필수는 L134와 L350 두 곳 — 검증 로직 3곳 분산.
- **목적**: `spotFormSchema` 한 곳에 전부 흡수. 선택 즉시 검증도 `schema.shape.photoFile.safeParse`로 같은 스키마 재사용.

### 특성화 테스트 선행 (3차 규칙 준수)
- **왜**: SpotPopup은 테스트 0개 — "테스트 없이 구현 코드 변경 금지" 위반 상태로 리팩토링 진입 불가.
- **이유**: 리팩토링은 "동작 보존" 증명이 핵심. 내부 상태가 아닌 렌더 결과 기준 테스트 15개를 먼저 Green으로 고정 → 전/후 동일 통과가 곧 증명.

---

## 3. 작성한 프롬프트

```
[배경]
components/SpotPopup.tsx 상태 재배치 리팩토링.
docs/analysis/A004-SpotPopup-상태분류.md가 '전' 기준선 —
useState 16개를 분류 결과대로 처리한다.

[목표]
1. 폼 입력 8개 → RHF+Zod 이사 (스키마 = 검증의 단일 소스)
2. 서버 사본 5개 → useState 철거, revalidate(서버 데이터 재조회)로 대체
3. preview 1개 → useState 철거, watch 기반 파생값으로 계산화
4. UI 상태 2~3개 → useState 잔류
5. 완료 후 전/후 비교 보고

[하지 말 것]
❌ SpotPopup 외 파일의 로직 변경 / UI·스타일 변경 /
   서버 액션 시그니처 변경 / UI 상태를 RHF form state에 편입

[참조 패턴] A004 분류표의 4분류. My Plan EditorState 단일 소스 원칙.
[검수 모드] plan 요청.
```

플랜 단계 조정 2건 (사용자 컨펌):
- `movieSuggestions`: QueryClientProvider 부재 + "SpotPopup 외 파일 수정 금지" 제약 → useQuery 불가, useState 잔류 (서버 사본 철거는 5→4개)
- "revalidate" 해석: 이 아키텍처의 데이터 소스는 부모(SpotMap) `activeSpot` — `handleSpotUpdate`가 `onUpdate` 시 props를 즉시 갱신하므로 **props 직독**이 실행 가능한 유일한 단일 소스화. 서버 영속은 기존 `clearSpotPhoto`의 `revalidatePath` + `updateStoryAction`이 담당 (무변경).

---

## 4. 코드 작성 & 수정

### 1. Zod 스키마 — 검증의 단일 소스 (신규)

```typescript
const spotFormSchema = z.object({
  name: z.string().trim().min(1),          // 기존 !nameInput.trim() 가드 흡수
  review: z.string(),
  movieQuery: z.string(),
  movieId: z.string().nullable(),
  movieTitle: z.string(),
  photoFile: z.instanceof(File).nullable()
    .refine((f) => !f || f.size <= MAX_SIZE, '5MB 이하만 가능합니다')
    .refine((f) => !f || ALLOWED_TYPES.includes(f.type), 'jpeg, png, webp만 허용됩니다'),
  photoCleared: z.boolean(),
});
```

`z.coerce` 미사용(수치 필드 없음) → `useForm<SpotFormValues>` 단일 제네릭으로 충분.
선택 즉시 검증은 같은 스키마 조각 재사용:

```typescript
const parsed = spotFormSchema.shape.photoFile.safeParse(file);
if (!parsed.success) {
  setError('photoFile', { message: parsed.error.issues[0].message });
  return; // 값 미설정 = 기존 프리뷰 유지 (기존 동작 보존)
}
```

### 2. 서버 사본 철거 — props 직독 (삭제)

`displayName`·`displayReview`·`photoUrl`·`originalPhotoUrl` useState 4개 삭제.
보기 모드는 `spot.name` / `spot.review` / `spot.photoUrl` 직독. 편집 세션 경계는 `reset` 1회:

```typescript
function resetToSpot() {
  reset({ name: spot.name, review: spot.review ?? '', movieQuery: '',
    movieId: spot.movieId ?? null, movieTitle: spot.movieTitle ?? '',
    photoFile: null, photoCleared: false });
}
// enterEdit: 기존 setState 8회 → resetToSpot() + UI setState 3회
// cancelEdit: 기존 setState 8회 → resetToSpot() + setIsEditing(false)
```

### 3. preview 계산화 + revoke 소유권 이전 (핵심 함정)

```typescript
const previewUrl = useMemo(
  () => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile]);
useEffect(() => () => {
  if (previewUrl && previewUrl !== handedOffUrlRef.current)
    URL.revokeObjectURL(previewUrl);
}, [previewUrl]);
```

저장 시 `previewUrl`을 `onUpdate({photoUrl: previewUrl})`로 부모에 넘기면 부모가 그 blob URL을 계속 렌더 → cleanup에서 무조건 revoke하면 부모 이미지가 깨짐. `handedOffUrlRef.current = previewUrl` 기록으로 revoke 제외 (기존 코드도 저장된 preview는 revoke하지 않던 동작 보존).

### 4. 특성화 테스트 (신규, `components/__tests__/SpotPopup.test.tsx`)

15케이스: 보기 렌더 / 편집 진입 프리필 / 저장 payload·보기 복귀 / 빈 이름 disabled / 취소 복원 / 신규 취소(onDelete+onClose) / 사진 검증 2종 / 사진 저장 / 비우기(임시·영속·실패) / 작품 검색·선택·해제·신규 등록. 리팩토링 전 Green → 후에도 동일 Green.

---

## 5. 결과 / 배운점

### 전/후 비교 (실측)

| 지표 | 전 | 후 |
|---|---|---|
| useState 개수 | **16** | **3** (isEditing · movieSuggestions · showDropdown) |
| useState setter 호출 지점 | **62** | **15** (47개 삭제, -76%) |
| 폼 값 변경 방식 | setState 낱개 | `setValue` 13 · `reset` 1 · `setError` 3 |
| 검증 로직 위치 | 3곳 분산 (파일 L116-117, 이름 L134·L350) | `spotFormSchema` 1곳 |
| enterEdit / cancelEdit | 각 setState 8회 | reset 1회 + UI 1~3회 |
| 테스트 | 0개 | 15개 (전 Green → 후 Green, 회귀 0) |

### 부수 개선 (props 직독의 파급)
- **originalPhotoUrl 잠재 버그 소멸**: 기존엔 마운트 시점 스냅샷이라 remount 없이 2회차 편집 취소 시 1회차 저장분이 유실될 수 있었음. props 직독으로 복원 로직 자체가 불필요.
- **작품 선택 취소 미복원 버그 해소**: 기존 cancelEdit는 selectedMovieId/Title을 되돌리지 않아 취소해도 새 선택이 남았음. `resetToSpot()`이 일괄 복원.

### 배운점
- **사본 제거 = 동기화 코드 소멸**: setState 47개 삭제는 최적화가 아니라 "같은 데이터의 사본이 4계층(서버·부모·미러·입력)에 있던 구조"를 2계층(props·폼)으로 줄인 결과.
- **파생값의 수명주기 함정**: 계산화는 공짜가 아님 — `createObjectURL`처럼 자원을 동반하는 파생은 cleanup + 소유권 이전(handedOffUrlRef)까지 설계해야 동작 보존.
- **특성화 테스트의 힘**: "내부 상태가 아닌 렌더 결과 기준"으로 쓴 테스트는 상태 구조를 통째로 갈아엎어도 무수정 통과 — 리팩토링 증명 도구로 정확히 기능.

### 미해결 / 보고
- 기존 auth 테스트 7개 실패(TextEncoder 미정의, 로그인/회원가입 버튼 부재)는 이번 작업 전부터 존재 — 규칙에 따라 수정하지 않고 보고만.
- `npx tsc --noEmit`의 `.next/types/validator.ts` 오류는 삭제된 `my-dots` 라우트를 참조하는 오래된 생성물 — 소스 무관.
- 아이콘 전용 버튼(X 닫기) a11y 경고는 기존 코드부터 동일 — UI 변경 금지 제약으로 미수정.

---

## 결정 (Decisions)

- **movieSuggestions는 useState 잔류**: 서버 상태 성격이지만 QueryClientProvider가 앱에 없어 useQuery 도입은 SpotPopup 외 파일 수정 필요 → 제약 우선. TanStack Query 배선 시 이관 후보 1순위.
- **"서버 데이터 재조회"의 실현 = props 직독**: SpotMap이 `onUpdate`로 activeSpot을 즉시 갱신하는 구조에서는 revalidatePath만으로 클라이언트 상태가 안 바뀜 — 부모 상태가 단일 소스이고 팝업은 이를 props로 읽는 것이 이 아키텍처의 올바른 재조회.
- **UI 상태는 RHF 밖**: isEditing·showDropdown은 폼 값이 아니므로 form state 편입 금지 (요청 제약 그대로).
- **선택 즉시 파일 검증은 `schema.shape.photoFile.safeParse` 재사용**: 제출 시 검증과 즉시 검증이 한 스키마를 공유 — 검증 로직 중복 0.
