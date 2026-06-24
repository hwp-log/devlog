# 0112 회고: Story 검색창에 인기 태그 흐르는 placeholder 추가

- 작성일: 2026-06-24
- 소요: 약 2시간
- 관련 커밋: e5797c5

## 1. 한 줄 요약

빈 검색창을 "사용자에게 떠넘긴 빈칸"이 아니라 "앱이 먼저 제안하는 자리"로 보고, 실제 인기 태그가 흐르는 placeholder를 넣었다. 제안과 검색 결과가 어긋나지 않도록 실제 집계 데이터를 쓰고, placeholder의 CSS 제약·접근성·# 표기를 함께 처리했다.

## 2. 왜 / 목적 / 이유

### 흐르는 placeholder — 앱이 먼저 다가가는 인터페이스

- 왜: 빈 검색창에 고정 안내문 하나만 두면 기계적인 템플릿 페이지처럼 느껴진다. 사용자가 "뭘 검색하지" 하고 빈칸 앞에서 망설이는 작은 불편을, 앱이 먼저 해소해주고 싶었다.
- 목적: 사용자가 앱에 다가가기 전에, 앱이 먼저 "이런 걸 검색할 수 있어요(#수리남, #제주…)"라고 제안하는 능동적 인터페이스.
- 이유: 빈 placeholder는 사실 사용자에게 떠넘긴 빈칸이다. 거기에 인기 태그를 흘려 검색의 진입 장벽을 앱이 대신 낮췄다. 핵심 기능에 필수는 아닌 디테일임을 알지만, "수동적 인터페이스를 능동적으로 바꾼다"는 방향을 직접 구현해본 시도다.

### 실제 인기 태그 집계 — 제안은 약속이다

