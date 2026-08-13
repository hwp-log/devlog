# 0224-0227 회고: 모바일 SpotFinder 레이아웃

작성일: 2026-08-10
소요 시간: 약 4시간
관련 커밋: fe3e014(0224) · e7a408e(0225) · 93da9dd(0226) · 9cd4818(0227)

---

## 1. 한 줄 요약

데스크탑 3열만 있던 SpotFinder에 모바일 레이아웃을 만들면서, 업계 표준을 먼저 검증하고 전역 반응형 기준선까지 옮겼다.

---

## 2. 왜 / 목적 / 근거

### 왜 (동기·문제)

실기기에서 열어보니 데스크탑 3열이 좁은 화면에 그대로 욱여넣어져 있었다. 상세 패널 전체(사진·리뷰·별점·작품·교통)가 지도 위에 세로로 쏟아져 지도를 덮었다. 하단 탭바만 있고 그 외에는 모바일 대응이 없었다.

그리고 멘토가 "요새는 모바일도 본다"고 했다. 확인해보니 반응형은 프론트엔드 신입 자격 요건에 명시돼 있고, **있으면 가점이 아니라 없으면 감점**에 가까웠다.

### 목적 (도달 상태)

- 모바일에서 지도가 풀스크린 배경이 되고, 그 위에 칩·카드가 떠 있다
- 데스크탑 3열은 그대로다. 완성된 화면을 건드리지 않는다
- 노치·홈바를 피한다. 아이폰뿐 아니라 안드로이드도

### 근거 (결정 기준)

**표준을 먼저 검증했다.** 이 작업 직전에 CLAUDE.md에 "제품 UX 표준" 원칙을 넣었다. 큰 틀은 자의적으로 설계하지 않고 업계 표준을 따르며, plan 전에 `web_search`로 확인한다는 것이다. 그 원칙이 처음 적용된 작업이 이거다.

검색 결과 **"지도 풀스크린 + 필터 칩 + 하단 선택 장소 카드 + 탭바"가 지도 앱의 표준**이었다. 구글 맵의 논모달 바텀시트가 대표 사례고, 최소화 상태에서 논모달로 시작해 확장하면 풀스크린 모달이 되는 것도 정석이었다.

**안티패턴도 표준이었다.** 검색이 반복해서 경고한 게 드래그·스냅 3단계 바텀시트였다. 오터치를 유발하고, 핀터레스트·트위터도 복잡한 시트에서 페이지 내비게이션으로 회귀했다는 것이다. **그래서 고정 카드 + 명시적 [상세] 버튼으로 갔다.**

**모바일 클릭 이동은 데스크탑과 갈랐다.** 0223에서 만든 거리 기반 줌 확대를 모바일에도 적용하면 문제가 생긴다.

```
z16까지 확대  →  옆 스팟이 화면 밖으로 나감
             →  근데 카드 ‹ › 로 옆 스팟 넘기는 게 모바일의 주 동선
             →  넘겼더니 지도엔 아무것도 안 보임
```

검색해보니 Airbnb 방식이 이 문제의 답이었다. **선택 시 크게 줌인하지 않고, 이동 중에도 맥락을 유지한다.** 그래서 모바일은 중심만 pan하고 줌은 유지하게 했다.

**갈린 이유가 화면 구성에 있다.** 데스크탑은 좌측 목록이 항상 보여서 확대해도 옆 스팟을 목록에서 찾을 수 있다. 모바일은 목록이 없고 카드 `‹ ›`가 유일한 네비라, 확대하면 그 네비가 무의미해진다. 자의적 분기가 아니라 구조에서 나온 판단이다.

**전역 반응형 기준선을 md에서 lg로 옮겼다.** 이건 SpotFinder만의 문제가 아니었다.

```
탭바      md(768px) 기준으로 갈림
요청      SpotFinder 모바일을 lg(1024px) 미만으로
결과      768~1024 구간에서 탭바는 사라지는데 SpotFinder는 모바일 → 어긋남
```

근거는 실측이었다. **md(768)에서 3열은 지도 폭이 ~98px밖에 안 나온다.** 태블릿에서 3열은 이미 못 쓰는 화면이었다. 그러니 lg로 옮기는 게 SpotFinder뿐 아니라 전체적으로 옳았다.

