# 0108 회고: SpotFinder 촬영지 지도 화면

- 작성일: 2026.6.18
- 소요: 약 4시간 (설계 결정 + 1~5단계 구현 + 4.5단계 검색·화살표 + 색 통일 + 동작 검증)
- 관련 커밋: e5c4976, 84f84bc

---

## 1. 한 줄 요약

0107까지 만든 작품-촬영지 연결 데이터 위에, 여러 사용자의 공개 촬영지를 한 지도에 모아 보여주는 SpotFinder 화면을 구축했다. 조회 함수 → 전체화면 Kakao 지도 → 클러스터링 → 작품 칩 필터+자동 줌 → 검색+화살표 → 마커 클릭 사이드 패널 → 사진까지 한 화면을 완성하고, 색을 Story와 통일했다. 그 과정에서 "필터와 상세를 분리한다", "비공개 기능을 안 만든다" 같은 설계 결정을 내렸다.

---

## 2. 왜 / 목적 / 이유

### 가. 검색·칩을 "필터"로만 두고, 상세는 마커 클릭을 거치게 한 이유 (핵심)

- **왜**: 작품과 촬영지는 1:N 관계다(수리남 = 촬영지 2곳). "작품 선택" 또는 "작품명 검색"만으로는 어느 촬영지의 상세를 보여줄지 결정되지 않는다.
- **목적**: 각 단계가 모호함을 하나씩만 해소하게 한다.
- **이유**:
  - 검색·칩 = **범위 좁히기**(전체 → 그 작품의 촬영지들). 무엇을 볼지는 정하지 않는다.
  - 마커 클릭 = **최종 선택**. 사용자가 직접 촬영지를 지정한다.
  - 검색이 바로 상세를 띄우게 만들면, 시스템이 "아마 이 촬영지일 것"이라고 추측해야 하는데, 1:N이라 그 추측은 틀릴 수 있다. 추측 대신 사용자 선택으로 넘긴다.
  - 단계: 작품명 → 그 작품의 촬영지들(지도에 점) → 촬영지 클릭 → 상세. 검색과 칩은 같은 목적지로 가는 두 입구(둘 다 필터)다.

### 나. SpotFinder 마커를 번호 없는 점으로 둔 이유 (Story 동선과의 차이)

- **왜**: Story의 동선 지도는 번호 마커(1→2→3)를 쓰는데, SpotFinder는 같은 Kakao 지도를 쓰면서도 번호 없는 점으로 했다.
- **목적**: 마커 형태가 그 화면의 목적을 정확히 드러내게 한다.
- **이유**: Story 동선은 "순서"가 핵심이라 번호가 의미를 갖지만, SpotFinder는 "이 작품이 어디서 찍혔나"를 탐색하는 곳이지 동선을 짜는 곳이 아니다. 촬영지 사이에 순서가 없으니, 번호를 붙이면 **없는 순서를 있다고 잘못 신호한다.** 그래서 번호 없는 점으로 두고, 클러스터 숫자는 "방문 순서"가 아니라 "개수"(여기 N곳)를 뜻하게 했다. 마커는 좌표를 찍는 장식이 아니라 정보를 표현하는 기호다.

### 다. 클러스터링을 처음부터 선반영한 이유 (YAGNI를 의도적으로 깸)

