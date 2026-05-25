# 0031 회고: 대시보드 → Story 피드 디자인 전환

- **작성일**: 2026-05-22
- **소요 시간**: (작성 시 채움)
- **관련 커밋**: (커밋 후 해시 채움)

---

## 1. 한 줄 요약

대시보드 페이지를 청사진 2번(Story 피드) 디자인으로 전환. 헤더 로고·메뉴 갈음, 본문 위젯 폐기 + 카드 그리드, 빈 페이지 3개(SpotFinder / CostPlan / My Dots) 신규.

---

## 2. 왜 / 목적 / 이유

### a) Story 피드 디자인 진입

- 왜 = 0030에서 인증·랜딩 글래스 시스템 박힘. 다음 자연 진입점 = 로그인 후 첫 화면(대시보드).
- 목적 = 사용자 흐름(랜딩 → 인증 → 대시보드) 시각 단절 없음.
- 이유 = 청사진 본질로 매칭하면 대시보드 = Story 피드. DevLog 흔적(연속 기록일 위젯 등) 제거 본질 박힘.

### b) StreakWidget 폐기 (= 파일 보존)

- 왜 = Dotrip은 "여행 스토리" 도메인 / 연속 기록일은 학습 도메인(DevLog) 본질.
- 목적 = 도메인 일관성 박음. UI에서 import만 제거.
- 이유 = 파일 자체 삭제는 위험(= 다음 작업 가능성). import만 끊는 본질로 박음. 다음 작업에서 박힌 본질 박혀 있으면 삭제.

### c) 메뉴 명칭 결정 (Story / SpotFinder / CostPlan / My Dots)

- 왜 = 청사진 7개 페이지 → 메뉴 4개로 박음.
- 목적 = 도메인 본질 박힌 명칭.
  - Story = 여행 스토리 피드 (= velog 본질)
  - SpotFinder = 작품 촬영지 검색
  - CostPlan = 여행 예산 계획
  - My Dots = 내 점(= 내 기록)
- 이유 = 영어 명칭으로 박은 본질 = 브랜드 일관성(= Dotrip). 한일 다국어 박을 때 매칭 쉬움.

### d) 빈 페이지 공통 컴포넌트 추출 (= `ComingSoon.tsx`)

- 왜 = 3개 페이지(SpotFinder / CostPlan / My Dots) 모두 "준비 중" 본질.
- 목적 = 코드 중복 박지 않음 + 추후 빈 페이지 박는 본질 박힐 때 재사용.
- 이유 = "Three similar usages = abstract" 본질로 박음. 0030 글래스 wrapper와 다른 결정(= 그때는 2곳, 지금은 3곳).

### e) TIL 작성 버튼 본문 제거 + 헤더 이동 보류

- 왜 = 청사진 본질 = 작성 버튼이 헤더에 박혀 있음. 근데 이번엔 헤더 본질만 박음.
- 목적 = 본문에서 제거(= 시각 일관성) + 헤더 이동은 다음 작업.
- 이유 = 작성 버튼 헤더 이동 = 스토리 작성 기능과 묶음 본질. 도메인 전환(`/til/new` → `/story/new`) 후 박는 게 맞음.

---

## 3. 작성한 프롬프트

(원본 프롬프트 박음 — `/mnt/user-data/outputs/0031-prompt.md` 또는 작업 중 박힌 본문)

```
[배경]
0030 인증 + 랜딩 글래스 디자인 완료.
이번은 대시보드 페이지를 청사진 2번 페이지 (= Story 피드) 디자인으로 전환.
DB / 라우팅 / 인증 로직 무변경 (= UI 순수).

[목표]
대시보드 (/dashboard) 페이지 + 빈 페이지 3개 디자인 작업.
헤더 / 본문 / 빈 페이지 = Round 분할 진행.

[Round 분할]
Round 1 = 헤더 (= 로고 / 메뉴 / 우측 정리)
Round 2 = 본문 (= 위젯 폐기 / 필터 칩 / 카드 그리드)
Round 3 = 빈 페이지 (= SpotFinder / CostPlan / My Dots + ComingSoon)

[하지 말 것]
❌ DB 테이블 / 컬럼 변경
❌ TIL CRUD 로직 / Server Action 변경
❌ + 스토리 작성 버튼 추가 (= 다음 작업)
❌ 필터 칩 작동 로직 (= 시각만)
... (전체 [하지 말 것] 박힌 본문 박음)
```