Story·PlanFinder는 그 구간에서 이미 1열 카드 그리드라 영향이 없다는 것도 확인하고 갔다.

**상세는 라우트가 아니라 쿼리로 열었다.** `?detail=id`를 쓰면 지도가 언마운트되지 않고, 뒤로가기가 자동으로 닫아준다. 별도 라우트로 빼면 돌아올 때 지도를 다시 그려야 한다.

---

## 3. 작성한 프롬프트

### 0224 — 표준 검증을 전제로 깐 조사

```
[읽고 보고만] 모바일 SpotFinder 현재 상태 조사. 코드 수정 금지.

[목적]
SpotFinder를 모바일 레이아웃으로 만들려 한다.
목표는 로컬 시안(Dotrip_Mobile_Final.html)의 SpotFinder 화면이다.
  지도 풀스크린 + 상단 칩 필터 + 하단 바텀시트(선택 스팟 카드) + 하단 탭바

[확인할 것 — 코드 원문 인용]
1. SpotFinder의 현재 레이아웃 구조. 반응형 분기가 있는가, 데스크탑 고정인가.
2. 모바일에서 지금 이 화면이 어떻게 보이는가. 3열이 좁은 화면에서 어떻게 깨지는가.
3. 이미 있는 모바일 기반은 무엇인가. 하단 탭바·svh 기준선이 어디에 정의돼 있는가.
   다른 페이지(Story 등)는 모바일 대응이 돼 있는가 — 참조 패턴이 되는가.
4. 우측 상세 패널(SpotDetailContent)이 모바일에서 어디로 가야 하는가.
   지금 컴포넌트를 재사용할 수 있는가, 별도 모바일 뷰가 필요한가.
5. 바텀시트 라이브러리가 프로젝트에 이미 있는가.
   없으면 어떻게 구현하는 게 이 스택에 맞는가.

[먼저 할 것]
로컬 시안의 SpotFinder 화면을 열어 목표 레이아웃을 파악하고,
현재 코드와의 차이를 표로 정리하라.
```

**4번과 5번이 작업 크기를 결정하는 질문이었다.** 상세 패널을 재사용할 수 있으면 반나절, 별도로 만들어야 하면 하루. 바텀시트도 직접 구현하면 드래그·스냅 처리가 붙는다.

### 0224 구현 — 확정 사항을 못 박음

```
[확정된 설계]
레이아웃 (lg 미만):
  지도 풀스크린 + 상단 칩 필터(가로 스크롤 floating)
  + 하단 선택 스팟 단일 카드(고정) + 기존 탭바

하단 카드:
  썸네일 + 이름 + 작품 배지 + transitMode + 스토리 N편 + [상세] 버튼
  ‹ › 로 visibleSpots 배열 순서대로 옆 스팟 이동
  ❌ 거리(km)·리뷰 수·플랜 담기 — 데이터 없어 뺀다 (데스크탑과 동일)

상세:
  [상세] → ?detail=id 쿼리로 SpotDetailContent를 풀스크린 모달
  탭바까지 덮는다. 뒤로가기/X로 닫고 선택·지도 위치 유지

[하지 말 것]
❌ 데스크탑 3열 변경
❌ 드래그·스냅 바텀시트 (업계 지양, CLAUDE.md 표준)
❌ 데이터 없는 필드 추가
❌ 지도 클릭 줌·클러스터·칩 동작 변경 (0215~0223)
```

**"데이터 없는 필드 추가 금지"**는 데스크탑에서 정한 매핑 규칙을 모바일에도 적용한 것이다. 시안엔 "1.2km · 리뷰 12 · 플랜에 담기"가 있지만 우리 데이터엔 없다. 데스크탑에서 이미 `transitMode`·평점으로 대체했으므로 모바일도 같게 갔다.

### 0226 — 실기기 검증 항목을 명시

```
[검증 — 각 단계에서 확인할 것 보고]
0226 후:
  1. 다른 탭(Story·Plan) 탭바가 viewport-fit 추가로 위로 밀려 어색하지 않은가
     ← 유일한 회귀 위험. env() 쓰던 탭바가 갑자기 작동 시작
  2. 데스크탑 SpotFinder 헤더·3열·높이 불변
  3. 모바일 SpotFinder 헤더 없고 지도가 노치부터 풀블리드

[실측은 내가]
tsc·route만 CC가 확인. 브라우저 실측은 실기기로 내가 한다.
각 커밋 전에 멈춰서 "커밋 대기" 상태로 두라.
```

