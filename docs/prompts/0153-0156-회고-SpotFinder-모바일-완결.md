# 0153~0156 회고: SpotFinder 모바일 완결

- 날짜: 2026-07-03
- 소요: 약 2.5시간 (디버깅 3건 포함)
- 관련 커밋:
  - `fix: 0153 SpotFinder 지도 높이 모바일 탭바 반영` (12d0981)
  - `fix: 0154 SpotFinder 오버레이 두 줄 분리 및 화살표 노출 수정` (040eaa0)
  - `feat: 0155 모바일 기준선 문서화 및 SpotFinder svh 전환` (8f85fa4)
  - `fix: 0156 SpotFinder 지도 초기 fit 안정화` (425c056)

---

## 1. 한 줄 요약

하단 탭바 도입(0152)의 후속으로 SpotFinder 한 화면을 모바일에서 완결시켰다. 지도 높이 재계산 → 오버레이 두 줄 분리 → showArrows 2단 디버깅 → 모바일 기준선 수립과 svh 전환(Tailwind v4 문법 사건 포함) → 지도 초기 fit 안정화까지, 수정 4건과 디버깅 3건이 하나의 사슬로 이어졌다.

## 2. 왜 / 목적 / 이유

### 결정 1: 지도 높이 모바일/데스크톱 분리 (0153)

- **왜:** 0152에서 도입한 하단 탭바(h-14 + safe-area)가 기존 `calc(100vh-200px)` 계산에 없어, 모바일에서 지도 하단(스케일바, 안내 배너)이 탭바에 가려졌다.
- **목적:** 지도 하단이 탭바 위에서 정확히 끝나는 상태.
- **이유:** 차감값은 추측이 아니라 산정으로 정했다. 기존 200px의 구성(헤더 56 + pt 32 + SpotFinderHeader ~66 + pb 32 ≈ 186, 여유 반올림)을 코드 라인 근거로 역산하고, 모바일 증분(pb-24로 +64, safe-area)을 더해 260을 도출했다. Tailwind arbitrary value에는 `_`(underscore) 명시 표기로 calc의 공백 규칙을 파서 추측에 맡기지 않고 보장했다.

### 결정 2: 검색바/칩 두 줄 분리 + 오버레이 통합 (0154)

- **왜:** 검색바(w-72)와 필터 칩이 지도 위 같은 top-3 라인을 좌우로 나눠 쓰는 구조라, 중간 폭(600~760px)에서 칩이 검색바 뒤로 겹쳤다.
- **목적:** 어떤 화면 폭에서도 검색바와 칩이 겹치지 않는 상태. 실서비스 관례(카카오맵/구글맵/에어비앤비: 검색바 한 줄 + 칩 가로 스와이프 줄)와 동일한 두 줄 구성.
- **이유 (설계 판단):** 별도 오버레이 두 개로 분리하는 대신 하나의 wrapper로 통합했다. selectedSpot 상세 패널이 검색창 아래 flex-col로 흐르는 기존 구조에서, 칩 줄이 다른 wrapper에 있으면 상세 패널과의 새 겹침이 생기기 때문 — CC가 plan 단계에서 코드를 읽고 발견한 요구사항 밖의 제약이었다.
- **감수한 트레이드오프:** 데스크톱 칩 노출이 전폭 → 384px wrapper로 축소. 작품 수가 늘면 어차피 한 줄에 담을 수 없으므로, 화살표+스크롤은 데이터 증가를 가정한 확장성 있는 구조로 수용했다.
- **부속 결정:** 모바일 화살표 제거(`hidden md:flex`). 화살표는 마우스용 UI고, 터치에서는 스와이프가 관례이며 28px 버튼은 44px 터치 타겟 미달로 오탭 요인이다. 칩이 오른쪽 끝에서 잘리는 것은 버그가 아니라 스크롤 어포던스.

### 결정 3: 모바일 기준선 문서화 (0155)

