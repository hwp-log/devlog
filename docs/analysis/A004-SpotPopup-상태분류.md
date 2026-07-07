# A004 분석: SpotPopup 상태 분류 (RHF+Zod 사전 분석)

> 대상: `components/SpotPopup.tsx` (390줄, 조사 시점 기준)
> 배경: A003 §4 "상태의 질서"에서 반례로 지목된 useState 16개의 응집 리팩토링(RHF+Zod) 사전 분석.
> 성격: **읽기 전용 보고. 코드 무수정, 구현 제안 없음** — 분류와 관계 사실만.
> 작성일: 2026-07-07

---

## 0. 인벤토리 개요

- `useState` **16개** (L30~L46). 이 문서의 분류 대상.
- 대상 외 (참고): `useTransition`의 `isPending`(L41) — 저장 중 표시·버튼 disabled에 사용. `useRef`의 `debounceRef`(L47) — 작품 검색 디바운스 타이머.
- 상태 변경 함수 9개: `enterEdit` `handleMovieInput` `handleSubmitNew` `selectMovie` `clearMovie` `cancelEdit` `handlePhotoSelect` `clearPendingPhoto` `handleSave`.
- 렌더 시 파생 계산이 이미 존재: `showPhotoPreview`(L184) = `pendingPhotoFile || (photoUrl && !pendingPhotoCleared)` — state가 아닌 파생값으로 처리된 유일한 예.

### 분류 기준
| 분류 | 정의 |
|---|---|
| 서버 미러 | 초기값이 `spot.*` props의 복사 |
| 폼 입력 | 사용자 타이핑·선택·의도 값 |
| UI 상태 | 열림/닫힘, 모드, 피드백 등 화면 제어 |
| 파생 가능 | 다른 상태·props에서 순수 계산 가능 |

이중 성격 상태는 **주분류 1개 + 부분류 병기** (합계는 주분류 기준 16).

---

## 1. useState 16개 전수 목록 + 4분류

| # | 상태 | 줄 | 초기값 | 주분류 | 부분류/비고 |
|---|---|---|---|---|---|
| 1 | `isEditing` | L30 | `initialEditing` (props) | **UI 상태** | 보기/편집 모드 스위치. 컴포넌트 전체 렌더 분기의 축 |
| 2 | `displayName` | L31 | `spot.name` | **서버 미러** | ⚠️ 이중 성격: 저장 성공 시 낙관적 갱신됨(L144, L153, L170) |
| 3 | `displayReview` | L32 | `spot.review ?? ''` | **서버 미러** | ⚠️ #2와 동일한 이중 성격 (L145, L154, L171) |
| 4 | `nameInput` | L33 | `initialNameInput ?? spot.name` | **폼 입력** | 이름 입력값. 편집 진입 시 display에서 재복사 |
| 5 | `reviewInput` | L34 | `spot.review ?? ''` | **폼 입력** | 리뷰 입력값. 편집 진입 시 display에서 재복사 |
| 6 | `photoUrl` | L35 | `spot.photoUrl` | **서버 미러** | 저장/취소 시 갱신·복원되는 현재 표시 사진 |
| 7 | `originalPhotoUrl` | L36 | `spot.photoUrl` | **서버 미러** | **setter 없는 스냅샷 상수** — cancelEdit 복원용(L108)으로만 사용 |
| 8 | `pendingPhotoFile` | L37 | `null` | **폼 입력** | 선택된 파일 객체. 저장 시 `onFileSelect`로 전달 |
| 9 | `pendingPhotoPreview` | L38 | `null` | **파생 가능** | `pendingPhotoFile`에서 `URL.createObjectURL`로 생성 — 순수 파생. 단 revoke 수명주기 동반 |
| 10 | `pendingPhotoCleared` | L39 | `false` | **폼 입력** | "사진 비우기" 의도 플래그. 현 상태들로부터 계산 불가하나, 사진 필드를 단일 값으로 모델링하면 #8·#9와 함께 접히는 준파생 성격 |
| 11 | `error` | L40 | `''` | **UI 상태** | 검증 실패(2종 문구) + 서버 액션 실패 메시지 공용 |
| 12 | `movieInput` | L42 | `''` | **폼 입력** | 작품 검색 타이핑 값 |
| 13 | `movieSuggestions` | L43 | `[]` | **UI 상태** | ⚠️ 경계 사례: 서버 검색 결과 캐시(`searchMoviesAction` 응답) — 순수 UI도 폼 값도 아닌 서버 상태 성격 |
| 14 | `selectedMovieId` | L44 | `spot.movieId ?? null` | **서버 미러** | ⚠️ 이중 성격: 편집 중 사용자가 변경하는 폼 값이기도 함 |
| 15 | `selectedMovieTitle` | L45 | `spot.movieTitle ?? ''` | **서버 미러** | 파생 가능 병기: id → suggestions/서버 조회로 계산 가능한 표시용 복제 |
| 16 | `showDropdown` | L46 | `false` | **UI 상태** | 파생 가능 병기: 렌더 조건이 이미 `showDropdown && movieInput.trim() !== ''`(L309)로 입력값과 AND — suggestions 유무와 상당 부분 중복 |

