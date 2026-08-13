# 0189 회고: SpotMovie.description 추가 — 장소×작품 촬영 장면 설명

작성일: 2026-07-14 / 소요: 약 1시간 / 커밋: 5f65375

## 1. 한 줄 요약
공공데이터의 촬영 장면 설명(RELATE_PLACE_DC)이 per-(장소,작품)임을 확인하고, Spot이 아닌 조인(SpotMovie)에 nullable TEXT 컬럼을 추가했다.

## 2. 왜 / 목적 / 이유
- **왜**: 한국문화정보원 데이터의 설명이 같은 덕수궁 돌담길이라도 도깨비·미생·우영우마다 다르다. `Spot.description`에 넣으면 다중 작품 스팟에서 정보가 손실된다.
- **목적**: 우측 패널 "이 장소의 작품" 각 행에 작품별 장면 설명 표시. 지도 배너에 공공데이터 출처 표기.
- **이유**: B1의 per-place/per-visit 분리와 같은 층의 판단 — 이번엔 per-link. 데이터의 귀속이 스키마의 자리를 결정한다.

## 3. 작성한 프롬프트
★★★★★ DDL 사전 보고 게이트. `ALTER TABLE "spot_movies" ADD COLUMN IF NOT EXISTS "description" TEXT;` 승인(가산·nullable·백필 없음이라 덤프 생략). 표시 위계(제목 유지, 설명 muted 12px line-clamp-2, null이면 미렌더) + 출처 문구는 데이터셋명까지 풀네임.

## 4. 작성·수정한 코드

4파일 28+/12-. 컬럼 1개가 스키마→쿼리→화면까지 한 줄기로 흐른다.

```sql
-- prisma/migrations/20260714120000_add_spot_movie_description/migration.sql
ALTER TABLE "spot_movies" ADD COLUMN IF NOT EXISTS "description" TEXT;
```

```prisma
// prisma/schema.prisma — SpotMovie
  spotId      String   @map("spot_id")
  movieId     String   @map("movie_id")
+ description String?  // per-link 촬영 장면 설명 (RELATE_PLACE_DC). 같은 장소라도 작품마다 다름
  createdAt   DateTime @default(now()) @map("created_at")
```

```ts
// lib/spot/queries.ts — 타입·select·파생 3곳
- movies: { id: string; title: string }[];
+ movies: { id: string; title: string; description: string | null }[]; // description = per-link 촬영 장면 설명

- select: { movie: { select: { id: true, title: true } } },
+ select: { description: true, movie: { select: { id: true, title: true } } },

// description은 movie가 아니라 **연결(spotMovies)** 쪽 필드라 파생에서 합친다
- const movies = s.spotMovies.map((sm) => sm.movie);
+ const movies = s.spotMovies.map((sm) => ({ ...sm.movie, description: sm.description }));
```

```tsx
// components/SpotFinderMapNaver.tsx — 작품 목록 행이 1줄 → 2줄
<li key={m.id}>
  <p className="text-sm text-fg">{m.title}</p>
  {/* per-link 촬영 장면 설명 — null이면 요소 자체 미렌더(빈 줄·플레이스홀더 금지) */}
  {m.description && (
    <p className="mt-0.5 text-xs text-muted line-clamp-2 break-keep">{m.description}</p>
  )}
</li>
// 행이 2줄이 되면서 목록 간격도 gap-1.5 → gap-2.5
```

```tsx
// 우하단 안내 배너 — 제공 범위 + **공공데이터 출처 표기(의무)**. 2행 스택,
// items-start로 아이콘 상단 정렬
<div className="… flex items-start gap-1.5 …">
  <Info size={12} className="mt-0.5 text-muted shrink-0" />
  <div className="flex flex-col leading-snug">
    <span className="text-xs text-fg2">촬영지 정보는 국내만 제공됩니다</span>
    <span className="text-xs text-muted">출처: 한국문화정보원 미디어콘텐츠</span>
  </div>
</div>
```

## 5. 결과 / 교훈
- 4파일 28+/12-. 적용 직후 500 — dev 서버 구 Prisma Client(세 번째). 재기동으로 해소.
- 교훈: **스키마 변경 후 재기동은 검증 절차의 일부**로 굳었다. 그리고 공공데이터 사용 시 출처는 기관명이 아니라 데이터셋명까지 — 검증 가능성이 정직함이다.