---

## 4. 작성·수정한 코드

### 0224 — 모바일 레이아웃 (+115 −24, 7파일)

전역 반응형 기준선을 md에서 lg로 이관했다. **lockstep이라 하나만 빠지면 그 구간에서 탭바가 사라지거나 겹친다.**

| 파일 | 변경 |
|---|---|
| `BottomTabBar.tsx` | `md:hidden` → `lg:hidden` |
| `NavLinks.tsx` | `hidden md:flex` → `hidden lg:flex` |
| `ProtectedMain.tsx` | fullBleed/기본 양쪽 `md:*` → `lg:*` |
| `(protected)/layout.tsx` | Write 버튼 `hidden md:inline-flex` → `lg:` |
| `globals.css` | `@media (min-width: 768px)` → `1024px` |
| `story/layout.tsx` | Write 버튼 + main의 `md:pb-8` → `lg:` |
| `SpotFinderMapNaver.tsx` | 좌측 칼럼·데탑 헤더·칩 화살표·리스트·지도 border·우측 aside 총 8곳 |

모바일 하단 선택 카드와 `‹ ›` 페이저를 만들었다.

```tsx
// components/SpotFinderMapNaver.tsx
<div className="lg:hidden fixed inset-x-3 z-[45] bottom-[calc(56px+env(safe-area-inset-bottom)+12px)]
     flex items-center gap-3 rounded-2xl border border-border bg-card shadow-lg p-3">
```

### 0225 — 풀스크린 높이 사슬 (+11 −26)

0224 후 지도가 화면 전체를 못 채우고 카드·안내문구·탭바가 겹쳐 얹혔다. 구 contained 레이아웃의 잔재가 남아 있었다.

```css
/* app/globals.css */
/* 모바일 100svh−260px−safe → 100svh−57px 균일 (@media 제거) */
/* 근거: sticky 헤더(h-14=56+border 1px)가 모바일도 flow 점유 → 헤더+지도=100svh 무스크롤 */
```

`ProtectedMain`은 fullbleed 라우트에서 `max-w-none`으로, 페이지 래퍼는 `rounded-none`·shadow 제거·`lg:overflow-hidden`으로 정리했다. 모바일에서 clip을 없앤 이유는 **fixed 카드/모달이 `appear-up` transform 조상에 잘리지 않게** 하기 위해서다.

### 0226 — 헤더 제거·viewport-fit (+34 −7)

**`viewport-fit=cover`가 없었다.** 이게 없으면 `env(safe-area-inset-*)`이 전부 0을 반환한다. 즉 기존 탭바의 홈바 대응 코드가 무늬만 있고 작동을 안 하고 있었다.

```tsx
// app/layout.tsx
+ // 0226: 노치·홈바 대응 — env(safe-area-inset-*)가 실제값을 반환하려면 viewport-fit=cover 필수(기존 부재).
+ export const viewport: Viewport = {
+   viewportFit: "cover",
+ };
```

SpotFinder만 헤더를 숨기는 게이트를 만들었다.

```tsx
// app/(protected)/_components/HeaderGate.tsx
'use client';
import { usePathname } from 'next/navigation';

// 0226: SpotFinder는 모바일에서 앱 헤더 숨김(데스크탑 lg는 유지 — 3열 헤더 불변). 다른 탭(Story·Plan)은 항상 표시.
// RSC 서버→클라 경계를 넘어온 children을 cloneElement/props로 조작하면 fragile(children.props undefined 크래시) →
// composition(wrapper)으로 전환. 일반 block wrapper는 sticky를 깨므로 display:contents(무박스)로 sticky 유지.
const HIDE_HEADER_ON_MOBILE = ['/spot-finder'];

export function HeaderGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideOnMobile = HIDE_HEADER_ON_MOBILE.some((r) => pathname.startsWith(r));
  if (!hideOnMobile) return children;
  // 모바일 hidden(display:none)=헤더 숨김 / lg:contents(display:contents)=데스크탑 표시 + wrapper 무박스로 sticky 유지.
  return <div className="hidden lg:contents">{children}</div>;
}
```

헤더가 없어지므로 모바일 지도 높이도 재분기했다.

