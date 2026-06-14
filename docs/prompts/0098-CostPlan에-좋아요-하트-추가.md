# 0098 회고: CostPlan에 좋아요(하트) 추가

- 작성일: 2026-06-14
- 소요: 약 2시간
- 관련 커밋: 1340bc6 `feat: 0098 CostPlan 좋아요(하트) 추가`

---

## 1. 한 줄 요약

공개 플랜 상세와 목록에 좋아요(하트)를 추가했다. 누르는 순간 화면을 먼저 바꾸는 낙관적 업데이트로 반응 지연을 없애고, 중복 좋아요는 코드 토글과 DB 복합 unique 제약 두 겹으로 막았다. 목록 카드는 본인이 누른 것만 빨강으로 표시하고, isLiked 조회는 유저별 집합 1회로 N+1을 방지했다.

---

## 2. 왜 / 목적 / 이유

### 낙관적 업데이트(누르는 순간 먼저 반영 + 롤백)

- 왜: 좋아요는 가벼운 상호작용이라 즉각 반응이 기대된다. 서버 응답을 기다렸다 반영하면 그 지연이 사용자에게 "눌린 게 맞나, 앱이 멈췄나" 하는 의심을 준다.
- 목적: 누르는 즉시 하트가 채워지고 카운트가 오르는 상태. 서버 왕복 시간이 화면에 드러나지 않는다.
- 이유: 낙관적 업데이트(optimistic update)로 화면을 먼저 바꾼다. "낙관적"인 이유는 대부분의 좋아요 요청이 성공할 거라 가정하고 먼저 반영하기 때문이다. 다만 낙관은 틀릴 수 있어 롤백이 짝으로 필요하다 — 서버가 실패하면 먼저 바꾼 화면을 원래대로 되돌린다. `useOptimistic`이 성공 시 실제값 확정·실패 시 롤백을 처리한다.

### 중복 방어(코드 토글 + DB unique 제약)

- 왜: 같은 유저가 빠르게 두 번 누르거나 네트워크가 두 요청을 동시에 보내는 경합(race condition)에서, 코드의 "있나 확인 후 추가" 검사가 둘 다 "없음"으로 읽고 둘 다 추가해버릴 수 있다. 그러면 한 유저가 같은 플랜에 좋아요가 두 개 쌓인다.
- 목적: 어떤 경합에서도 한 유저·한 플랜 조합은 좋아요가 딱 하나만 존재하는 상태.
- 이유: 두 겹으로 막았다. 코드에서는 토글(이미 누름이면 취소)로 정상 흐름을 처리하고, 그 아래 DB에 `@@unique([planId, userId])` 복합 제약을 둬서 한 조합은 행이 하나만 존재하게 강제한다(0089에서 생성). 코드 검사가 경합으로 뚫려도 DB unique가 두 번째 INSERT를 거부하는 최후 방어선이 된다.

### 목록 색 분기 기준은 "내가 눌렀나(isLiked)"

- 왜: 목록 카드의 하트 색을 "남이 눌렀든 안 눌렀든"이 아니라 "내가 눌렀나"로 갈라야, 공개 피드에서 내가 찜한 게 한눈에 보인다.
- 목적: 내가 누른 카드는 빨강, 안 누른 카드는 무색 + 총 카운트. 카운트는 항상 전체 합.
- 이유: 쿼리에서 현재 유저의 isLiked를 카드별로 계산해 prop으로 넘기고, PlanCard가 그 값으로 색을 분기한다. N+1을 피하려고 현재 유저가 누른 planId 집합을 한 번에 조회해 Set으로 만든 뒤, 각 카드가 Set 포함 여부만 본다. 비로그인이면 빈 Set이라 모두 무색으로 안전하게 떨어진다.

---

## 3. 작성한 프롬프트

하트 동작·표시(1차)와 목록 색 반영(2차) 두 단계로 나눠 plan 요청.

1차 — 하트 동작·표시:

```
[배경]
CostPlan 상세(CostPlanDetail)에 좋아요(하트) 추가.
PlanLike 테이블·RLS는 0089에서 생성 완료 (@@unique([planId,userId]), onDelete Cascade).
목록 카드(PlanCard)는 이미 좋아요 수 표시 중 (0092 _count.planLikes).
스토리에 LikeButton(낙관적 업데이트) 패턴이 있음 — 재사용.

[목표]
1. 좋아요 토글 서버 액션
   - 로그인 유저 기준 PlanLike upsert/delete (이미 누름 → 취소)
   - cost-plan은 (protected) 경로라 로그인 전제, user 확인만
   - revalidate 상세·목록
2. page.tsx 쿼리에 좋아요 정보 추가
   - 총 카운트(_count.planLikes) + 현재 유저의 좋아요 여부(isLiked)
3. CostPlan 상세 상단에 하트 버튼 + 좋아요 수
   - 스토리 LikeButton 낙관적 업데이트 패턴 재사용
   - 위치는 제목 옆 상단 (마이플랜 수정·삭제 자리에 대응)

[하지 말 것]
❌ git 커밋 (현우가 수동)
❌ PlanLike 스키마·RLS 변경 (0089 그대로)
❌ 복제·해시태그 (다음 단계)
❌ 정밀 비용 노출 (상세는 가공 유지)

[검수 모드]
- 하트 누르기 → 즉시 반영(낙관적) → 새로고침해도 유지
- 좋아요 수 정확, 중복 좋아요 불가(@@unique)
- tsc 통과
plan 요청.
```

