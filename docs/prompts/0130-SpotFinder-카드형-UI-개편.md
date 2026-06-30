# 0130 회고: SpotFinder 카드형 UI 개편

작성일: 2026-06-30 / 소요: 약 5시간 / 관련 커밋: feat: 0130 SpotFinder 카드형 UI 개편 (반응형 지도·relayout·헤더 멘트)

## 1. 한 줄 요약

풀블리드로 공통 박스를 벗어나 있던 SpotFinder 지도를 다른 페이지와 동일한 박스 안 카드형 UI로 재설계하고, 카카오맵이 컨테이너 크기 변경을 자동 감지하지 못하는 문제를 ResizeObserver + relayout으로 해결했다.

## 2. 왜 / 목적 / 이유

### 왜 (동기 / 문제)
지도 가장자리에 빈 영역(흰색)이 보였다. 색 오버라이드, 카카오 내부 타일 배경 교체, relayout 단발 호출 등 여러 방법으로 잡으려 했으나, 큰 빈 영역은 컨테이너 크기 변경 시 relayout 미호출이 원인이었고, 픽셀 단위 가장자리는 react-kakao-maps-sdk가 컨테이너를 완전히 채우지 못하는 한계로 확인했다. 동시에 SpotFinder만 음수 마진(`-mx-6 -my-8`)으로 공통 박스를 벗어나 있어 다른 페이지와 레이아웃이 달랐다.

### 목적 (도달할 상태 / 사용자 가치)
다른 protected 페이지(Story, PlanFinder)와 통일된 박스 안 카드형 지도를 제공한다. 화면 크기가 바뀌어도 지도가 컨테이너를 따라 다시 그려져 큰 빈 영역이 생기지 않는다.

### 이유 (채택 근거 / 의사 결정)
픽셀 단위 가장자리를 완벽히 제거하는 데 드는 시간 대비, 사용자가 인지하기 어려운 그 디테일에서 얻는 가치는 작았다. 그 시간을 지도를 카드형으로 재설계해 페이지 완성도와 통일성을 확보하는 데 쓰는 편이 가치가 크다고 판단해, 빈 영역을 "덮는" 접근에서 "지도를 박스 안 카드로 재설계하고 relayout으로 채우는" 접근으로 전환했다. 미세한 가장자리는 카드 디자인으로 자연스럽게 처리하고, 완벽한 제거는 포기했다.

높이는 `vh` 기반 반응형으로 작성하되, 컨테이너 크기 변경에 ResizeObserver + relayout으로 대응해 빈 영역을 막았다. relayout 단발 호출이 아닌 ResizeObserver를 채택한 이유는, 향후 레이아웃 변경(헤더 추가 등)으로 컨테이너 크기가 또 바뀌어도 자동으로 대응하기 위함이다.

## 3. 작성한 프롬프트

(박스 안 정렬 + 카드화)
```
[배경]
SpotFinder가 음수 마진으로 공통 박스를 벗어나 다른 페이지와 레이아웃이 다르다.
다른 페이지처럼 박스 안에 통일되게, 지도를 카드형으로 넣고 싶다.
[목표] plan으로 제안:
1. page.tsx wrapper의 음수 마진 제거 → 공통 max-w-7xl 박스 안에 안착
2. 카드화: rounded-2xl + overflow-hidden + bg-white + 그림자 + 커브드 inset
3. 높이는 반응형(vh 기반), 컨테이너 변경 시 relayout
[하지 말 것]
❌ 공통 layout·다른 페이지 건드리지 말 것
❌ 추측 금지 — 다른 페이지 카드 스타일·높이 계산 확인 후
plan 요청.
```

(relayout)
```
[배경]
박스 안에 넣으면 컨테이너 폭이 바뀌는데 카카오가 따라가지 못해 빈 영역이 생긴다.
카카오맵은 생성 시 컨테이너 크기를 고정하고, SDK는 크기 변경을 자동 감지하지 않는다.
[목표] plan으로 제안:
1. 컨테이너에 ResizeObserver를 달아 크기 변경 시 relayout 호출
2. relayout 후 중심이 틀어지므로 getCenter → relayout → setCenter로 보존
[하지 말 것]
❌ 카드 효과·반응형·레이아웃 건드리지 말 것
plan 요청.
```

## 4. 코드 작성 & 수정

(1) app/(protected)/spot-finder/page.tsx — 음수 마진 제거 + 카드화

```tsx
// before
<div className="-mx-6 -my-8 h-[calc(100vh-56px)]">
  <SpotFinderMapWrapper spots={spots} />
</div>

// after
<div>
  <SpotFinderHeader />
  <div className="h-[calc(100vh-200px)] min-h-[440px]">
    <div className="relative h-full rounded-2xl overflow-hidden bg-white
                    shadow-[0_30px_80px_rgba(0,0,0,0.22),0_10px_24px_rgba(0,0,0,0.14)]">
      <SpotFinderMapWrapper spots={spots} />
      {/* 커브드 inset 오버레이 — 위 하이라이트 / 아래 음영 / 테두리 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl
                   shadow-[inset_0_4px_8px_rgba(255,255,255,0.6),inset_0_-14px_28px_rgba(0,0,0,0.16),inset_0_0_0_1px_rgba(0,0,0,0.05)]"
      />
    </div>
  </div>
</div>
```