```css
/* app/globals.css */
@utility h-spot-finder-map {
  height: 100vh;   /* 폴백 */
  height: 100svh;  /* 모바일: 헤더 없음 → 풀 */
  @media (min-width: 1024px) { height: calc(100svh - 57px); } /* 데스크탑: 헤더 유지 */
}
```

### 0227 — 카드 floating (1줄, 4토큰)

```tsx
// components/SpotFinderMapNaver.tsx
- <div className="lg:hidden fixed inset-x-3 ... border border-border bg-card shadow-lg p-3">
+ <div className="lg:hidden fixed inset-x-4 ... border border-border bg-card/90 backdrop-blur-sm shadow-2xl p-3">
```

| 토큰 | 변경 | 근거 |
|---|---|---|
| `inset-x-3` → `inset-x-4` | 12px → 16px | CLAUDE.md §5 터치 요소 가장자리 이격 |
| `bg-card` → `bg-card/90` | 불투명 → 90% | 지도가 살짝 비침. 완전 반투명은 가독성 저하 |
| — → `backdrop-blur-sm` | 약한 블러 | 같은 파일 안내 배너가 이미 지도 위에서 쓰는 선례 확인 |
| `shadow-lg` → `shadow-2xl` | 그림자 강화 | 떠 있는 느낌은 그림자로 |

`backdrop-blur`가 네이버 GL canvas 위에서 동작하는지는 **추측하지 않고 선례로 확증**했다. 같은 파일 844행 안내 배너가 이미 `bg-card/80 backdrop-blur-sm`을 지도 위에서 쓰고 있었다.

---

## 5. 결과 / 배운 것

### 결과

실기기(iPhone Safari)로 확인했다. 헤더 없이 지도가 노치부터 풀블리드로 채워지고, 상단 칩이 노치를 피하고, 하단 카드가 탭바 위에 뜨고, `[상세]`가 풀스크린 모달로 열리고 뒤로가기로 닫히며 선택·지도 위치가 유지된다. 데스크탑 3열과 다른 탭 헤더는 그대로다.

### 배운 것 1 — 표준 검증이 결정을 방어한다

CLAUDE.md에 "제품 UX 표준" 원칙을 넣고 처음 적용한 작업이다. 효과가 두 군데서 나왔다.

**하나, 안 할 것을 정해줬다.** 시안에 드래그 핸들이 있어서 3단계 바텀시트를 만들 뻔했는데, 검색이 그게 안티패턴이라고 알려줬다. 오터치·복잡도 때문에 업계도 지양하고, 핀터레스트·트위터가 페이지 내비로 회귀했다는 근거까지 나왔다. **덕분에 고정 카드 + 명시적 버튼이라는 단순한 구조로 갔다.**

**둘, 우리 시안이 표준과 다른 지점을 방어할 수 있게 됐다.** 우리 칩은 상단인데 구글 맵은 하단이다. 검색해보니 **한국 앱(네이버·카카오)이 상단**이었다. "표준과 다르다"가 아니라 "지역 관행을 따랐다"로 설명이 된다.

면접에서 "왜 이 구조인가"를 물으면 "제 마음대로"가 아니라 근거를 댈 수 있다.

### 배운 것 2 — 같은 인터랙션이 화면에 따라 갈린다

모바일 클릭 이동에서 0223의 거리 기반 확대를 껐다. 처음엔 "왜 같은 클릭인데 다르게 동작하지?"가 어색했다.

이유는 **화면 구성이 달라서**다.

```
데스크탑   좌측 목록이 항상 보임  →  확대해도 옆 스팟을 목록에서 찾음
모바일     목록 없음, 카드 ‹ › 가 유일한 네비  →  확대하면 그 네비가 무의미
```

Airbnb 표준도 같은 방향이었다. 선택 시 크게 줌인하지 않고 맥락을 유지한다.

**분기가 자의적이면 나쁘고, 구조에서 나오면 옳다.** 이 구분이 중요하다. "모바일이니까 다르게"는 근거가 아니지만 "모바일엔 목록이 없으니까"는 근거다.

### 배운 것 3 — 전역 기준선은 lockstep으로 옮겨야 한다

SpotFinder 하나 고치려는데 전역 파일 6개가 딸려왔다. 탭바·NavLinks·패딩·globals.css가 전부 md 기준으로 얽혀 있었다.