- **왜**: 보통 "필요해지면 그때 만들라(YAGNI)"를 따르는데, 클러스터링은 데이터가 적은 초기부터 깔았다.
- **목적**: 곧 확실히 닥칠 문제를, 사후 도입 비용이 커지기 전에 미리 막는다.
- **이유**:
  - 마커가 2~3개만 겹쳐도 "어느 점을 클릭할지" 모호해진다. 이 모호함은 데이터가 조금만 쌓여도 바로 온다 — 테스터가 촬영지를 등록하기 시작하면 금방이다.
  - 클러스터링은 나중에 얹으면 마커 렌더링·클릭 로직을 들어내고 다시 짜야 해서, 사후 도입 비용이 크다.
  - 즉 "곧 확실히 필요 + 나중에 넣으면 비쌈"이라, YAGNI를 알면서도 의도적으로 깨고 선반영했다. (0106·0107의 "단순하게 시작, 나중에 최적화"와 반대 방향 — 판단 기준은 같다. 비용이 어디서 더 드는가.)
  - 구현은 `react-kakao-maps-sdk`의 `MarkerClusterer`로 `MapMarker`들을 감싸고, `averageCenter`(클러스터 마커 위치를 묶인 마커들 평균으로)·`minLevel`·`minClusterSize={1}`(1곳짜리도 동그라미로 통일) 옵션을 줬다. clusterer는 별도 라이브러리라 `libraries`에 `'clusterer'`를 추가해야 한다(web_search로 사전 확인).

### 라. 검색창을 상세 패널에 통합한 이유 (위치 조정이 아니라 구조 변경)

- **왜**: 검색창과 마커 클릭 상세 패널이 둘 다 화면 왼쪽을 쓰면서 서로 겹쳤다.
- **목적**: 같은 가로 공간을 두고 다투지 않게 한다.
- **이유**: 처음엔 검색창 위치만 옮겨봤는데, 위치 조정으로는 "검색창이 떠 있는데 패널이 그 위를 덮는" 충돌이 반복됐다. 그래서 둘을 같은 컨테이너로 통합하고 위아래로 쌓았다 — 검색창은 항상 최상단에 고정, 상세는 마커 클릭 시 그 아래로 펼침. 위아래로 쌓으니 같은 가로 공간을 두고 다투지 않게 됐다. 증상(겹침)을 위치로 가리는 대신, 원인(같은 슬롯을 공유)을 구조로 바꿨다.

### 마. 비공개 기능을 만들지 않기로 한 이유 (데이터 무결성)

- **왜**: SpotFinder 조회 함수를 만들 때, Story에 isPublic 같은 공개/비공개 필드를 두지 않았다. "비공개 Story"라는 상태 자체를 만들지 않았다.
- **목적**: 공개가 기본인 영역(Story/촬영지)을 단순하게 유지하고, 비공개라는 복잡한 상태를 한 곳(My Plan)에만 가둔다.
- **이유**: 비공개 기능을 만들면 데이터 무결성을 깨는 부작용이 줄줄이 따라온다.
  - **삭제·비공개된 글의 데이터 처리**: Story를 비공개로 돌리면 거기 딸린 촬영지(Spot)가 SpotFinder 지도에서 사라져야 하나? 사라지면 지도가 들쭉날쭉하고, 안 사라지면 "비공개인데 데이터는 공개"인 모순이 생긴다.
  - **출처 붕괴**: 패널에 "출처: 작성자 닉네임"을 표시하는데, 그 사람이 글을 비공개/삭제하면 출처가 깨진다(없는 글을 가리키는 유령 출처).
  - **데이터 오염**: "공개된 적 있다가 지금 비공개"인 데이터가 지도에 섞이면, 작성자는 숨겼다고 믿는데 SpotFinder엔 남아 있다 — 사생활 침해이자 일관성 붕괴.
  - 그래서 비공개 기능을 만드는 대신 **민감 정보를 처음부터 분리**했다. Story는 항상 공개 전제 → 위 문제가 발생할 여지가 없다. 비용·일정 같은 민감 정보는 Story가 아니라 My Plan에 두고, isPublic은 My Plan에서만 관리한다.
  - 효과: SpotFinder(공개 지도)는 "여기 있는 건 다 공개"라는 단순한 전제로 동작한다. 복잡도를 한 군데(My Plan)로 몰아넣은 것이다.

### 바. 정보 표시를 말풍선이 아닌 사이드 패널로 한 이유