2차 — 목록 카드 색 반영:

```
[배경]
하트 좋아요 구현 완료. 상세는 isLiked면 빨강으로 표시됨.
목록 카드(PlanCard)는 좋아요 수만 표시하고 색 분기가 없음(항상 무색).

[목표]
목록 카드 하트도 본인 좋아요 여부 반영:
- 내가 누른 플랜 → 빨강 채움 (상세와 동일)
- 내가 안 누른 플랜 → 무색 외곽선 + 총 카운트
- fetchPublicPlans(0092)에 현재 유저 좋아요 여부(isLiked) 추가
  - N+1 피하려면 현재 유저의 PlanLike planId 집합을 한 번에 조회 →
    각 카드에 매핑
- PlanCard에 isLiked prop → 빨강/무색 분기

[하지 말 것]
❌ git 커밋 (현우가 수동)
❌ 좋아요 토글 로직·스키마 변경 (표시만)
❌ 정밀 비용 노출

[검수 모드]
- 내가 누른 카드 빨강, 안 누른 카드 무색
- 카운트 정확, N+1 쿼리 없음
- tsc 통과
plan 요청.
```

---

## 4. 코드 작성 & 수정

### 신규: `app/(protected)/cost-plan/[id]/actions.ts`

좋아요 토글 서버 액션. 이미 누름이면 삭제, 아니면 추가. 정상 흐름은 토글로, 경합 중복은 DB unique로 막는다.

```ts
// app/(protected)/cost-plan/[id]/actions.ts (신규)
'use server';

export async function togglePlanLike(planId: string) {
  const user = await getUser();          // (protected) 경로 — 로그인 전제
  if (!user) return;

  const existing = await prisma.planLike.findUnique({
    where: { planId_userId: { planId, userId: user.id } },
  });

  if (existing) {
    await prisma.planLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.planLike.create({ data: { planId, userId: user.id } });
    // 경합으로 동시 INSERT가 들어와도 @@unique([planId,userId])가 거부 (최후 방어선)
  }

  revalidatePath(`/cost-plan/${planId}`);
  revalidatePath('/cost-plan');
}
```

> (실제 시그니처·에러 처리는 1340bc6 커밋 코드로 교체)

### 신규: `app/(protected)/cost-plan/[id]/PlanLikeButton.tsx`

낙관적 업데이트. `useOptimistic`으로 누르는 즉시 화면을 바꾸고, 서버 액션이 끝나면 실제값으로 확정(실패 시 롤백).

```tsx
// app/(protected)/cost-plan/[id]/PlanLikeButton.tsx (신규)
'use client';
// useOptimistic으로 isLiked·count를 먼저 토글 → 화면 즉시 반영
// 서버 액션(togglePlanLike) 완료 시 실제값 확정, 실패 시 자동 롤백
// 채움: isLiked면 rose-500, 아니면 무색 외곽선
```

> (실제 useOptimistic 구현은 1340bc6 커밋 코드로 교체)

### 수정: `app/(protected)/cost-plan/[id]/page.tsx`

쿼리에 총 카운트와 현재 유저의 좋아요 여부 추가.

```tsx
// _count.planLikes (총 카운트) + 현재 유저 isLiked
```

### 수정: `lib/plan/queries.ts` (목록 isLiked, N+1 방지)

fetchPublicPlans에 선택적 userId 파라미터 추가. 현재 유저가 누른 planId를 한 번에 조회해 Set으로 만든 뒤 각 카드에 매핑.

```ts
// lib/plan/queries.ts
const likedIds = userId
  ? new Set(
      (await prisma.planLike.findMany({
        where: { userId, planId: { in: planIds } },   // 한 번에 조회 (N+1 방지)
        select: { planId: true },
      })).map((l) => l.planId)
    )
  : new Set<string>();                                 // 비로그인 → 모두 무색

// 각 플랜: isLiked: likedIds.has(plan.id)
```

### 수정: `app/(protected)/cost-plan/_components/PlanCard.tsx`

PublicPlanListItem 구조분해라 isLiked prop이 타입에 자동 확장. isLiked면 rose-500, 아니면 무색으로 분기.

---

## 5. 결과 / 배운점

- 검증 통과: 하트 누르기 → 즉시 반영(낙관적) → 새로고침해도 유지, 같은 플랜 두 번 눌러 토글(켜짐/꺼짐), 목록에서 내가 누른 카드만 빨강, 비로그인이면 모두 무색, N+1 없이 카드 N개에 추가 쿼리 1회.
- 배운점 1: 낙관적 업데이트는 "낙관"과 "롤백"이 한 쌍이다. 빠른 반응을 위해 성공을 가정하고 화면을 먼저 바꾸되, 가정이 틀렸을 때(서버 실패) 되돌릴 길이 없으면 화면과 실제가 어긋난다. `useOptimistic`이 그 확정·롤백을 맡는다.
- 배운점 2: 중복 방어는 코드 한 겹으로 부족하다. 코드의 "확인 후 추가"는 동시 요청 경합에서 둘 다 통과할 수 있어, DB의 복합 unique 제약이 경합까지 막는 최후 방어선이 된다. 0089에서 미리 박아둔 제약이 이번 토글 동작의 안전성을 받쳐줬다 — 데이터 구조를 먼저 잡아두면 동작 구현이 가벼워진다.
