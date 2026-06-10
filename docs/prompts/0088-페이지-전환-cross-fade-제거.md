# 0088 회고: 페이지 전환 crossfade 제거 — 검색 전환에만 crossfade 적용

작성일: 2026-06-10
소요: 약 5시간
관련 커밋: 2ff82e9 (fix: 0088 페이지 이동 시 스크롤 점프 제거 — View Transitions를 검색 전환에만 한정)

## 1. 한 줄 요약
0086에서 페이지 이동에 적용한 crossfade가 스크롤 점프를 만들었다. 추적 끝에 crossfade는 "같은 자리, 다른 내용"일 때 맞는 전환이고 점프는 그 기능이 정직하게 작동한 결과임을 확인해, 페이지 전환 VT를 걷어내(즉시 전환) 점프를 없애고 검색 전환만 crossfade로 분리해 살렸다.

## 2. 왜 / 목적 / 이유

**왜 (동기/문제)**
0086에서 페이지 이동 전환에 `page-fade` crossfade를 적용했는데, 목록을 아래로 스크롤한 상태에서 카드를 클릭하면 화면이 맨 위로 올라가는 점프가 보였다. 이 움직임이 crossfade와 겹쳐 눈에 거슬렸다.

**목적 (도달할 상태 / 사용자 가치)**
페이지 이동 시의 스크롤 점프를 없앤다. 단, 검색 결과 전환의 부드러움(crossfade)은 그대로 지킨다.

**이유 (채택 근거 / 의사결정)**
추적 과정에서 핵심을 확인했다.

1. crossfade는 "같은 자리에서 내용만 바뀔 때" 쓰는 전환이다. 목록→상세는 스크롤 위치가 다른 "다른 자리"라, crossfade가 두 화면의 위치 차이를 보간하며 점프가 생긴다. 즉 점프는 버그가 아니라 crossfade가 정직하게 작동한 결과였다.
2. 점프를 줄이려고 넣은 `::view-transition-group{animation:none}`은 위치 보간을 꺼서, 부드러운 이동 대신 1프레임 순간이동(더 급한 튐)을 만들었다. 점프를 줄이려던 커스텀이 오히려 점프를 악화시켰다.
3. 점프를 완전히 없애려면 slide(가로 이동)나 offset 보정뿐인데, slide는 데스크탑 웹에 모바일 앱 같은 인상이라 맞지 않고, offset은 스크롤 거리를 직접 계산하는 타이밍 함정을 안는다. 클릭당 한 번 보는 전환에 그 비용은 과하다.

그래서 페이지 이동은 전환 애니메이션 없이 즉시 전환으로(겹침이 없으니 점프도 없다 — 웹 표준), 검색 결과 갱신은 "같은 자리, 다른 내용"이라 crossfade가 맞으므로 고유 이름(`list-fade`)으로 분리해 유지했다.

## 3. 작성한 프롬프트

```
[배경]
점프의 원인은 "다른 자리"인 목록↔상세를 crossfade로 겹친 것.
검색/필터는 "같은 자리, 다른 내용"이라 crossfade가 맞는 케이스.
그래서 페이지 전환은 즉시로 도려내고, 검색 crossfade는 살린다.

[목표]
1) 페이지 navigation 전환 = 즉시 전환:
   - app/layout.tsx의 페이지 전환용 <ViewTransition>(default="page-fade") 래퍼 제거.
   - globals.css의 page-fade 관련 블록 전부 제거.
2) 인페이지 검색 VT = crossfade 살림:
   - story/page.tsx 검색 VT의 default="none"을 풀고, 고유 이름(list-fade)으로
     crossfade를 다시 켠다.

[하지 말 것]
❌ 검색 VT를 default="none" 그대로 방치(그러면 검색도 애니 없이 툭 바뀜).
❌ slide·offset 등 대체 페이지 전환 추가.
❌ 검색 crossfade 거는 법을 추측으로 작성 — React 19.2 인페이지 VT 현재 방식을
   web_search로 확인 후 진행.
❌ 여러 페이지 동시 개편 — 변경은 layout.tsx + globals.css + story/page.tsx만.

[검수 모드]
구현 전 현재 VT 구조 읽고 보고. plan 요청.
```