- **왜**: 마커를 클릭했을 때 정보를 어디에 보여줄지 — 지도 위 말풍선(infowindow)인가 패널인가.
- **이유**: 말풍선은 좁아서 촬영지명·작품·리뷰·출처·사진을 담기에 부족하다. web_search로 확인한 지도 UX 표준은 "데스크톱 = 사이드 패널, 모바일 = 하단 시트"였다(Material Design 명시). 이번엔 데스크톱 사이드 패널까지, 모바일 하단 시트는 별도(6단계)로 미뤘다.

---

## 3. 작성한 프롬프트 (핵심 발췌)

단계를 작게 쪼개 한 칸씩(0106·0107과 같은 방식). 각 단계는 "읽고 보고만"으로 기존 구조 확인 후 진행.

### 1단계 — 조회 함수 (데이터 공급원)

```
[목표 — 읽기 전용 조회 함수]
1. movie_id가 있는 Spot만 (촬영지 아닌 장소 제외)
2. 각 Spot에 함께: 좌표·이름·리뷰·작품(movie: id, title)·출처(작성자 닉네임)
3. 읽기 전용 (create/update/delete 없음)

[검수 모드 — 핵심 3개]
1. 필터: movie_id 있는 Spot만.
2. 포함 데이터: 좌표·작품·출처가 다 있는지.
3. N+1 없이 join으로 한 번에, 읽기 전용인지.
```

> 비공개 필터는 없음 — Story에 isPublic 필드가 없고, 비공개 기능을 안 만들기로 결정(마 항목). where는 `movieId: { not: null }`만.

### 3단계 — 클러스터링 (web_search 선확인 후)

```
[참조 — 확인된 사용법 (react-kakao-maps-sdk)]
- MarkerClusterer로 MapMarker들을 감싸면 클러스터링됨
- clusterer 라이브러리 로드 필요: libraries에 'clusterer' 추가
```

> 라이브러리 API는 추측 금지 — web_search로 "clusterer 별도 로드 필요"를 먼저 확인하고 진행.

### 4단계 — 칩 필터 + 자동 줌

```
[목표 — 작품 칩 필터 + 자동 줌]
1. 상단에 작품 칩 바: "전체" + 작품별(작품명 + 촬영지 수)
2. 칩 클릭 → 그 작품 촬영지만 표시 + 자동 줌
3. 자동 줌: 그 작품 촬영지들이 다 보이도록 지도 범위 이동
   (LatLngBounds 등 react-kakao-maps-sdk 방식 확인 후 적용)
```

> 자동 줌의 bounds 이동 API는 버전마다 다를 수 있어 CC가 plan에서 확인하게 함.

---

## 4. 코드 작성 & 수정

### 1단계 — 조회 함수 (신규 파일)

```ts
// lib/spot/queries.ts (신규)
import 'server-only';
import { prisma } from '@/lib/prisma';

export type SpotFinderSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  review: string | null;
  movie: { id: string; title: string };
  author: { nickname: string };
};

export async function fetchSpotFinderSpots(): Promise<SpotFinderSpot[]> {
  const spots = await prisma.spot.findMany({
    where: { movieId: { not: null } },   // 촬영지(작품 연결된 것)만
    select: {
      id: true, name: true, lat: true, lng: true, review: true,
      movie: { select: { id: true, title: true } },
      story: { select: { user: { select: { nickname: true } } } },
    },
  });
  return spots.map((s) => ({ ...s, movie: s.movie!, author: s.story.user }));
}
```

> `movie: s.movie!`의 non-null 단언 근거 — where에서 movieId not null로 걸렀으니 movie가 반드시 있다. 타입은 optional이지만 런타임은 보장.

### 2단계 — 지도 뼈대 (3파일 신규/교체)

```tsx
// app/(protected)/spot-finder/page.tsx (Server Component, ComingSoon 교체)
const spots = await fetchSpotFinderSpots();
// <SpotFinderMapWrapper spots={spots} />

// components/SpotFinderMapWrapper.tsx (신규) — dynamic import ssr:false
//   Kakao Map은 브라우저 전용(window 필요) → 서버 렌더링하면 터짐
const SpotFinderMap = dynamic(() => import('./SpotFinderMap'), { ssr: false });

// components/SpotFinderMap.tsx (신규 Client) — useKakaoLoader + Map + MapMarker
//   전체화면: -mx-6 -my-8 h-[calc(100vh-56px)] (main 패딩 상쇄)
```

