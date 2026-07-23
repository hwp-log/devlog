# 0317 회고: SpotMap Kakao → Naver 이식

**작성일**: 2026-07-23
**관련 커밋**:
- `0317` feat: 글쓰기 SpotMap 네이버 지도 이식 (512775b)

---

## 1. 한 줄 요약

글쓰기 화면의 폭을 넓혔더니 Kakao 지도가 컨테이너 변화를 인지하지 못해 타일이 절반만 그려졌다. 임시 보정 코드를 넣는 대신 백로그에 있던 Naver 교체를 앞당겨, 646줄짜리 지도 컴포넌트를 4단계로 쪼개 이식하고 **폭 미채움과 다크모드 미대응 두 문제를 한 커밋에서 닫았다.**

---

## 2. 왜 / 목적 / 이유

- **왜**: 0316에서 SpotMap 섹션을 1064px로 확장했는데, 지도 영역 왼쪽 절반에만 타일이 그려지고 오른쪽은 회색으로 남았다. 새로고침해도 지속. Kakao SDK는 초기화 시점의 컨테이너 크기로 타일을 그리고 CSS 폭 변경을 스스로 감지하지 않는데, 우리 코드에 `relayout()` 호출이 없었다.
- **목적**: 지도가 컨테이너를 항상 꽉 채우고, 다크모드에서 지도도 함께 어두워지는 것.
- **이유**: 두 가지 선택지가 있었다. ① Kakao에 `ResizeObserver + relayout()`을 붙이는 임시 보정 ② 백로그에 있던 Naver 교체를 앞당기기. **①은 곧 버릴 코드에 투자하는 것이고, 나중에 교체할 때 다시 걷어내야 한다.** 반면 ②는 폭 문제와 다크모드 문제(Kakao는 다크 스타일 미지원)를 동시에 닫고, SpotFinder에 이미 Naver 자산이 있어 **신규 개발이 아니라 이식**이다. ②를 택했다.

---

## 3. 판단 여정

### 규모 판정 — ★★★★가 아니라 ★★★

착수 전 CC에 조사를 맡겨 작업 면적을 확정했다. 가장 중요한 질문은 **"좌표가 어떤 형식으로 흐르는가"**였다. Kakao 좌표 객체가 state나 DB 저장 로직에 스며 있으면 데이터층까지 손대야 해서 위험도가 한 단계 올라가기 때문이다.

결과:

| 항목 | 조사 결과 |
|---|---|
| 좌표 형식 | 순수 `{lat: number, lng: number}` — Kakao 객체 누수 없음. 이벤트·검색 결과 경계에서 즉시 number로 변환됨 |
| SpotList·SpotPopup | Kakao 의존 0건 (prop만 받음) |
| SDK 사용 파일 | `SpotMap.tsx` 646줄 단 하나 |
| 소비처 | 2곳 — `StoryWriteForm`(편집), `story/[id]`(상세 readOnly). 같은 컴포넌트라 추가 작업 없음 |
| 별개 유지 | `lib/spot/autoTransit.ts`는 서버 사이드 Kakao Local REST — 지도 SDK와 무관, 유지 |

즉 **실작업 면이 1파일에 국한**되고 데이터층은 무접촉. ★★★ 구조 작업으로 판정했다.

### 4단계 분할 — 매 단계 렌더 가능 상태 유지

646줄을 한 번에 갈아엎으면 어디서 깨졌는지 알 수 없다. 그래서 각 단계가 **컴파일되고 화면이 뜨는 상태**를 유지하도록 쪼갰다.

1. **로더 + 지도 뼈대** — Kakao import 제거, Naver 로더·init/destroy·초기 fitBounds·relayout까지. 마커·검색은 미배선(지도만 뜸), 검색 핸들러는 error만 반환하는 일시 스텁.
2. **마커 + 폴리라인** — 번호 알약·병합 라벨·펄스·경로선.
3. **클릭 찍기 + 키워드 검색** — 지도 click 리스너, 서버 액션 신설.
4. **정리** — 패키지 제거, 잔재 grep.

**커밋은 4단계 전체 완료 후 하나로 묶었다.** 중간 단계는 검색이 스텁 상태라, 단계별로 커밋하면 "검색이 깨진 커밋"이 히스토리에 남는다.

### 선언형 → 명령형 전환