## 4. 코드 작성 & 수정

```tsx
// app/layout.tsx — root 페이지 전환 VT 제거 (즉시 전환)
// 변경 전
import { ViewTransition } from 'react';
<body>
  <ViewTransition default="page-fade">{children}</ViewTransition>
</body>
// 변경 후 (import도 제거)
<body>
  {children}
</body>
```

```tsx
// app/story/layout.tsx — story 영역에 중복으로 걸려 있던 page-fade VT도 제거
// 변경 전: <ViewTransition default="page-fade">{children}</ViewTransition>
// 변경 후: {children}
```

```tsx
// app/story/page.tsx — 검색 결과 전환은 살리되 고유 이름으로
// 변경 전: <ViewTransition key={listKey} default="none">
// 변경 후: <ViewTransition key={listKey} default="list-fade">
```

```css
/* app/globals.css — page-fade(페이지 전환)를 제거하고 list-fade(검색 전환)만 남김 */
/* 변경 전 */
::view-transition-old(.page-fade),
::view-transition-new(.page-fade) { animation-duration: 0.8s; }
/* 변경 후 */
::view-transition-old(.list-fade),
::view-transition-new(.list-fade) { animation-duration: 0.4s; }
```

확인한 사실(web_search): React `<ViewTransition>`의 `default` prop은 view-transition-**name**이 아니라 view-transition-**class**라, CSS는 `::view-transition-old(.list-fade)`처럼 점(.)을 붙여 매칭해야 한다. 또한 Next.js의 `experimental.viewTransition`이 켜져 있으면 검색의 URL 파라미터(`?q=`) 변경도 자동으로 transition으로 래핑돼, root VT가 없어도 검색 crossfade는 독립으로 작동한다.

## 5. 결과 / 배운점
- 결과: 페이지 이동 시 점프가 사라졌고(즉시 전환), 검색 결과 변경 시에는 0.4s crossfade가 유지된다. 통증(점프)만 도려내고 멋(검색 전환)은 살렸다.
- 배운점 1 (도구의 본질): crossfade는 "같은 자리, 다른 내용"을 위한 전환이다. 검색 결과 갱신(같은 자리)엔 맞지만 페이지 이동(다른 자리)엔 어긋난다. 같은 도구라도 쓰는 자리가 맞아야 한다 — 0086에서 둘을 가르지 못한 것이 점프의 출발이었다.
- 배운점 2 (애니메이션 끔 ≠ 움직임 없음): `group{animation:none}`은 움직임을 없앤 게 아니라 보간을 꺼서 순간이동으로 만들었다. 움직임을 정말 없애려면 "겹침 자체가 없어야"(즉시 전환) 한다. 기본 crossfade가 대개 최선이고, 기본값을 과하게 커스텀한 것이 오히려 문제를 키웠다.
- 배운점 3 (점프는 정직한 작동): 점프는 못 잡은 버그가 아니라, crossfade가 두 화면의 위치 차이를 정직하게 드러낸 결과였다. View Transitions 스펙도 큰 영역의 스크롤 위치 차이는 개발자가 offset으로 직접 처리해야 한다고 명시한다 — 매체가 인정한 트레이드오프다.
- 배운점 4 (매체와 싸우지 말 것 / 비용 의식): 도구의 본질을 거스르는 응용은 비용만 키운다. 작은 점프 하나에 14페이지 전면 개편 같은 큰 구조 변경을 시도한 것은 과했다. 결국 가장 작은 변경(페이지 VT 제거)이 답이었다.
- 배운점 5 (의사결정의 호): 0086에서 부드러운 전환을 노리고 VT를 도입했고, 점프를 추적해 검증했고, 0088에서 페이지 전환을 철회했다. 점프를 없앤 것보다, 왜 그것이 거기 있었는지 이해하고 의도적으로 즉시 전환을 택한 과정 자체가 결과물이다.