> SpotMap(Story 동선용 557줄)은 재사용 안 함 — "한 글의 동선(번호+선)" vs "여러 글의 점(순서 없음)"이라 성격이 다르다(나 항목). 가져올 패턴(useKakaoLoader+Map+Marker)만 참고하고 신규 작성.

### 3단계 — 클러스터링

```tsx
// libraries=['services', 'clusterer']  ← clusterer 추가
<MarkerClusterer averageCenter minLevel={10} minClusterSize={1}>
  {visibleSpots.map((s) => <MapMarker key={s.id} position={{ lat: s.lat, lng: s.lng }} ... />)}
</MarkerClusterer>
```

> [버그] MapMarker의 `title` 속성이 클러스터러와 충돌(`Cannot set properties of null setting title`) → title 제거로 해결(제목은 5단계 패널로 대체).

### 4단계 — 칩 필터 + 자동 줌

```tsx
// 작품별 그룹핑 — JS 내장 Map과 지도 컴포넌트 Map 이름 충돌 방지로 reduce/Record 사용
const movieGroups = useMemo(() => { /* reduce로 movieId별 묶기 */ }, [spots]);
const visibleSpots = selectedMovieId ? spots.filter((s) => s.movie.id === selectedMovieId) : spots;

// 자동 줌: 선택 작품 촬영지를 다 감싸는 bounds로 이동
useEffect(() => {
  if (!mapInstance || !selectedMovieId) return;
  const bounds = new kakao.maps.LatLngBounds();
  visibleSpots.forEach((s) => bounds.extend(new kakao.maps.LatLng(s.lat, s.lng)));
  mapInstance.setBounds(bounds, 80, 40, 40, 40);
}, [selectedMovieId, mapInstance]);
```

> [검수에서 잡음] `new Map()`이 지도 컴포넌트 Map과 이름 충돌 → reduce/Record로 변경.

### 4.5단계 — 검색 + 화살표

```tsx
// 검색: 작품 칩을 이름 부분일치로 필터(클라)
const filteredMovieGroups = useMemo(() => {
  if (!searchQuery.trim()) return movieGroups;
  return movieGroups.filter((g) => g.title.toLowerCase().includes(searchQuery.toLowerCase()));
}, [movieGroups, searchQuery]);

// 화살표: 칩 바가 넘칠 때만 표시 (ResizeObserver + scrollWidth > clientWidth)
useEffect(() => {
  const el = chipBarRef.current; if (!el) return;
  const check = () => setShowArrows(el.scrollWidth > el.clientWidth);
  check();
  const observer = new ResizeObserver(check);
  observer.observe(el);
  return () => observer.disconnect();
}, [filteredMovieGroups]);
```

> 검색·칩 둘 다 "필터" 역할(가 항목). 화살표는 칩이 넘칠 때만 — 창을 좁혀 넘침을 재현해 동작 확인.

### 5단계 — 마커 클릭 사이드 패널 + 사진

```tsx
// 마커 클릭 → selectedSpot 설정 + panTo로 중앙 이동(끝 마커가 패널에 가려지는 문제 해결)
onClick={() => { setSelectedSpot(spot); mapInstance?.panTo(new kakao.maps.LatLng(spot.lat, spot.lng)); }}

// 패널 최상단 사진: photoUrl 있으면 <img>, 없으면 "No Image"
{selectedSpot.photoUrl
  ? <img src={selectedSpot.photoUrl} className="w-full h-full object-cover" />
  : <div className="bg-slate-100 ...">No Image</div>}
```