- **왜:** 실기기(iPhone 14 Pro) 확인에서 에뮬레이터에 없던 문제들이 드러났다. 기기별로 하나씩 대응하면 기준 없는 임의 수치가 코드에 쌓인다는 문제의식.
- **목적:** 기기별 대응이 아니라 표준 기준선 하나에 전부 맞추는 상태. 신규 작업이 자동으로 기준을 참조하도록 CLAUDE.md에 문서화.
- **이유:** web_search로 국제 표준을 층위별로 확인했다 — WCAG(터치 타겟, 320px reflow, 글자 크기), CSS 명세(svh/dvh, safe-area), 플랫폼 규칙(iOS 입력 필드 16px 미만 시 자동 확대). 웹에서는 CSS px가 기기 밀도를 추상화하므로 "아이폰 따로 안드로이드 따로"가 거의 필요 없고, 표준 인터페이스를 쓰면 미래 기기 대응을 플랫폼이 흡수한다(safe-area가 노치 형태와 무관하게 동작하는 것처럼). 표준은 방어선이지 완주선은 아니므로 실기기 검증(360/390/768 + iOS/Android)을 기준선에 포함했다.

### 결정 4: 지도 높이 vh → svh 전환 (0155)

- **왜:** 모바일 브라우저의 100vh는 주소창이 숨겨진 최대 뷰포트 기준이다. 주소창 노출 중에는 실제 가시 영역보다 커서, `calc(100vh-260px)` 지도의 하단이 브라우저 UI에 가릴 수 있다 — 실기기 위화감의 원인 중 하나.
- **목적:** 주소창 노출 상태에서도 지도 하단이 항상 보이는 상태.
- **이유:** svh(주소창 노출 기준, CSS Values Level 4)를 기본으로, vh를 캐스케이드 폴백으로 뒀다. dvh는 스크롤 중 주소창 개폐마다 리레이아웃이 일어나 지도 relayout 연쇄를 부르므로 배제. 지원 범위(iOS 15.4+/Chrome 108+/Samsung Internet 21+)는 충분하고, 미지원 환경은 첫 번째 height 선언(vh)으로 동작한다.

### 결정 5: 지도 초기 fit 안정화 (0156)

- **왜:** 실기기에서 초기 화면이 서울 클러스터는 오버레이 바로 아래, 제주는 화면 밖. "읽고 보고만" 조사로 원인 2종 확증 — (A) setBounds가 onCreate 시점 뷰포트 크기로 1회 확정되고, 이후 ResizeObserver의 relayout은 center만 보존할 뿐 bounds 재적합이 없어 첫 fit이 어긋난 채 고정. (B) paddingTop 80이 두 줄 분리 후 오버레이 실높이(~88px)보다 작음.
- **목적:** 컨테이너 크기가 안정된 뒤의 뷰포트 기준으로 전체 스팟이 가시 영역에 들어오는 상태. 단, 사용자가 지도를 조작한 뒤에는 재적합으로 시점을 빼앗지 않을 것.
- **이유 (가드 설계):** 리사이즈마다 무조건 재적합하면 사용자가 보던 곳을 빼앗는 역효과가 난다. dragstart(사용자만 발화)로 조작을 감지하고, zoom_start는 프로그램적 setBounds도 발화시키므로 시간창(마지막 fit 후 500ms) 가드로 구분했다. 칩 클릭 effect에도 timestamp를 갱신해 오탐을 차단.
- **plan 검토에서 잡은 결함:** visibleSpots가 선택 상태에서 렌더마다 새 배열(`.filter()`)이라, deps에 그대로 넣으면 검색 타이핑 리렌더마다 effect 재구독 → ResizeObserver 초기 발화 → 키 입력마다 재적합이 반복된다. useMemo로 참조를 안정화한 뒤 deps에 넣는 것을 승인 조건으로 걸었다.

## 3. 작성한 프롬프트

### 0154 화살표 미노출 — 확증 후 수정 프롬프트 (일부)

```
[배경]
확증 완료: 칩 스크롤 컨테이너 실측 scrollWidth 553 / clientWidth 384
— overflow 실재하나 showArrows false 고착. (후략)

[목표]
1. showArrows 초기 판정 보강: document.fonts.ready.then(check) 추가 (A안)
   - unmount 후 setState 방지: cancelled 플래그 처리
2. 칩 줄에 Liquid Glass 스트립 배경 추가

[하지 말 것]
❌ ResizeObserver/scrollChips 로직 구조 변경 (트리거 추가만)
❌ (B)~(E) 대안 동시 적용 — A만
❌ git 커밋
```

### 0156 지도 fit — 사실 수집과 해석 분리 요청