`react-kakao-maps-sdk`는 `<Map>`·`<Polyline>`·`<CustomOverlayMap>` 같은 React 컴포넌트로 지도를 다뤘지만, Naver는 명령형 SDK다. 전환의 핵심은 **수명주기 관리**였다.

- 테마 전환은 `setStyle` 호출이 통과만 하고 반영되지 않는 것이 SpotFinder에서 이미 실측돼 있어, **지도 파괴·재생성**이 유일한 경로였다. 대신 파괴 직전에 현재 뷰(center·zoom)를 ref에 캡처해 재생성 시 복원 → 다크 토글해도 보던 위치가 유지된다.
- 초기 전체 핏(`fitBounds`)은 `fitDoneRef`로 1회만 실행. 이 덕분에 테마 재생성 시 지도가 전체 핏으로 리셋되지 않는다.
- 리스너 해제는 **전부 핸들 기반**(`removeListener(handle)`). SpotFinder 코드에 "카카오식 `(target, type, fn)` 해제는 조용히 누수"라는 주석이 남아 있었고, 그 지뢰를 다시 밟지 않았다.

### 신규 작성이 필요했던 4건

| 항목 | 판단 |
|---|---|
| relayout | `ResizeObserver` + rAF + 크기 불변 가드 + `autoResize()` + center 보존. **0316 폭 버그의 직접 해결책** |
| 마커 | `CustomOverlayMap`(JSX 자식) → `Marker` + `icon.content` HTML 문자열. 시각 결과 동일 재현 |
| 지도 클릭 좌표 찍기 | 기존 코드에 Naver 패턴 없음 → 신규. `e.coord`에서 추출 |
| 키워드 장소 검색 | Naver JS SDK에 클라이언트 키워드 검색이 없음 → **아래 별도 판단** |

### 키워드 검색 — 렌더 엔진과 데이터 API의 분리

Kakao는 `kakao.maps.services.Places`로 클라이언트에서 장소 검색이 가능했지만 Naver JS SDK에는 상응 기능이 없다. 선택지는 두 개였다.

- **(ㄱ) 서버 액션으로 Kakao Local REST 유지** — `autoTransit.ts`가 이미 같은 API·같은 키를 서버에서 쓰고 있어 선례가 있다. 새 키·새 외부 의존 없음.
- (ㄴ) Naver 검색 API — 새 키 발급, 별도 쿼터, 좌표계 변환 확인 비용.

**(ㄱ)을 택했다.** 이번 작업의 목표는 "카카오 완전 탈출"이 아니라 "지도 렌더의 폭·다크 문제 해결"이다. 렌더 엔진(Naver)과 데이터 API(Kakao REST)를 분리하면 교체 범위가 최소화되고, 사용자에게는 서버 뒤라 보이지 않는다.

추가로 `x=lng / y=lat` 변환을 **서버에서 완료**해 클라이언트에는 순수 숫자만 내려보내게 했다. 좌표계 혼동은 이 프로젝트에서 반복적으로 주의를 요하는 지점이라, 변환 지점을 한 곳으로 모은 것.

### 검수 중 발견 — 서버 액션은 공개 엔드포인트다

새로 만든 `searchPlaces.ts`를 ★★★★★ 기준으로 줄 단위 검토하다 짚은 문제:

**서버 액션은 컴포넌트 안에 있어 보여도 빌드되면 고유 ID를 가진 공개 POST 경로가 된다.** 로그인 없이도 호출 가능하다. 이 액션은 인증 없이 외부 API를 호출하고 있었고, 반복 호출로 **Kakao 일일 쿼터를 소진**시킬 수 있었다.

- 프로젝트의 기존 인증 패턴 3종(리다이렉트형 / 값 반환형 / throw 가드형)을 조사해, 데이터를 반환하는 액션이므로 **값 반환형**을 채택.
- 검색어 길이 상한 50자 추가. 초과 시 `slice`가 아니라 **`zero`(결과 없음) 반환**을 택했다 — 잘린 쿼리로 왜곡된 결과를 사용자가 모른 채 받는 "조용한 어긋남"을 피하기 위해.
- **이 과정에서 `lib/spot/nearby.ts`도 인증 없이 prisma를 직접 조회하며 이미 배포 중임을 발견.** 이번 범위 밖이라 손대지 않고 백로그로 기록.

