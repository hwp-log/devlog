# 0198 회고: story_spots 재도출을 upsert로 전환 — 편집 시 데이터 소실 방지

작성일: 2026-07-14 / 소요: 약 1시간 / 커밋: 4430842

## 1. 한 줄 요약
deleteMany→createMany 재도출을 upsert로 바꿨다 — rating이 앉기 전에, "편집이 데이터를 지우는" 구조를 봉인했다.

## 2. 왜 / 목적 / 이유
- **왜**: 어제 표지 — 편집마다 story_spots가 전삭제·재생성돼 id가 바뀐다. B2에서 rating이 앉는 순간 스토리를 편집할 때마다 별점이 소실된다.
- **목적**: (storyId, spotId) upsert. update는 order·review·photoUrl만(미래의 rating을 안 건드리는 의도를 코드에 명시). 제거된 스팟은 notIn 명시 삭제(CASCADE와 이중 안전).
- **이유(spot_movies는 미전환)**: Explore 검증 결과 seed 스팟(storyId=null)과 story 스팟이 겹치지 않아 description은 실제로 소실되지 않는다. 통일의 이득이 id 안정성뿐이라 ★★★★★ 코드의 복잡도만 늘린다 — blast radius 최소화. S3-b 표지로.

## 3. 작성한 프롬프트
upsert 전환 + spot_movies 동반 여부는 "날아간다면"의 조건부로 — CC가 조건 미충족을 실증해 1번(story_spots만) 선택.

## 4. 작성·수정한 코드
```ts
// app/story/[id]/actions.ts
await tx.storySpot.upsert({
  where: { storyId_spotId: { storyId, spotId: r.id } },
  update: { order, review, photoUrl },   // id·createdAt·(미래)rating 보존
  create: { ... },
});
await tx.storySpot.deleteMany({ where: { storyId, spotId: { notIn: derivedSpotIds } } });
```

주석에 남긴 판단 둘:

```ts
// 표지: 스팟 수만큼 순차 upsert(N쿼리). 현재 스토리당 스팟 소수라 무해 —
//   많아지면 Promise.all/raw SQL ON CONFLICT 검토.

// spot_movies는 재도출(delete→create) **유지** — story 편집이 description을 손상하지 않음
//   (description은 seed 스팟[storyId=null]에만 있고, 이 재도출은 storyId=this 스팟만 스코프).
// 표지(S3): 스팟 공유로 storyId=null이 되면 seed/story 구분이 사라져 description 소실 가능
//   → 그때 upsert 재검토.
```
`story_spots`만 upsert로 바꾸고 `spot_movies`는 그대로 둔 게 이 커밋의 경계다 — 소실 위험이
**현재 스코프에서 성립하지 않음**을 확인하고 표지만 남겼다. 1파일 14+/5-.

## 5. 결과 / 교훈
- 1파일 14+/5-. 격리 테스트로 구/신 대조 — 구 방식은 실제로 id를 재생성함을 실증.
- 교훈: **내 우려가 확증으로 반증되면 그대로 물러선다.** 추측으로 upsert를 넓혔으면 불필요한 복잡도만 남았다.
