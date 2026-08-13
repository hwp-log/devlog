# 0300 회고: Story 미니멀 카드 재구성

**작성일**: 2026-07-21
**관련 커밋**: `df6cc34` feat: 0300 Story 미니멀 카드 재구성 - 카드 틀 제거·4:3 사진 중심, 노출 필드를 작품·위치로 교체

---

## 1. 한 줄 요약

Story 카드를 사진 중심 미니멀 카드로 재구성 — 카드 틀(배경·테두리·그림자)을 걷어내고 4:3 사진만 남기고, 노출 필드를 `author·tags`에서 제품 탐색축인 `작품·위치`로 교체. 에어비앤비 카드를 직접 실측해 타이포까지 참고하되, 작품 배지 등 제품에 필요한 요소는 추가.

---

## 2. 왜 / 목적 / 이유

- **왜**: 0299판 카드는 author·tags·preview를 노출했는데, 촬영지 발견 앱에서 사용자가 카드를 볼 때 궁금한 건 "누가 썼냐"가 아니라 "무슨 작품이고 어디냐". 정보축이 제품 목적과 어긋나 있었음.
- **목적**: 카드 정보를 제품의 핵심 탐색축(작품·위치)에 맞춰 재정렬하고, 사진이 주인공이 되도록 시각적 밀도를 낮춤.
- **이유**: 여행/장소 서비스는 이미지가 정보의 핵심이라 사진 중심 미니멀 카드가 맞음. 틀이 있으면 시선이 분산됨. 에어비앤비 카드를 직접 실측(타이포 weight 500·12px)해 근거를 확보하되, 맹목적 모방이 아니라 작품 배지처럼 우리 제품에 필요한 요소는 더함.

---

## 3. 작성한 프롬프트

```
[배경]
Story 카드를 사진 중심 미니멀 카드로 재구성. 카드 틀(배경·테두리·그림자) 제거,
4:3 사진만 남김. 노출 필드 author·tags·preview → 작품·위치로 교체.
에어비앤비 카드 실측 참고(타이포 weight 500·12px), 작품 배지는 제품 고유 요소로 추가.

[작업]
1. StoryCard 재구성 — 틀 제거, aspect-[4/3] 사진 + rounded-[12px]
2. 노출 필드 교체: 작품(대표 1개)·위치(스팟명)·제목·날짜·좋아요
3. 작품 배지 오버레이(사진 좌상단, 첫 작품만)
4. queries에 작품·위치 도출 배선 추가, format-date 날짜 포맷 신설

[하지 말 것]
카드 틀 복원 ❌ / author·tags 노출 ❌ / 에어비앤비 그대로 복제 ❌ / 커밋 ❌

[참조 패턴]
0185 대표 규칙(대표 작품 1개 도출)

[검수 모드]
plan 요청.
```

> 실제 프롬프트 원문이 다르면 — 위는 커밋 내용 기반 재구성.

---

## 4. 코드 작성 & 수정

변경 파일 7개: `app/story/_components/StoryCard.tsx`(핵심) · StoryCardList · `lib/story/queries.ts` · `lib/format-date.ts`(신설) · page.tsx · my-story/page.tsx · MyStoryCardGrid.

### 노출 필드 변경

```
0299판: thumbnail · title · createdAt · likeCount · preview · tags · author
0300판: thumbnail · title · createdAt · likeCount · work?(작품) · location?(위치)
        → preview·tags·author 제거, work/location 신설
```

### `app/story/_components/StoryCard.tsx` — 렌더 구조 (위→아래)