---

## 4. 코드 작성 & 수정

### 지도 생성 — 명령형 init/destroy

```tsx
// components/SpotMap.tsx
useEffect(() => {
  if (status !== 'ready' || !resolvedTheme || !mapDivRef.current) return;
  const supportsGl = !!document.createElement('canvas').getContext('webgl');
  const mapBackground = getComputedStyle(mapDivRef.current).getPropertyValue('--card').trim();
  const view = viewRef.current;
  const map = new naver.maps.Map(mapDivRef.current, {
    center: new naver.maps.LatLng(view?.lat ?? initialCtr.lat, view?.lng ?? initialCtr.lng),
    zoom: view?.zoom ?? ZOOM_DEFAULT,
    background: mapBackground,
    ...(supportsGl ? { gl: true, /* 다크/라이트 customStyleId 분기 */ } : {}),
  });
  const initListener = naver.maps.Event.once(map, 'init', () => setMapInstance(map));
  return () => {
    const c = map.getCenter();
    viewRef.current = { lat: c.lat(), lng: c.lng(), zoom: map.getZoom() };
    naver.maps.Event.removeListener(initListener); // 해제는 핸들 기반
    setMapInstance(null);
    map.destroy();
  };
}, [status, resolvedTheme]);
```

- 타일 로드 전 SDK 기본 밝은 배경이 다크에서 번쩍이는 것을 막기 위해 `--card` 실값을 배경으로 주입.
- GL 지도는 비동기 초기화라 `init` 이후에 인스턴스를 공개해야 bounds 계산이 맞는다.

### relayout — 0316 폭 버그의 해결 지점

```tsx
useEffect(() => {
  const el = mapDivRef.current;
  if (!el || !mapInstance) return;
  let frame = 0;
  const onResize = () => {
    const { width, height } = el.getBoundingClientRect();
    if (width === lastSizeRef.current.w && height === lastSizeRef.current.h) return; // 재-observe 즉발 콜백 무시
    lastSizeRef.current = { w: width, h: height };
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const center = mapInstance.getCenter();
      mapInstance.autoResize();
      mapInstance.setCenter(center); // 크기 변경 시 중심 보존
    });
  };
  const observer = new ResizeObserver(onResize);
  observer.observe(el);
  return () => { cancelAnimationFrame(frame); observer.disconnect(); };
}, [mapInstance]);
```

### 마커 — JSX에서 HTML 문자열로

React 자식이 아니라 문자열이므로 `onAnimationEnd` 같은 React 핸들러를 쓸 수 없다. 펄스 종료를 타이머로 대체하고, **키프레임 값과 타이머 값이 짝이라는 사실을 주석으로 명시**했다.

```tsx
function triggerPulse(spotId: string) {
  setPulsingIds(prev => new Set(prev).add(spotId));
  // globals.css @keyframes spot-pulse 0.6s와 페어 — HTML 문자열 마커라 onAnimationEnd 불가
  window.setTimeout(() => {
    setPulsingIds(prev => { const ns = new Set(prev); ns.delete(spotId); return ns; });
  }, 600);
}
```

마커 정리는 리스너 핸들과 마커를 쌍으로 묶어 반환:

```tsx
return () => {
  items.forEach(({ marker, clickListener }) => {
    naver.maps.Event.removeListener(clickListener); // 핸들 기반
    marker.setMap(null);
  });
};
```

### 키워드 검색 서버 액션

```ts
// lib/spot/searchPlaces.ts
'use server';

const MAX_KEYWORD_LEN = 50; // 실존 장소명은 50자를 넘지 않음. 초과 = 비정상 입력이라
                            // zero("결과 없음")가 사실에 부합. slice는 잘린 쿼리 결과를
                            // 사용자가 모른 채 받게 되므로 기각

export async function searchPlaces(keyword: string): Promise<SearchPlacesResult> {
  const kw = keyword.trim();
  if (!kw || kw.length > MAX_KEYWORD_LEN) return { status: 'zero' };

  // 공개 엔드포인트 노출 방어 — 미인증 호출로 외부 API 쿼터 소진 방지
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error' };

  const key = process.env.KAKAO_REST_API_KEY; // 서버 전용 — 클라 번들 유출 없음
  // ... fetch(KakaoAK 헤더, AbortSignal.timeout) → x=lng/y=lat 서버에서 변환
}
```