> 사진은 Spot.photoUrl(nullable) 확인 후 추가 — queries.ts select·타입에 photoUrl 더함. 외부 URL일 수 있어 next/image 아닌 `<img>`로(SpotPopup과 일관).

### 색 통일 — indigo → Story 계열

```
선택 칩: bg-indigo-600 → bg-[#1A1A1A]
검색창 focus: indigo-400 → slate-400
패널 작품 라벨: indigo-50/700/200 → slate-100/700/200
출처 아바타: indigo-100/700 → bg-[#1A1A1A] text-white
```

> CC에 "읽고 보고만"으로 Story 색 확인: 태그=slate, 강조/선택=#1A1A1A, rose=좋아요 전용, amber=날짜/비용. 그에 맞춰 SpotFinder의 indigo 전멸(grep으로 확인).

---

## 5. 결과 / 배운점

### 결과

- SpotFinder 데스크톱 화면 완성: 조회 함수 → 전체화면 지도 → 클러스터링 → 칩 필터+자동 줌 → 검색+화살표 → 마커 클릭 사이드 패널 → 사진 → 색 통일.
- 실제 동작 검증: 마커 4~5개(서울 3 + 제주)가 제 위치에 표시, 칩 클릭 시 해당 작품만+자동 줌, 검색 시 칩 필터, 창 좁히면 화살표 표시, 마커 클릭 시 패널+사진(허니문하우스 사진 확인), 색 통일 스샷 확인.
- 버그: MapMarker title이 클러스터러와 충돌(title 제거), `new Map()` 이름 충돌(reduce로 변경).

### 배운점

- **필터와 상세 조회를 분리한다.** 작품:촬영지가 1:N이라, 필터 입력만으로는 상세가 결정되지 않는다. 검색·칩은 범위를 좁히고, 무엇을 볼지는 사용자가 마커로 최종 선택한다. 시스템이 추측해서 상세를 띄우면 1:N에서 틀린다 — 추측을 사용자 선택으로 넘겼다.
- **마커는 화면의 목적을 드러내는 기호다.** 동선(순서 있음)은 번호, 탐색(순서 없음)은 번호 없는 점. 순서가 없는데 번호를 붙이면 없는 순서를 있다고 잘못 신호한다.
- **YAGNI는 원칙이지 맹신이 아니다.** "곧 확실히 필요 + 사후 도입이 비쌈"이면 의도적으로 깬다. 클러스터링이 그 경우였다 — 데이터가 조금만 쌓여도 마커 겹침이 오고, 나중에 얹으면 렌더링·클릭 로직을 다시 짜야 한다.
- **겹침은 위치가 아니라 구조로 푼다.** 검색창과 패널이 같은 슬롯을 다툴 때, 위치를 미세 조정하면 충돌이 반복된다. 같은 컨테이너로 통합해 위아래로 쌓으니 근본 해결됐다. 증상(겹침)이 아니라 원인(슬롯 공유)을 고친다.
- **기능을 안 만드는 것도 설계 결정이다.** 비공개 기능을 만들면 삭제·출처·오염 문제가 따라온다. 그래서 비공개를 만드는 대신 민감 정보를 처음부터 분리(My Plan)했다 — 복잡도를 한 곳에 가두고, 공개 영역은 단순한 전제로 동작하게. 데이터 무결성을 위해 "안 만든다"를 택했다.

### 다음

1. 0109 — 마이페이지 비밀번호 변경(updateUser current_password) + Story 예산 요약 여행플랜 링크(isPublic 노출 방지).
2. 리뷰 시스템 — 한 촬영지에 여러 명이 리뷰. Review 테이블 신설 필요(지금은 Spot.review 단일 필드). 별도 기능으로.
3. 6단계 모바일 — SpotFinder만이 아니라 앱 전체 레이아웃 점검이 필요(반응형). Expo 네이티브 포팅은 그다음.
4. 디자인 토큰화 — 색을 변수로 빼는 전체 작업. 이번엔 SpotFinder→Story 색 맞춤만 했고, 토큰화는 별도 사이클.