- 왜: 흐르는 태그를 하드코딩(#수리남, #제주… 코드에 직접 작성)할 수도 있었다. 그러나 제안한 태그가 정작 검색해서 결과가 안 나오면, 사용자는 그 기능 자체를 의심한다.
- 목적: 제안한 태그를 따라 검색하면 반드시 결과가 나오는, 제안과 결과가 일치하는 상태.
- 이유: placeholder의 제안은 사용자에 대한 약속이다. 하드코딩하면 그 약속이 DB 현실과 어긋날 수 있고, 어긋나는 순간 검색 기능 전체에 대한 신뢰가 깨진다. 그래서 실제로 스토리가 많이 달린 태그를 집계(`fetchPopularTags`)해, "제안한 건 반드시 검색된다"를 데이터로 보증했다. 이런 신뢰 하나하나가 다음에 또 쓸지를 결정한다.

### placeholder의 CSS 제약 — fake 레이어로 우회 + 접근성 보전

- 왜: placeholder를 흐르게 하려는데, HTML의 native `placeholder`로는 애니메이션이 안 됐다.
- 목적: 태그가 부드럽게 흐르면서도, 시각장애 사용자가 검색창의 용도를 알 수 있는 상태.
- 이유: native `placeholder`는 텍스트 노드가 아니라 `::placeholder` 가상 요소라 transform·transition이 먹지 않는다. 그래서 input 위에 absolute로 fake 텍스트 레이어를 얹어 그걸 움직였다. 다만 이러면 native placeholder가 비어 스크린리더가 읽을 안내문이 사라지는 부작용이 생긴다. input에 `aria-label`을 붙여, 화면엔 흐르는 태그를·보조기기엔 고정 라벨을 분리해 제공했다. 모든 사용자에게 다가가려면 시각장애 사용자도 빠뜨릴 수 없다.

### # 표기 — 보이는 건 #태그, 검색은 # 제거

- 왜: placeholder를 `#수리남`처럼 보여줬는데, DB엔 태그가 `수리남`(# 없이)으로 저장돼, 보이는 대로 `#수리남`을 치면 검색이 0건이었다.
- 목적: 태그처럼 예쁘게 보이면서, 검색은 정확히 걸리는 상태.
- 이유: 보이는 값은 `#수리남` 그대로 두되, 검색 쿼리로 넘길 때만 앞의 `#`을 제거(`replace(/#/g, '')`)했다. 보이는 제안과 실제 결과가 일치해야 신뢰가 유지된다("제안은 약속"의 연장).

## 3. 작성한 프롬프트

### 인기 태그 집계 함수 추가

```
[배경]
Story 검색창 흐르는 placeholder용 "인기 태그 N개" 조회 함수 추가.
태그는 정규화된 Tag 테이블 + Story와 다대다. 스토리 0개인 태그는 제외.

[목표] lib/story/queries.ts 에 함수만 추가 (기존 함수 수정 금지):
export async function fetchPopularTags(limit = 8): Promise<string[]>
- where: { stories: { some: {} } }  // 스토리 1개 이상 달린 태그만
- orderBy: { stories: { _count: 'desc' } }  // 스토리 많은 순
- take: limit, select: { name: true }

[하지 말 것]
❌ 기존 fetchStoriesWithMeta 등 다른 함수 건드리지 마.
❌ 컴포넌트·placeholder는 다음 단계.

[검수] string[] 반환 / tsc 통과 / 임시 호출해 인기순으로 나오는지 콘솔 확인 후 임시 코드 제거.
```

(컨베이어 모션 단계는 plan 모드로 받아 구현 — fake 레이어 구조와 기존 검색 로직 무수정 확인이 핵심이었다.)

## 4. 코드 작성 & 수정

### 인기 태그 집계 (정규화된 Tag 테이블 다대다)

```ts
// lib/story/queries.ts
export async function fetchPopularTags(limit = 8): Promise<string[]> {
  const tags = await prisma.tag.findMany({
    where: { stories: { some: {} } },          // 스토리 0개 태그 제외
    orderBy: { stories: { _count: 'desc' } },  // 스토리 많은 순 = 인기순
    take: limit,
    select: { name: true },
  });
  return tags.map((t) => t.name);
}
// 실제 반환 예: ["드라마","영화","쌍문동","이태원클라쓰","기생충","서귀포","서울의봄","빈센조"]
```

(Prisma의 다대다 관계 `_count` 정렬 문법 `orderBy: { stories: { _count: 'desc' } }`는 web_search로 정규 문법임을 확인 후 적용.)

### fake placeholder 레이어 + 컨베이어 fade 모션

```
- native placeholder는 비우고 aria-label로 대체 (접근성).
- input 위에 absolute fake 레이어 1개 (pointer-events: none, value 비었고 미포커스일 때만 표시).
- 두 span 독립 마운트(track 통째 이동 아님) → 마지막→첫 단어 순환 시 스냅백 차단.
- 모션: 옛 단어가 위로 fade-out 퇴장 + 새 단어가 아래서 fade-in 등장 (동시).
  @keyframes ph-exit  { from { translateY(0);   opacity:1 } to { translateY(-100%); opacity:0 } }
  @keyframes ph-enter { from { translateY(100%); opacity:0 } to { translateY(0);    opacity:1 } }
  - 인터벌 4500ms, 애니메이션 700ms ease-out.
  - prevIdx 해제 타이머를 애니메이션 시간(700ms)과 동일하게 맞춤 (안 맞추면 중간에 글자가 툭 사라짐).
```

### # 검색 처리

```ts
// TagSearchBar.tsx — 검색 쿼리로 넘기는 값에서만 # 제거 (보이는 value는 그대로)
const normalized = val.trim().replace(/\s/g, '').replace(/#/g, '');
```

## 5. 결과 / 배운점

- 빈 검색창에 인기 태그가 컨베이어처럼 흐르며, "검색할 수 있는 것"을 앱이 먼저 보여준다. 제안한 태그는 실제 검색되고, 스크린리더에는 aria-label이 읽히며, `#수리남`으로 보여도 검색은 정확히 걸린다.
- 능동적 인터페이스: 빈 placeholder는 사용자에게 떠넘긴 빈칸이다. 앱이 먼저 제안하면 진입 장벽이 낮아진다. 다만 핵심 기능에 필수는 아닌 디테일이므로, 위치는 "있으면 좋은" 선에서 잡았다.
- 제안은 약속: 제안한 내용이 결과로 이어지지 않으면 신뢰가 깨진다. 하드코딩 대신 실제 집계를 쓴 건 미관이 아니라 신뢰의 문제였다.
- 기본 기능의 제약을 이해하고 우회: native placeholder는 `::placeholder` 가상 요소라 CSS 애니메이션이 안 먹는다. fake 레이어로 우회하되, 그 부작용(스크린리더 미인식)을 aria-label로 메꿨다. 화려함과 접근성을 맞바꾸지 않았다. (0110 backdrop-filter, 0111 flex와 같은 "제약을 이해하고 우회" 패턴.)
- 라이브러리는 검색 먼저: Prisma 다대다 `_count` 정렬 문법은 기억이 아니라 web_search로 확인 후 적용했다.