```
읽고 보고만. 수정 금지. SpotFinderMap.tsx에서:
1. setBounds 호출 지점 전부와 각각의 패딩 인자
2. 초기 마운트 시 bounds 계산 흐름: 어떤 useEffect에서, 어떤 deps로
3. bounds에 담기는 대상
4. 상단 패딩 값이 현재 오버레이 실제 높이와 맞는지
가설 없이 사실만 보고.
```

- 폰트 스왑 사건에서 그럴듯한 첫 가설에 사이클을 소모한 직후라, 사실 수집과 해석을 의도적으로 분리했다. 원인 판정은 보고를 받아 사람이 수행.

## 4. 작성 및 수정한 코드

### 0153 → 0155: 지도 높이의 두 단계 진화

```tsx
// app/(protected)/spot-finder/page.tsx
// 0153 (탭바 반영, Tailwind arbitrary + underscore 공백 표기)
<div className="h-[calc(100vh_-_260px_-_env(safe-area-inset-bottom))] min-h-[440px] md:h-[calc(100vh-200px)]">

// 0155 (svh 전환, 커스텀 유틸리티로 이관)
<div className="h-spot-finder-map min-h-[440px]">
```

```css
/* app/globals.css — Tailwind v4는 @utility 디렉티브 (@layer utilities는 v3 문법) */
@utility h-spot-finder-map {
  height: calc(100vh - 260px - env(safe-area-inset-bottom));
  height: calc(100svh - 260px - env(safe-area-inset-bottom));
  @media (min-width: 768px) {
    height: calc(100vh - 200px);
    height: calc(100svh - 200px);
  }
}
```

- vh 폴백을 위해 같은 selector에 height를 두 번 선언해야 하는데, Tailwind arbitrary 클래스 두 개로는 동일 specificity 충돌로 폴백이 성립하지 않아 커스텀 유틸리티가 유일한 방법이었다.

### 0154: showArrows effect — 2단 수정의 최종형

```tsx
// components/SpotFinderMap.tsx
// 칩 바 넘침 감지 — 폰트 스왑 후 재측정 포함(Pretendard 로드 완료 시)
useEffect(() => {
  const el = chipBarRef.current;
  if (!el) return;
  let cancelled = false;
  const check = () => {
    if (cancelled) return;
    setShowArrows(el.scrollWidth > el.clientWidth);
  };
  check();
  const observer = new ResizeObserver(check);
  observer.observe(el);
  document.fonts?.ready?.then(check);
  return () => {
    cancelled = true;
    observer.disconnect();
  };
}, [filteredMovieGroups, loading]);  // ← loading이 진짜 수정. fonts.ready는 그 위에서만 유효
```

- 1차 수정(A안): `document.fonts?.ready?.then(check)` — 폰트 스왑 후 재측정.
- 2차 수정(F안): deps에 `loading` 추가 — 이것이 진짜 뿌리 수정. loading 중에는 `if (loading) return`으로 칩 바 DOM 자체가 없어 effect가 el=null에서 즉시 반환되고, loading 해제 리렌더에서 재실행할 트리거가 없어 showArrows가 false에 고착됐다. A안 코드는 그 반환문 뒤라 도달조차 못 했다.

### 0156: 사용자 조작 감지 가드

```tsx
// components/SpotFinderMap.tsx
const userInteractedRef = useRef(false);
const lastProgrammaticFitTsRef = useRef(0);

// 사용자 조작 감지 — dragstart / zoom_start(시간창 가드)
useEffect(() => {
  if (!mapInstance) return;
  const onDragStart = () => { userInteractedRef.current = true; };
  const onZoomStart = () => {
    if (Date.now() - lastProgrammaticFitTsRef.current < 500) return;
    userInteractedRef.current = true;
  };
  kakao.maps.event.addListener(mapInstance, 'dragstart', onDragStart);
  kakao.maps.event.addListener(mapInstance, 'zoom_start', onZoomStart);
  return () => {
    kakao.maps.event.removeListener(mapInstance, 'dragstart', onDragStart);
    kakao.maps.event.removeListener(mapInstance, 'zoom_start', onZoomStart);
  };
}, [mapInstance]);
```

### 0156: relayout effect 확장 — 조작 전 재적합 / 조작 후 center 보존