**하나만 빠지면 768~1024 구간에서 터진다.** 탭바는 md에서 사라지는데 SpotFinder는 lg까지 모바일이면, 그 사이에서 탭바 없는 빈 화면이 나온다.

그리고 이 구간은 **양 끝만 보면 안 걸린다.** 데스크탑(1400px)과 모바일(375px)에서 테스트하면 멀쩡하다. 가운데를 봐야 잡힌다. 검증 항목에 "768~1024 구간"을 따로 명시한 이유다.

옮길 근거도 실측이었다. **md(768)에서 3열은 지도 폭 ~98px.** 태블릿에서 3열은 원래도 못 쓰는 화면이었으니, lg 이관은 SpotFinder 편의가 아니라 전체적으로 옳은 수정이었다.

### 배운 것 4 — RSC 경계를 넘은 엘리먼트는 조작할 수 없다

`HeaderGate`를 처음엔 `cloneElement`로 만들었다. 헤더 엘리먼트를 받아서 클래스만 덧붙이는 방식이다. 500 크래시가 났다.

```
TypeError: Cannot read properties of undefined (reading 'className')
  children.props.className
```

원인은 서버/클라 경계였다.

```
ProtectedLayout   async 서버 컴포넌트
HeaderGate        'use client'
→ header 엘리먼트가 서버→클라 경계를 넘어감
→ 직렬화된 형태라 .props 접근 불가
```

**남의 엘리먼트를 조작하는 대신 composition으로 감쌌다.** 다만 일반 `div` wrapper는 부모 박스를 만들어 헤더의 sticky를 깬다. 그래서 `display: contents`를 썼다.

```
hidden       display: none      → 모바일에서 헤더 숨김
lg:contents  display: contents  → 데스크탑에선 wrapper가 레이아웃상 투명 → sticky 보존
```

`display: contents`를 이런 용도로 쓸 수 있다는 걸 이때 알았다.

### 배운 것 5 — "코드가 안 먹는다"와 "코드가 틀렸다"는 다르다

헤더 제거를 구현했는데 화면에서 헤더가 그대로였다. 30분을 헤맸다.

의심한 순서가 이랬다.

```
1. Tailwind v4에서 hidden lg:contents 조합이 안 만들어지나?
   → 생성 CSS 확인. .hidden(media 밖) / .lg\:contents(@media 안) 둘 다 정상
2. 경로 문자열이 안 맞나? /spot-finder 가 맞나?
   → 맞음
3. 스테일 CSS?
   → 500 크래시 후 HMR이 새 CSS를 못 깖. dev 재기동 + 하드 리프레시로 해결
```

**코드도 CSS도 처음부터 정상이었다.** 크래시가 빌드 상태를 꼬았을 뿐이다.

그리고 더 민망한 게 하나 더 있었다. 그 와중에 **미푸시 상태에서 Vercel 탭을 보며 "안 된다"고 하고 있었다.** 로컬 변경이 배포본에 있을 리가 없는데, 탭이 나란히 열려 있어서 헷갈렸다.

교훈은 **"안 먹는다"고 느끼면 코드를 의심하기 전에 무엇을 보고 있는지부터 확인**하는 것이다. 빌드 상태인지, 어느 서버인지, 캐시인지.

### 배운 것 6 — env()는 전제가 있어야 동작한다

`viewport-fit=cover`가 없어서 `env(safe-area-inset-*)`이 전부 0을 반환하고 있었다. 즉 **기존 탭바의 홈바 대응 코드가 몇 달간 무늬만 있었다.**

크로스 플랫폼 조사에서 확인한 것도 같은 맥락이다. `env()`는 iOS·안드로이드 공통으로 동작하고, 노치가 없으면 0이 된다. 그래서 코드 한 벌로 양쪽이 커버된다. **단 전제가 `viewport-fit=cover`다.**

그리고 하드코딩은 금물이다. safe area inset은 기기마다 다르다(iPhone 14 Pro ~59px, iPhone SE ~20px, 안드로이드 제각각). `max(기본값, env(...))` 패턴을 써야 한다.

### 배운 것 7 — 인수인계서도 틀린다

이 회고를 쓰려고 diff를 뽑다가 **인수인계서의 두 건이 사실과 다른 걸 발견했다.**