---

## 4. 코드 작성 & 수정

### Round 1: 헤더

변경 파일:
- `app/(protected)/layout.tsx` (또는 헤더 컴포넌트)
- 로고: "DevLog" → "Dotrip"
- 메뉴 추가: Story / SpotFinder / CostPlan / My Dots
- 우측: 이메일 + 로그아웃 그대로

```tsx
// (작업 코드 박음)
```

### Round 2: 본문

변경 파일:
- `app/(protected)/dashboard/page.tsx` (또는 본문 컴포넌트)
- StreakWidget import 제거 (= 파일 자체는 보존)
- 필터 칩 박음 (= 시각만, 작동 X)
- 카드 그리드 청사진 매칭 (= [TIL 배지] + 제목 + 본문 + 날짜)
- + 스토리 작성 버튼 제거

```tsx
// (작업 코드 박음)
```

### Round 3: 빈 페이지

신규 파일:
- `app/(protected)/_components/ComingSoon.tsx`
- `app/(protected)/spot-finder/page.tsx`
- `app/(protected)/cost-plan/page.tsx`
- `app/(protected)/my-dots/page.tsx`

```tsx
// ComingSoon.tsx 박음
type Props = {
  title: string;
  description?: string;
};

export function ComingSoon({ title, description }: Props) {
  return (
    // (작업 코드 박음)
  );
}
```

```tsx
// 각 페이지에서
<ComingSoon
  title="SpotFinder"
  description="촬영지 검색 기능 준비 중"
/>
```

---

## 5. 결과 / 배운점

### 결과
- 대시보드 = Story 피드 디자인 매칭 (= 청사진 2번)
- 헤더 로고·메뉴 Dotrip 본질로 갈음
- 빈 페이지 3개 박힘 (= 메뉴 클릭 시 "준비 중" 박힘)
- DevLog 흔적(연속 기록일) UI에서 제거 / 파일은 보존
- 커밋 4개 분할 (= atomic / feat × 3 + docs × 1)

### 배운점
- **도메인 전환 = UI / 데이터 분리 본질**: 이번엔 UI만 박음. 데이터(til_entries)는 그대로. 다음 작업에서 박을 본질.
- **빈 페이지 = 시각 일관성 박는 본질**: 메뉴 클릭 시 빈 화면이 아니라 "준비 중" 박힌 게 멘토 시연 본질 박힘.
- **파일 보존 vs 삭제 본질**: StreakWidget = 파일 보존 / import만 제거. 다음 작업 박힌 본질 박혀 있으면 그때 삭제. 조기 삭제 위험 박지 않음.
- **3곳 = abstract 본질**: 0030 글래스 wrapper(= 2곳)는 추출 보류, 0031 ComingSoon(= 3곳)은 추출 박음. "Three similar usages" 규칙 본질 박힘.

---

## 결정 (Decisions)

- **StreakWidget 폐기 (파일 보존)**: UI에서 import 제거 / 파일은 보존. 다음 작업 박힌 본질 박혀 있으면 삭제.
- **메뉴 명칭 = Story / SpotFinder / CostPlan / My Dots**: 영어 본질 박음 (= 브랜드 일관성 + 다국어 매칭).
- **빈 페이지 공통 컴포넌트 추출 (`ComingSoon.tsx`)**: 3곳 사용 본질로 추출. 위치 = `app/(protected)/_components/`.
- **TIL 작성 버튼 헤더 이동 보류**: 본문에서 제거만 박음. 헤더 이동은 스토리 작성 기능과 묶음 본질(= 다음 작업).
- **데이터 모델 무변경**: til_entries 그대로 박음. 도메인 전환(= stories) 본질은 다음 작업(= 0032 또는 그 이후).

---

## 다음 작업 박을 본질

- **0032** = Prisma 연동 (= ORM 박음 / 다대다 관계 본질 박음)
- **0033** = schema.prisma 박음 + migrate (= til_entries drop / stories 박음 / RLS 박음)
- **0034** = `/dashboard` → `/story` 라우트 갈음 + 데이터 fetch 갈음
- **0035** = 스토리 작성 기능 (= /story/new / 사진 / 태그)

→ 박힌 본질 = "til 잔재 박지 않음" / "도메인 일관성 박음" / "velog 본질 박음".