**주분류 집계**: 서버 미러 6 · 폼 입력 5 · UI 상태 4 · 파생 가능 1 = **16** ✓
(파생 성격 보유 전체: #9 순수 파생, #10 준파생, #15·#16 파생 가능 병기 — 4개)

---

## 2. 변경 트리거 → 함께 변경되는 상태 관계 표

setState 개수는 소스 줄과 대조한 실측. 부수효과(콜백·URL 수명주기·타이머)를 별도 열로 병기.

| 트리거 (줄) | 동시 setState | 개수 | 부수효과 |
|---|---|---|---|
| `enterEdit` (L49) | nameInput←displayName · reviewInput←displayReview · pendingPhotoFile=null · pendingPhotoCleared=false · movieInput='' · movieSuggestions=[] · showDropdown=false · isEditing=true | **8** | — |
| `handleMovieInput` (L60) 동기부 | movieInput · selectedMovieId=null · selectedMovieTitle='' | 3 | 기존 debounce 타이머 clear |
| ├ 빈 값 분기 (L65) | + movieSuggestions=[] · showDropdown=false | +2 (計5) | — |
| └ 비어있지 않음 (L66) | (300ms 후) movieSuggestions←서버응답 · showDropdown=true | 비동기 2 | `searchMoviesAction` 호출 |
| `handleSubmitNew` (L73) 실패 | error | 1 | `submitMovie` 호출 |
| └ 성공 | → `selectMovie` 경유 | 5 | — |
| `selectMovie` (L79) | selectedMovieId · selectedMovieTitle · movieInput='' · movieSuggestions=[] · showDropdown=false | **5** | — |
| `clearMovie` (L87) | selectedMovieId=null · selectedMovieTitle='' · movieInput='' · movieSuggestions=[] · showDropdown=false | **5** | — |
| `cancelEdit` (L95) 신규취소 분기 | (setState 없음) | 0 | revokeObjectURL · `onDelete` · `onClose` |
| └ 일반 취소 분기 | nameInput←displayName · reviewInput←displayReview · pendingPhotoFile=null · pendingPhotoPreview=null · pendingPhotoCleared=false · photoUrl←originalPhotoUrl · isEditing=false · error='' | **8** | revokeObjectURL |
| `handlePhotoSelect` (L113) 검증실패 | error (2종 문구) | 1 | — |
| └ 성공 | pendingPhotoFile · pendingPhotoPreview · pendingPhotoCleared=false · error='' | 4 | 기존 preview revoke + createObjectURL |
| `clearPendingPhoto` (L126) | pendingPhotoFile=null · pendingPhotoPreview=null · pendingPhotoCleared=true | 3 | revokeObjectURL |
| `handleSave` (L133) 분기A: cleared+영속 spot | (transition 내) displayName · displayReview · photoUrl=null · pendingPhotoCleared=false · isEditing=false / 실패 시 error 1개만 | 5 | `clearSpotPhoto` 서버액션 · `onUpdate` |
| ├ 분기B: cleared+임시 spot | 분기A와 동일 5개 (transition 없음) | 5 | `onFileSelect(null)` · `onUpdate` |
| └ 분기C: 일반 저장 | displayName · displayReview · pendingPhotoFile=null · pendingPhotoPreview=null · isEditing=false (+새 사진 있으면 photoUrl←preview) | 5~6 | (사진 시) `onFileSelect(file)` · `onUpdate` |

### 묶음(클러스터) 식별 — 함께 움직이는 상태군

| 클러스터 | 구성 상태 | 근거 |
|---|---|---|
| **작품 검색군** (5) | movieInput · movieSuggestions · showDropdown · selectedMovieId · selectedMovieTitle | `selectMovie`와 `clearMovie`가 **완전히 동일한 5개**를 set (값만 다름). `handleMovieInput`도 이 군 내에서만 동작 |
| **사진군** (5) | photoUrl · originalPhotoUrl · pendingPhotoFile · pendingPhotoPreview · pendingPhotoCleared | 4개 함수(handlePhotoSelect · clearPendingPhoto · cancelEdit · handleSave)에서 항상 부분집합으로 함께 변경. revoke 수명주기 공유 |
| **편집 세션군** (4) | isEditing · nameInput · reviewInput · error | enterEdit(진입 시 일괄 초기화) / cancelEdit·handleSave(종료 시 일괄 정리)에서만 경계가 바뀜 |
| **표시값군** (2) | displayName · displayReview | handleSave 3분기 전부에서 쌍으로만 갱신. 단독 변경 경로 없음 |

교차 관찰: `enterEdit`(8개)와 `cancelEdit`(8개)는 세 클러스터에 걸쳐 set — "편집 세션의 시작/종료가 곧 전 상태의 리셋 경계"라는 구조. 개별 상태가 아니라 세션 단위로 움직이고 있음이 수치로 확인됨.

---

## 3. RHF+Zod 도입 시 흡수 예상 (분류만)

| 상태 | 예상 | 근거 |
|---|---|---|
| `nameInput` | **흡수** | 폼 필드 값 영역 |
| `reviewInput` | **흡수** | 폼 필드 값 영역 |
| `movieInput` | **흡수** | 폼 필드 값 영역 (검색어) |
| `pendingPhotoFile` | **흡수** | 폼 필드 값 영역 (파일) |
| `pendingPhotoCleared` | **흡수** | 사진 필드의 값 상태(유지/교체/비움)에 포함되는 의도 플래그 |
| `selectedMovieId` | **흡수** | 폼 필드 값 영역 (작품 연결 값) |
| `selectedMovieTitle` | **흡수** | 위 필드의 표시용 부속 — 필드 값 또는 파생으로 귀속 |
| `error` | **부분 흡수** | 검증 실패 2종(크기·타입)은 스키마 검증 영역 / 서버 액션 실패 메시지는 폼 메타(루트 에러) 영역 대응 |
| `nameInput` 필수 검증 | (참고) | 현재 `!nameInput.trim()` 수동 가드(L134, L350) — 스키마 검증 영역에 대응되는 기존 로직 |
| `isPending` (16개 외) | **부분 흡수** | 제출 진행 메타 영역과 대응. 단 현재는 서버 액션 1분기에만 사용 |
| `pendingPhotoPreview` | **잔존(파생)** | 폼 값(파일)에서 계산되는 파생 + revoke 수명주기 — 폼 값 자체가 아님 |
| `isEditing` | **잔존** | 보기/편집 모드 UI — 폼 범위 밖 |
| `showDropdown` | **잔존** | 드롭다운 UI (파생 가능 성격 병기) |
| `movieSuggestions` | **잔존** | 서버 검색 결과 캐시 — 폼도 UI도 아닌 서버 상태 계열 |
| `displayName` | **잔존** | 서버 미러 + 낙관적 표시 — 폼 밖 데이터 계층 |
| `displayReview` | **잔존** | 위와 동일 |
| `photoUrl` | **잔존** | 서버 미러 — 폼 밖 데이터 계층 |
| `originalPhotoUrl` | **잔존** | 취소 복원용 스냅샷 — 폼의 기본값 개념과 대응되는 성격이나 현재는 데이터 계층 |

**집계 (16개 기준)**: 흡수 7 · 부분 흡수 1(`error`) · 잔존 8.
즉 RHF+Zod는 **폼 입력 5개 전부 + 서버 미러 중 폼 값 성격 2개(#14·#15)** 를 흡수하고, **서버 미러 데이터 계층(4) · UI 상태(3) · 파생(1)** 은 별도 처리 대상으로 남는다 — 도입만으로 16→8 이하가 되는 것은 아니며, 잔존 8개는 각각 데이터 계층·파생·UI로 성격이 갈린다는 것이 이 분석의 핵심 사실.

---

## 부록 — 계획 대비 정정

- 계획서에 `enterEdit` 동시 set을 7개로 기재했으나 소스 대조(L50~L57) 결과 **8개**로 정정.
- `pendingPhotoCleared`는 계획서에서 파생 후보로 분류했으나, 현 상태들로부터 순수 계산이 불가해 **주분류 폼 입력**(준파생 병기)으로 확정.