```tsx
// components/SpotFinderMap.tsx
const visibleSpots = useMemo(
  () => selectedMovieId
    ? spots.filter((s) => s.movie.id === selectedMovieId)
    : spots,
  [spots, selectedMovieId]
);  // deps 투입 전 참조 안정화 — 검색 타이핑 리렌더로 인한 재구독 방지

useEffect(() => {
  const el = mapWrapperRef.current;
  if (!el || !mapInstance) return;
  let frame = 0;
  const onResize = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const center = mapInstance.getCenter();
      mapInstance.relayout();
      if (!userInteractedRef.current && visibleSpots.length > 0) {
        const bounds = new kakao.maps.LatLngBounds();
        visibleSpots.forEach((s) => bounds.extend(new kakao.maps.LatLng(s.lat, s.lng)));
        lastProgrammaticFitTsRef.current = Date.now();
        mapInstance.setBounds(bounds, 110, 40, 40, 40);
      } else {
        mapInstance.setCenter(center);
      }
    });
  };
  const observer = new ResizeObserver(onResize);
  observer.observe(el);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
  };
}, [mapInstance, visibleSpots]);
```

- paddingTop 80 → 110: 오버레이 실측(top-3 12 + 검색 32 + gap 8 + 칩 스트립 36 = 88) + 시각 여유.

## 5. 결과 / 배운 점

- **결과:** 실기기(iPhone 14 Pro)에서 지도 하단이 탭바 위에서 종료, 주소창 노출 상태에서도 가림 없음, 초기 fit에 서울+제주 클러스터 모두 포함(페이지 스크롤 위치에 따라 일부가 첫 화면 밖일 수 있으나 fit 자체는 정확 — 페이지 구성 문제로 분리, 킵). 데스크톱 화살표 새로고침 직후 노출. 데스크톱 회귀 없음.

- **배운 점:**

  1. **값은 쟀는데 실행은 안 쟀다 — 상태의 실측과 경로의 실측은 다르다.** showArrows 사건에서 DOM 실측(553/384, overflow 실재)은 했지만, 그 값을 판정할 코드(check)가 실행되긴 하는지는 확인하지 않았다. 폰트 스왑 가설은 "check가 잘못된 시점에 실행됐다"는 서술인데, 이 문장은 check가 실행됐다는 미검증 전제 위에 서 있었다. console.log 한 줄이면 10초에 확인됐을 것. "왜 틀린 값이 나왔나"보다 "그 코드에 도달은 했나"가 선행 질문이다.

  2. **첫 수정이 안 먹히면 가설의 위가 아니라 아래를 판다.** A안(fonts.ready)을 넣고도 증상이 그대로일 때, 가설을 정교화하는 대신 가설의 전제(effect 도달)를 의심해서 진짜 뿌리(loading 조기 반환)에 닿았다. A안은 헛수고가 아니라 전제가 무너진 위에 서 있었던 것 — F가 전제를 복구하자 A는 제 역할(폰트 로드 후 재측정)을 했다. 두 수정은 대체가 아니라 직렬 관계였다.

  3. **검증 규칙의 존재 이유를 규칙 위반이 증명했다.** Tailwind v4 사건: 모바일 기준선을 문서화하는 바로 그 사이클에서, CC가 web_search 없이 v3 문법(@layer utilities)으로 유틸리티를 작성해 지도가 통째로 사라졌다. 진단(min-height 440만 잔존 → 부모 height auto → 자식 h-full 0 붕괴)은 실측으로 잡았고, 수정 전 web_search 확증을 강제하자 한 번에 풀렸다. "프레임워크 지침은 web_search 먼저"는 관성이 아니라 이런 사고의 재발 방지 장치다.

  4. **한 번 맞춘 fit은 영원하지 않다 — 그리고 자동 보정에는 사용자 조작 가드가 필요하다.** setBounds는 호출 시점의 뷰포트로 확정되는데, 모바일 초기화 구간은 크기가 출렁인다(svh 확정, 폰트 스왑, SDK mount). 크기 변화에 반응하는 재적합을 넣되, "사용자가 조작하기 전까지만"이라는 경계를 함께 설계해야 시점을 빼앗지 않는다. 프로그램적 줌과 사용자 줌을 구분할 수 없는 이벤트(zoom_start)는 시간창으로 갈랐다.

  5. **auto mode는 plan 검토를 형식으로 만든다.** v4 사건의 배경에는 plan 승인 전에 편집이 나간 auto mode가 있었다. plan의 가치는 편집 전 검토인데, 편집 후 사후 문서화가 되면 결함(문법 오류)이 코드에 먼저 도착한다.
