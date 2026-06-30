# 0131~0132 회고: SpotFinder 지도 카드 페이드 + 국내 한정 안내 배너

작성일: 2026-06-30 / 소요: 약 1시간 / 관련 커밋: feat: 0131 SpotFinder 지도 카드 등장 페이드 효과 (헤더와 통일), feat: 0132 SpotFinder 지도 국내 한정 안내 배너 추가

## 1. 한 줄 요약

지도 카드에 헤더와 통일된 등장 페이드(appear-up)를 헤더 다음 순서로 넣고, 카카오맵이 국외 지역까지 보여주는 것에 대응해 "촬영지 정보는 국내만 제공됩니다" 안내 배너를 우하단에 추가했다.

## 2. 왜 / 목적 / 이유

### 왜 (동기 / 문제)
0130 헤더 추가 후, 헤더(라벨·헤드라인)만 등장 애니메이션(appear-up)이 적용되고 지도 카드는 즉시 나타나 등장 흐름이 끊겨 보였다. 또한 카카오맵은 한국 외 지역(중국·일본 등)도 함께 보여주지만, Dotrip은 국내 촬영지만 제공하므로 사용자에게 그 범위가 드러나지 않았다.

### 목적 (도달할 상태 / 사용자 가치)
헤더에서 지도까지 등장이 한 흐름으로 이어진다. 사용자가 지도에서 국외 지역을 보더라도 서비스 범위가 국내임을 인지할 수 있다.

### 이유 (채택 근거 / 의사 결정)
페이드는 새 애니메이션을 만들지 않고 헤더가 이미 쓰는 appear-up을 재사용했다. 라벨(0s) → 헤드라인(0.12s)에 이어 카드(0.24s)로 0.12s 간격을 유지해 순차 등장을 통일했다. appear-up은 translateY(10px → 0)만 사용하므로 컨테이너 크기가 바뀌지 않아 카카오맵 relayout이나 마커 좌표에 영향을 주지 않는 점을 확인하고 적용했다.

배너는 정보 표시용이라 클릭 동작이 없으므로 pointer-events-none으로 지도 드래그를 통과시켰다. 위치는 우하단(bottom-6)으로 두어 카카오 © 저작권 표기(좌하단~하단)와 겹치지 않게 했다. 외형은 기존 오버레이(검색창·칩)와 같은 rounded-xl·border·shadow-sm 톤으로 통일했다.

## 3. 작성한 프롬프트

(0131 페이드)
```
[배경]
SpotFinder 지도 카드에 등장 페이드를 넣고 싶다. 헤더가 이미 appear-up을 쓰므로
통일성을 위해 지도 카드도 같은 패턴으로 헤더 다음 순서에 등장하게 한다.
[목표] plan으로 제안:
1. globals.css의 appear-up 정의 확인(효과·duration)
2. 지도 카드에 appear-up 적용, 헤더 다음 순서로 animationDelay(0.24s)
3. 지도 렌더 영향 점검 — appear-up이 relayout·마커·오버레이에 영향 주는지
[하지 말 것]
❌ 카드 효과·relayout·반응형·헤더 건드리지 말 것
❌ 새 애니메이션 만들지 말 것 — 기존 appear-up 재사용
plan 요청.
```

(0132 배너)
```
[배경]
지도에 "촬영지 정보는 국내만 제공됩니다" 안내 배너를 우하단에 넣고 싶다.
[목표] plan으로 제안:
1. SpotFinderMap.tsx 우하단에 배너 추가 (반투명 흰 배경 + Info 아이콘 + 텍스트)
2. 우하단 카카오 기본 요소(저작권 등)와 겹치지 않게 위치 조정
3. 정보 표시용 — pointer-events 처리로 지도 드래그 방해 방지
[하지 말 것]
❌ 카드 효과·relayout·반응형·헤더·페이드 건드리지 말 것
❌ 색·스타일은 기존 오버레이(검색창·칩)와 통일
plan 요청.
```

## 4. 코드 작성 & 수정

(1) 0131 — app/(protected)/spot-finder/page.tsx 카드 div에 appear-up + delay

```tsx
<div
  className="relative h-full rounded-2xl overflow-hidden bg-white
             shadow-[0_30px_80px_rgba(0,0,0,0.22),0_10px_24px_rgba(0,0,0,0.14)] appear-up"
  style={{ animationDelay: '0.24s' }}
>
```

순차 등장: SpotFinder 라벨(0s) → 헤드라인(0.12s) → 지도 카드(0.24s)

appear-up 정의 (app/globals.css):

```css
@keyframes planCardEnter {
  from { transform: translateY(10px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
.appear-up {
  animation: planCardEnter 0.8s ease-out both;
}
```

- translateY(10px → 0) + opacity(0 → 1), 0.8s ease-out both
- translateY만 사용해 컨테이너 크기 변화가 없으므로 relayout·마커에 영향 없음
- both: 시작 전 opacity 0 유지, 끝난 후 최종 상태 고정

(2) 0132 — components/SpotFinderMap.tsx 우하단 안내 배너

```tsx
import { X, ChevronLeft, ChevronRight, Info } from 'lucide-react';

{/* 우하단 안내 배너 — 정보 표시용 (지도 드래그 방해 X) */}
<div className="absolute bottom-6 right-3 z-[1000] pointer-events-none flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-3 py-1.5 shadow-sm">
  <Info size={12} className="text-slate-500 shrink-0" />
  <span className="text-xs text-slate-600">촬영지 정보는 국내만 제공됩니다</span>
</div>
```

- 위치: bottom-6 right-3 z-[1000] — bottom-6(24px)으로 카카오 © 저작권 위에 배치
- pointer-events-none: 지도 드래그·휠 줌이 배너 영역을 통과
- 외형: rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm — 기존 검색창·칩 오버레이와 통일
- Info 아이콘 size 12, text-xs로 부가 정보임을 시각적으로 표현

## 5. 결과 / 배운점

- 헤더에서 지도 카드까지 0.12s 간격으로 순차 등장해 한 흐름으로 이어진다. 기존 appear-up을 재사용해 다른 페이지와 애니메이션이 통일됐다.
- 애니메이션이 컨테이너 크기를 바꾸지 않는(translateY) 효과임을 먼저 확인하고 적용해, 지도 relayout·마커에 영향을 주지 않았다. 지도 위에 효과를 얹을 때는 크기 변화 여부를 먼저 점검해야 한다.
- 배너는 pointer-events-none으로 정보 표시와 지도 조작을 분리했다. 지도 위 오버레이는 클릭이 필요한지에 따라 pointer-events를 구분하는 것이 안전하다.
- 카카오 저작권 표기 위치(우하단)를 피해 배너를 배치했다. 벤더가 자동 렌더하는 요소와 겹치지 않게 위치를 잡는 것이 필요하다.