키를 헤더로만 보내 URL에 넣지 않았고(에러 로그에 키가 섞이지 않음), 모든 실패를 `error`로 수렴시켜 예외를 던지지 않는다(서버 액션이 던지면 클라이언트에 스택이 노출되거나 500이 뜬다).

---

## 5. 결과 / 배운점

### 결과

- 지도가 1064px 컨테이너를 꽉 채움 — **0316 폭 버그 해결.**
- 다크모드에서 지도도 함께 어두워짐 — 인수인계서에 "다크모드 과도기(Kakao 한계)"로 기록돼 있던 항목 종료.
- `react-kakao-maps-sdk` 의존성 제거. 잔재 grep 0건(import·네임스페이스 타입·JS 키 참조).
- 테스트 실패 목록이 baseline과 정확히 동일 — 회귀 없음.
- 실사용 체감상 조작이 더 부드러워짐(SpotFinder와 지도 스택 통일).

### 배운점

- **임시 보정과 예정된 교체가 겹치면, 교체를 앞당기는 게 총량이 적다.** relayout 땜빵은 작았지만 곧 버릴 코드였고, 교체 시 다시 걷어내야 했다. "언젠가 할 일"이 "지금 문제"와 만나면 순서를 바꿀 근거가 된다.
- **규모 판정의 핵심 질문은 "데이터가 어디까지 오염됐나"다.** 좌표가 순수 `{lat,lng}`였기에 이식이 렌더 층에서 끝났다. 만약 Kakao 객체가 state에 살고 있었다면 같은 작업이 훨씬 위험했을 것이다. 처음부터 경계에서 변환하는 습관이 여기서 배당을 줬다.
- **큰 교체는 "매 단계 렌더 가능"을 기준으로 쪼갠다.** 646줄을 한 번에 바꾸면 실패 시 원인 후보가 646줄이다. 4단계로 나누니 각 멈춤 지점이 곧 검증 지점이 됐다.
- **있는 걸 다 가져오지 않는다.** SpotFinder에 클러스터러가 있었지만 SpotMap은 근접 병합이 이미 같은 역할을 해서 이식하지 않았다. 이식은 복사가 아니라 선별이다.
- **서버 액션은 컴포넌트 안에 있어도 공개 엔드포인트다.** 이 인식이 없으면 인증 없는 데이터 조회가 조용히 배포된다. 실제로 `nearby.ts`가 그 상태로 이미 돌고 있었다.
- **입력 상한은 자르지 말고 거절한다.** `slice`는 사용자가 모르는 채 왜곡된 결과를 받게 만든다. "결과 없음"이 사실에 부합한다.
- **매직 넘버가 짝을 이룰 때는 주석으로 묶는다.** 펄스 타이머 600ms와 키프레임 0.6s처럼, 한쪽만 바꾸면 조용히 어긋나는 값들.

---

## 결정 (Decisions)

- **Naver 교체를 백로그에서 앞당김** — 임시 relayout 보정은 곧 버릴 코드라 기각.
- **4단계 분할 + 단일 커밋** — 각 단계는 렌더 가능 상태 유지, 중간 스텁 상태는 히스토리에 남기지 않음.
- **테마 전환 = 지도 파괴·재생성** — `setStyle` 미반영이 실측으로 확인된 상태. 뷰는 ref로 보존.
- **키워드 검색은 Kakao Local REST 유지(서버 액션)** — "카카오 완전 탈출"이 목표가 아니므로 렌더 엔진만 교체. `autoTransit.ts` 선례 계승.
- **좌표 변환은 서버에서 완료** — 클라이언트에는 순수 숫자만.
- **리스너 해제는 전부 핸들 기반** — `(target, type, fn)` 방식은 조용히 누수(SpotFinder 실측 주석 근거).
- **서버 액션에 세션 확인 + 검색어 50자 상한** — 미인증 사유는 노출하지 않고 `error`로 수렴.
- **SpotFinder의 테마 페이드 오버레이는 미이식** — 화면 일부인 글쓰기 지도에는 과함. 재생성 깜빡임 용인.
- **`nearby.ts` 무인증 노출은 별도 작업으로** — 이번 범위 밖. 전체 서버 액션 인증 감사로 백로그 등록.