```
인수인계서    "0225: ProtectedMain과 SpotFinder 루트에 min-h-0을 넣어 높이 사슬을 잇는다"
실제 0225     min-h-0 수정 없음. 높이 계산 사슬(260px→57px 균일, max-w-none, 래퍼 정리)
              min-h-0 은 0253(iOS Safari 시트 목록 높이 붕괴) 건

인수인계서    "0227: 구현됨, 커밋 대기 (시안과 구조 다름 발견, 재검토 중)"
실제          9cd4818 로 커밋됨. 미커밋이 아니라 커밋 후 이어짐
```

**"flex-1 자식의 기본 min-height:auto 때문에 붕괴"는 실제로 있었던 일이지만 0253의 것**이고, 0225에 그렇게 쓰면 사실과 어긋난다. CC가 `git show e7a408e | grep min-h-`로 확인해서 잡아냈다.

이 세션에서 같은 형태가 다섯 번 나왔다.

| 건 | 문서상 | 실제 |
|---|---|---|
| 0212 | 커밋 0212 | 주석 `0214:` |
| 0216 | 커밋 0216 | 주석 `0217:` |
| 0217 | z16 심화 | `SPOT_CLICK_ZOOM = 11` |
| 0222 | z15 | `CLICK_ZOOM_DENSE = 13` |
| 0225 | min-h-0 사슬 | 높이 계산 사슬 (min-h-0은 0253) |

앞의 넷은 커밋 메시지·주석이었고 이번은 인수인계서다. **기록은 쓰는 순간 사실이 아니라 주장이 되고, 검증 없이 다음 근거로 쓰인다.**

그래서 이번 회고들은 전부 `git show` 실측을 먼저 받고 썼다. 기억으로 쓰면 다섯 건 다 그대로 옮겨졌을 것이다.

---

## 부기 — 이후 변경

이 구간의 산출물 중 절반은 살아남았고 절반은 사라졌다.

| 산출물 | 현재 |
|---|---|
| 전역 탭바 lg 기준 | **생존** (0284에서 1023px 상수로 코드에도 고정) |
| `?detail=` 풀스크린 모달 | **생존** (0260 overflow 정리, 0263 슬라이드 보강) |
| 0227 floating 질감 (`bg-card/90` + `backdrop-blur-sm` + `shadow-2xl`) | **생존** — 컨테이너는 바뀌었으나 질감은 시트가 승계 |
| `viewport-fit=cover` | **생존** |
| 하단 선택 카드 + `‹ ›` 페이저 | **소멸** — 0244에서 블록째 삭제(−93줄) |
| 모바일 pan-only 디스패처 | **소멸** — 0248에서 폐지. 근거였던 페이저가 사라져 모바일도 확대 룰 단일 경로 |
| `HeaderGate` | **소멸** — 0485에서 삭제, `data-hide-header` CSS 스코프로 대체 |

**`‹ ›` 페이저가 사라지면서 그것을 근거로 만든 pan-only 분기도 함께 폐지됐다.** 배운 것 2에서 "구조에서 나온 분기"라고 썼는데, 그 구조가 바뀌자 분기도 없어진 것이다. 근거가 사라지면 결정도 재검토되는 게 맞다.

현재 모바일 SpotFinder는 이렇다.

- 100svh 풀스크린 지도 + 헤더 없음
- 하단 2단 시트(peek/half, 그래버) — 명시 calc로 높이 확정(0252)
- 시트 내부: 제목 + 총 N곳 + 테마 토글, 스팟 목록 상시 표시(0238·0244)
- 선택 표시는 카드가 아니라 행 하이라이트(0271~0286 반복 조정)
- 행은 형제 버튼 2개 — 썸네일 탭 / 나머지 탭이 갈림(0262)
- 하단 페이드 그라디언트(0259) + 탭바는 floating pill(0228)

`HeaderGate`는 0485에서 삭제됐다. 조건부 렌더가 sticky 헤더의 리마운트를 유발해 57px 레이아웃 시프트가 생겼기 때문이다. 지금은 CSS 스코프로 처리한다.

```css
/* app/globals.css:807 */
@media (max-width: 1023px) {
  [data-hide-header] header.glass-header {
    display: none;
  }
}
```

`h-spot-finder-map`의 `lg −57px` 주석은 아직 `HeaderGate`를 참조하는데, 그 컴포넌트는 삭제됐다. **화석 주석이다.**