```tsx
<Link className="group block cursor-pointer">   {/* 카드 틀·테두리·그림자 전부 제거 */}

  {/* 사진: 4:3, 둥근 모서리 12px */}
  <div className="aspect-[4/3] rounded-[12px] overflow-hidden bg-surface2">
    <img className="object-cover ..." />        {/* 없으면 "이미지 없음" */}

    {/* 작품 배지: 조건부(work), 사진 좌상단 오버레이, 첫 작품만 */}
    <span className="absolute top-2 left-2 rounded-full ... bg-bg dark:bg-surface2 text-fg">
      {work}                                     {/* 라이트=흰 pill / 다크=서피스 pill */}
    </span>
  </div>

  {/* 제목: 12px, 2줄 클램프, 자간 -0.02em */}
  <h3 className="mt-2 text-xs font-medium text-fg break-keep line-clamp-2 tracking-[-0.02em]">{title}</h3>

  {/* 날짜 */}
  <p className="mt-0.5 text-xs text-muted">{formatStoryCardDate(createdAt)}</p>

  {/* 메타 한 줄: 위치 · 좋아요 (아웃라인 아이콘, 하트 회색 통일) */}
  <div className="text-xs text-fg2">
    <MapPin /> {location}   ·   <Heart /> {likeCount}
  </div>
</Link>
```

### 배선

```ts
// lib/story/queries.ts — fetchStoriesWithMeta include에 추가
storySpots: {
  orderBy: { order: 'asc' }, take: 1,          // 대표 스팟 1개
  select: { spot: {
    name: true,                                 // → 위치(스팟명)
    spotMovies: { orderBy: { createdAt: 'desc' }, take: 1,
                  select: { movie: { title } } } // → 작품(대표 1개, 0185 규칙)
  }}
}

// lib/format-date.ts — 신설
formatStoryCardDate(date)
  // 올해     → "M월 D일"
  // 지난해   → "YYYY년 M월 D일"
```

### "미니멀 에어비앤비식" 구현 포인트

- **카드 틀 제거**: 배경·테두리·그림자·padding 없앰 → 사진만 rounded-[12px], 텍스트는 맨바닥(사진 좌측선 정렬).
- **4:3 사진** + 둥근 모서리 12px.
- **작품 배지 오버레이**: 사진 위 pill, 첫 작품만(제품 고유 요소).
- **절제된 타이포**: 제목 12px / line-clamp-2 / 자간 -0.02em, 날짜·메타 12px (에어비앤비 실측 반영).

---

## 5. 결과 / 배운점

### 결과
- 카드가 사진 중심으로 재편 — 촬영지 이미지가 시선의 주인공이 됨.
- 정보축이 제품 목적(작품·위치)과 정렬 — 발견 동선에 불필요한 author·tags 제거.
- 작품·위치는 queries include로 서버에서 도출(대표 1개 규칙), format-date로 날짜 표기 통일.
- 브라우저 수동 확인 잔여(사용자): 작품 배지 유무 케이스, 이미지 없음 폴백, 라이트/다크 배지 색, line-clamp 동작.

### 배운점
- **카드 정보 설계는 제품 탐색 목적에서 역산**: "무엇을 보여줄까"를 디자인이 아니라 "사용자가 이 화면에서 뭘 궁금해하나"에서 출발. 촬영지 앱이니 작품·위치가 먼저고 author는 부차. 필드 선택 자체가 제품 판단이었다.
- **레퍼런스는 실측하되 판단으로 변형**: 에어비앤비를 "하니까"가 아니라, 왜 사진이 주인공이어야 하는지 근거를 세운 뒤 실제 카드를 뜯어 타이포까지 참고했다. 그대로 복제하지 않고 작품 배지처럼 제품에 필요한 요소는 더했다 — 모방과 참조의 차이.
- [추가 배운점 있으면 사용자 확인]

---

## 결정 (Decisions)

- **노출 필드 = 제품 탐색축(작품·위치), author·tags 제거** — 촬영지 발견 앱에서 카드의 목적은 "무슨 작품·어디"의 전달. 정보 밀도를 줄이되 발견에 필요한 축만 남김.
- **카드 틀 제거·사진 중심(에어비앤비식)** — 여행/장소 서비스는 이미지가 정보의 핵심. 틀은 시선 분산 요인이라 제거. 에어비앤비 실측으로 타이포 근거 확보하되 맹목 복제는 배제.
- **작품 배지는 제품 고유 요소로 추가** — 레퍼런스에 없어도 "무슨 작품 촬영지냐"가 핵심 질문이라 사진 위 오버레이로 전면 노출. 대표 작품 1개는 0185 규칙 재사용.