- 음수 마진 제거 → 공통 main(max-w-7xl px-6 py-8) 박스 안에 안착, 다른 페이지와 통일
- 높이 calc(100vh-200px): header 56px + main py-8 64px + 헤더 블록 약 80px 합산
- min-h-[440px]: 작은 화면에서 카드가 잘리거나 스크롤 생기는 것 방지
- 커브드 inset 오버레이: pointer-events-none으로 지도 드래그 통과, 위 하이라이트 + 아래 음영으로 곡면(볼록) 착시

(2) app/(protected)/spot-finder/_components/SpotFinderHeader.tsx — 헤더 + 랜덤 멘트

```tsx
'use client';
import { useEffect, useState } from 'react';

const HEADLINES = [
  '어디서 촬영했을까요?',
  '지도에서 촬영지를 찾아보세요',
  '그 장면, 어디서 찍었을까요?',
];

export function SpotFinderHeader() {
  const [headline, setHeadline] = useState('');

  useEffect(() => {
    setHeadline(HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
  }, []);

  return (
    <div className="mb-6">
      <p className="text-xs font-semibold text-sky-500 mb-1 appear-up"
         style={{ animationDelay: '0s' }}>
        SpotFinder
      </p>
      <h1 className="text-2xl md:text-3xl font-bold text-[#1A1A1A] appear-up"
          style={{ animationDelay: '0.12s' }}>
        {headline}
      </h1>
    </div>
  );
}
```

- 'use client' + useState('') 빈 초기값 → useEffect에서 랜덤 선택. 서버에서 랜덤하면 SSR/CSR 결과가 달라 hydration 불일치가 나므로, 클라이언트 마운트 후에만 결정해 회피
- Story, PlanFinder와 동일한 패턴(배열명·랜덤식·className·appear-up 딜레이)으로 통일

(3) components/SpotFinderMap.tsx — ResizeObserver + relayout

```tsx
const mapWrapperRef = useRef<HTMLDivElement>(null);

// 컨테이너 크기 변경 시 지도 relayout — center 보존
useEffect(() => {
  const el = mapWrapperRef.current;
  if (!el || !mapInstance) return;
  let frame = 0;
  const relayout = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const center = mapInstance.getCenter();
      mapInstance.relayout();
      mapInstance.setCenter(center);
    });
  };
  const observer = new ResizeObserver(relayout);
  observer.observe(el);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
  };
}, [mapInstance]);

// 지도 컨테이너에 ref 부착
<div ref={mapWrapperRef} className="relative w-full h-full">
```

- 카카오맵은 생성 시점 컨테이너 크기로 좌표·픽셀을 고정한다. 크기가 바뀌면 relayout()을 호출해야 다시 그린다. SDK는 이 변경을 자동 감지하지 않으므로(window resize만 카카오 native가 자동 처리) 직접 ResizeObserver로 감지
- requestAnimationFrame으로 throttle: 리사이즈가 연속 발생할 때 이전 프레임을 cancelAnimationFrame으로 취소하고 마지막 한 번만 실행
- getCenter → relayout → setCenter 순서로 중심 좌표 보존(relayout 시 중심이 밀리는 것 방지)
- cleanup에서 cancelAnimationFrame + observer.disconnect() 둘 다 호출해 누수 방지

## 5. 결과 / 배운점

- 다른 페이지와 통일된 박스 안 카드형 지도를 완성했다. 화면 크기 변경 시 ResizeObserver가 relayout을 호출해 큰 빈 영역이 생기지 않는다.
- 증상과 원인을 분리해 접근한 것이 핵심이었다. "흰색"이라는 증상을 색으로 덮으려 한 시도는 모두 실패했고, 큰 빈 영역의 원인은 "컨테이너 크기 변경 후 relayout 미호출"이었다. 원인을 잡으니 색을 덮지 않아도 해결됐다.
- 픽셀 단위 가장자리는 SDK 한계로 완벽히 제거되지 않았다. 이를 무한정 추구하는 대신, 기회비용을 따져 카드 디자인으로 우회하고 전체 완성도·통일성에 시간을 투자하는 의사결정을 했다.
- 카카오맵은 컨테이너 크기 변경을 자동 감지하지 않는다(window resize만 자동). 프로그래밍 방식으로 컨테이너 크기를 바꿀 때는 수동 relayout이 필요하다. ResizeObserver로 감지하면 향후 레이아웃 변경에도 자동 대응한다.
