# 0185 회고: SpotFinder 읽기 전환 — 작품 복수화·썸네일 도출·작성자 다가화

작성일: 2026-07-13 / 소요: 약 2시간 / 커밋: 7216247

## 1. 한 줄 요약
SpotFinder의 읽기 경로를 구컬럼 단수 참조에서 story_spots·spot_movies 조인 기준으로 전환하고, "사진 있는 스토리 중 최신" 썸네일 도출을 신설했다.

## 2. 왜 / 목적 / 이유
- **왜**: S1으로 조인 데이터는 있는데 화면은 여전히 `spot.movie`·`spot.photoUrl` 단수를 읽었다. 사전 실측 결과 "좌측이 최신 사진으로 정렬한다"는 믿음은 시안에만 있었고 코드엔 없었다(`spot.photoUrl` 고정, 정렬은 spots.created_at).
- **목적**: 작품 복수화(배지 대표 1개 + N), 썸네일을 "사진 있는 스토리 중 최신"으로 도출, 작성자 다가화(최신 + 외 N명).
- **이유**: 썸네일 폴백 규칙은 "최신 스토리에 사진 없으면 다음 스토리 사진" — 정렬이 이미 최신순이라 `find(ss => ss.photoUrl)` 한 줄로 떨어진다. 단수 필드를 타입에서 제거해 누락 소비처를 컴파일 에러로 강제 노출시켰다(타입을 안전망으로 역이용).

## 3. 작성한 프롬프트
plan 전 확증 프롬(현행 실측 4항목: 썸네일 소스·정렬 축·Movie 포스터 유무·좋아요 귀속) → S2 본체 프롬([하지 말 것]에 정렬 축 변경·스키마 변경·B2·클라 .sort() 금지, 검수 ★★★★ N+1 방지 방법 명시 요구).

## 4. 작성·수정한 코드

2파일 109+/41-. 타입 확장이 대부분이고, 화면은 단수→복수 대응만.

```ts
// lib/spot/queries.ts — 반환 타입이 단수 movie/photoUrl에서 파생 필드 묶음으로
export type SpotFinderSpot = {
  …
  thumbnailUrl: string | null;             // 도출: 사진 있는 최신 스토리의 story_spots.photo_url
  movies: { id: string; title: string }[]; // 최신 연결순 (spot_movies.created_at desc)
  primaryMovie: { id: string; title: string }; // 대표 = movies[0]. where 보장으로 항상 존재
  extraMovieCount: number;                 // 배지 "+N"
  author: { nickname: string; avatarUrl: string | null }; // 최신 스토리 작성자
  extraAuthorCount: number;                // "외 N명" — 고유 작성자(userId) 기준
  storyCount: number;
  stories: SpotFinderStory[];              // 다녀온 이야기 (최신순)
};
```

```ts
// lib/spot/queries.ts — N+1 회피: 단일 findMany + 중첩 select.
// Prisma가 관계당 배치 SQL(WHERE IN)로 로드 → 스팟 개수와 무관하게 쿼리 수 상수.
const rows = await prisma.spot.findMany({
  where: { spotMovies: { some: {} } },   // S2: 구 movieId not null 대체
  orderBy: { createdAt: 'desc' },        // 리스트 정렬축 유지 (S2.5 소관 — 변경 금지)
  select: {
    …,
    spotMovies: {
      orderBy: { createdAt: 'desc' },    // 최신 연결순 (S1 백필서 created_at 승계 → 결정적)
      select: { movie: { select: { id: true, title: true } } },
    },
    storySpots: {
      orderBy: { story: { createdAt: 'desc' } }, // 파생은 아래 JS 정렬로 재보장 — 이 DB 정렬에 비의존
      select: { photoUrl: true, story: { select: { …, _count: { select: { likes: true } } } } },
    },
  },
});
```

```ts
// lib/spot/queries.ts — 파생. DB 정렬에 의존하지 않도록 코드가 최신순을 보장한다.
// S3 다중 스토리에서 Prisma 정렬 누락 시 "엉뚱한 썸네일·대표 작성자"로 조용히 틀리는 것을 차단.
const storySpots = [...s.storySpots].sort(
  (a, b) => b.story.createdAt.getTime() - a.story.createdAt.getTime(),
);
// 사진 있는 최신 스토리 (정렬 최신순 → find가 곧 폴백 체인). 전부 없으면 null → 플레이스홀더
const thumbnailUrl = storySpots.find((ss) => ss.photoUrl)?.photoUrl ?? null;
const latestAuthor = storySpots[0]?.story.user ?? null;
const authorCount = new Set(storySpots.map((ss) => ss.story.user.id)).size;
```

```tsx
// components/SpotFinderMapNaver.tsx — 단수 참조를 전부 복수/파생으로 교체 (4갈래)
// ① 사진: spot.photoUrl → spot.thumbnailUrl (마커 카드·리스트·히어로 3곳)
// ② 배지: 대표 1개 + N
{spot.primaryMovie.title}{spot.extraMovieCount > 0 ? ` +${spot.extraMovieCount}` : ''}
// ③ 작성자: 최신 1명 + 외 N명
{spot.author.nickname}{spot.extraAuthorCount > 0 ? ` 외 ${spot.extraAuthorCount}명` : ''}
// ④ 칩 집계·검색·필터: 한 스팟이 복수 작품에 속하므로 s.movies 순회 (각 소속 그룹에 카운트)
for (const m of s.movies) { … }
s.movies.some((m) => m.title.toLowerCase().includes(q))
spots.filter((s) => s.movies.some((m) => m.id === selectedMovieId))
```

## 5. 결과 / 교훈
- 2파일 109+/41-. 무게가 쿼리 쪽(설계대로).
- **JS 정렬 방어**: 현행 데이터(스팟당 스토리 1)로는 to-one 정렬의 실동작을 영구히 검증할 수 없다. CC가 합성 시나리오(뒤섞은 입력)로 검증 — "검증할 수 없는 것을 검증 가능하게 만드는" 방법.
- VS Code 에디터가 구버전 파일을 쥐고 PROBLEMS 46을 띄운 사고 — 오늘 두 번째 "디스크 vs 메모리" 불일치. git show로 확증 후 Don't Save로 해소.
