# 0249~0259 회고: iOS Safari 시트 높이 붕괴 수술

**작성일**: 2026-08-11 (회고 초안 — 작업일 2026-07-16)
**소요 시간**: 약 하루치 (7/16 새벽 03:33 `76ed3f1` ~ 오후 14:49 `4e4fb55`. 새벽 03:33~04:23 4커밋 후 오전 11:42 재개)
**관련 커밋**: 11개 (revert 1건 포함)

```
76ed3f1 07-16 03:33 fix: 0249 상세 모달 상단 배지·닫기 버튼 가시성 개선
f48affd 07-16 03:59 feat: 0250 마커 선택 시 시트 목록이 해당 행으로 스크롤
815e8d8 07-16 04:05 Revert "feat: 0250 마커 선택 시 시트 목록이 해당 행으로 스크롤"   ← 번호 미기입
1a2a3b8 07-16 04:23 fix: 025X iOS Safari 시트 목록 잘림 수정                      ← 자리표시자 미치환
d37c80c 07-16 11:42 fix: 0253 iOS Safari 시트 목록 높이 붕괴 수정
2d9b10a 07-16 11:57 fix: 0254 실기기 Safari 시트 목록 높이 확보
13d0fb8 07-16 12:11 fix: 0255 시트 하한 완화로 지도 영역 확보
04de3c7 07-16 12:41 fix: 0256 시트 고정부 압축으로 지도 영역 추가 확보
abbd6ab 07-16 13:38 feat: 0257 시트 목록을 1행+걸침으로 조정해 지도 영역 확대
4d6db73 07-16 14:16 feat: 0258 시트 목록을 탭바 뒤까지 연장
4e4fb55 07-16 14:49 style: 0259 시트 목록 상하 경계 다듬기
```

### 번호 이력 (이 묶음에만 해당)

| 번호 | 실체 |
|---|---|
| 0250 | `f48affd` — 6분 뒤 `815e8d8`로 **revert**. 0261에서 다른 방식으로 재구현 |
| **0251** | `815e8d8` (0250 revert 커밋) — **번호 미기입** |
| **0252** | `1a2a3b8` — 커밋 메시지의 자리표시자 `025X`가 치환되지 않음 |
| 0253~0259 | 메시지 번호와 실체 일치 |

> 대조 중 발견한 어긋남 1건: `1a2a3b8`(=0252)이 **추가한 코드 주석은 자신을 `0251:`로 적었고**, 다음 커밋 `d37c80c`(=0253)가 그 주석을 `0252:`로 바꿔 달았다. 그 `0252:` 주석은 오늘 코드(`components/SpotFinderMapNaver.tsx:183`)에도 그대로 남아 있다 — **코드 주석의 번호가 커밋 메시지보다 한 칸 작다.** 위 표를 정본으로 둔다.

---

## 1. 한 줄 요약

실기기 iOS Safari에서만 하단 시트의 스팟 목록이 한 줄 높이로 붕괴하던 문제를, Web Inspector 실측으로 원인(WebKit이 중첩 flex의 grow를 계산하지 않음)을 확정하고 **flex 사이징을 버리고 명시 calc 높이 + `max()` 하한 짝 체계**로 재구성 — 이어 하한을 세 번 완화(190→143→105)해 지도 영역을 되찾고, 목록을 탭바 pill 뒤까지 연장해 "더 있음" 걸침 신호를 상시화.

---

## 2. 왜 / 목적 / 이유

> 근거: `docs/0228-0273-회고-재료-인수인계.md` 묶음 2.

### 실기기에서만 터지는 붕괴
- **왜**: 실기기 iOS Safari에서만 시트 목록이 한 줄 높이로 붕괴했다. 헤드리스·시뮬레이터에서는 재현되지 않았다.
- **목적**: 재현 불가를 이유로 추정에 머물지 않고, 실기기에서 원인을 확정한다.
- **이유**: **Web Inspector 실측이 결정타였다** — `ul`이 48.34px, 정확히 한 줄 높이로 붕괴한 것을 직접 확인했다. 원인은 WebKit이 중첩 flex 컨테이너의 `flex-grow`를 계산하지 않는 것. 가설을 왕복하는 것보다 인스펙터로 원인을 확정하는 편이 빨랐다.

### 해법을 "명시 높이"로 정한 이유
- **왜**: grow가 계산되지 않는다면, grow에 높이를 맡긴 구조 자체를 쓸 수 없다.
- **목적**: 목록 높이를 브라우저의 flex 계산에 의존하지 않고 결정한다.
- **이유**: 명시 `calc`로 높이를 확정하면 Safari가 grow를 계산하든 말든 결과가 같다. 대신 산식이 코드 밖으로 새지 않도록 **상수 주석에 유도 과정을 전부 남겼다**.

### `max()` 하한을 붙인 이유 (0254)
- **왜**: 명시 calc(=`58svh - 고정부`)만으로는 실기기에서 목록이 1행 남짓이었다.
- **목적**: 어떤 기기에서도 목록의 최소 높이를 보장한다.
- **이유**: **실기기 svh는 헤드리스·시뮬보다 작다** — 주소창·툴바 몫이 빠지기 때문. 그래서 svh 기반 높이에는 `max()` 하한을 짝으로 둔다. 이 교훈이 0273에서 CLAUDE.md §5(뷰포트 높이)로 승격됐다.

### 하한을 세 번 완화한 이유 (0255 → 0256 → 0257)
- **왜**: 하한을 크게 잡으니 이번엔 시트가 화면을 과점해 지도가 좁아졌다.
- **목적**: 목록 가시성과 지도 영역의 균형점을 실기기에서 찾는다.
- **이유**: 최종적으로 **"1행 온전 + 다음 행 30px 걸침"**으로 내렸다. 걸친 행이 "더 있음"을 알리는 스크롤 어포던스로 작동한다.

### 0250 revert
- **왜**: 마커를 탭했을 때 시트 목록이 해당 행으로 따라오게 만들었으나, `scrollIntoView`가 Safari에서 실패했다(조상 순회).
- **목적**: 붙들고 고치기보다 즉시 되돌려 기준선을 지킨다.
- **이유**: 구현 6분 뒤 revert. 이 기능은 0261에서 `scrollIntoView`를 쓰지 않는 방식으로 다시 돌아온다. revert는 실패가 아니라 "검증 후 즉시 물림"이다.

---

## 3. 작성한 프롬프트

> 당시 프롬프트 원문은 보존돼 있지 않다. 아래는 커밋 범위에서 역산한 **요지**이며, 실제 문구가 아니다.

```
[배경]
실기기 iOS Safari에서만 하단 시트의 스팟 목록이 한 줄 높이로 붕괴한다.
헤드리스·시뮬레이터에서는 재현되지 않는다.
Web Inspector로 확인하니 ul이 48.34px(= 한 줄)이다.

[목표]
목록 높이를 Safari에서도 정상 확보. 원인 확정 후 구조 수정.

[하지 말 것]
- 재현 안 되는 상태로 추측 수정 ❌ (실측 후 원인 확정)
- 목록 높이를 flex grow에 의존 ❌
- 짝 상수 한쪽만 변경 ❌ (한쪽만 바꾸면 클립 잘림)

plan 요청.
```

---

## 4. 코드 작성 & 수정

### 1. 0249 — 상세 모달 노치·터치 타겟 (붕괴 수술 직전)

```tsx
// components/SpotFinderMapNaver.tsx (0249)
{/* 0249: ✕ 모바일 히트 44×44(§5 최소 타겟 — 기존 24 미달)·가장자리 16px 이격·노치 대응.
    시각 원·아이콘은 1.2배(29px/14px) — 히트와 분리(투명 버튼 + 내부 시각 원). 데탑은 lg: 원복 */}
<button
  type="button"
  aria-label="닫기"
  onClick={onClose}
  className="absolute top-[calc(env(safe-area-inset-top)+28px)] right-4 w-11 h-11 lg:top-2 lg:right-2 lg:w-6 lg:h-6 flex items-center justify-center flex-shrink-0 group"
>
  <span className="w-[29px] h-[29px] lg:w-6 lg:h-6 rounded-full bg-card/80 group-hover:bg-card flex items-center justify-center transition-colors text-fg shadow-sm">
    <X className="w-3.5 h-3.5 lg:w-3 lg:h-3" />
  </span>
</button>
```

배지도 같은 커밋에서 노치 대응 + 모바일 1.2배(커밋 메시지는 1.5배, 코드 주석은 "1.5→1.3→1.2 체감 조정"). 히트 영역과 시각 원을 분리한 게 핵심.

### 2. 0250 — 마커→목록 스크롤 (6분 뒤 revert)

```tsx
// components/SpotFinderMapNaver.tsx — revert됨: 815e8d8
// 0250: 선택 변경 시 모바일 목록을 해당 행으로 스크롤 — 마커 탭이 주 대상(행이 스크롤 밖일 수 있음).
// 'nearest'라 행 탭(이미 가시)에는 no-op. 데탑은 display:none이라 no-op(0245 동일 원리).
// peek(목록 높이 0)에선 스킵 — 0높이 스크롤포트에 'nearest'가 하단 정렬돼 half 복귀 시 행이 위로 벗어남(실측).
useEffect(() => {
  if (sheetLevel === 'peek') return;
  const li = mobileSelectedItemRef.current;
  if (!li) return;
  if ((li.closest('ul')?.clientHeight ?? 0) > 0) {
    li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return;
  }
  const t = setTimeout(
    () => mobileSelectedItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    340, // 시트 전환 320ms + 여유
  );
  return () => clearTimeout(t);
}, [selectedSpot, sheetLevel]);
```

> `scrollIntoView`의 조상 순회가 Safari에서 실패 → `815e8d8`로 전량 되돌림. 0261에서 `ul.scrollTop` 직접 대입 방식으로 재구현된다(묶음 3).

### 3. 0252 (`1a2a3b8`, "025X") — flex 문법 교체 시도

```tsx
// components/SpotFinderMapNaver.tsx (1a2a3b8)
// 0251: basis 0%(flex-1)는 iOS Safari가 중첩 flex(클립 래퍼) 안에서 높이를 오계산해 행이 밀림(실기기)
//       → auto + min-h-0 조합이 Safari-safe
- <ul className="mt-3 flex-1 flex flex-col gap-[7px] overflow-y-auto min-h-0">
+ <ul className="mt-3 flex-[1_1_auto] flex flex-col gap-[7px] overflow-y-auto min-h-0">
```

> 커밋 메시지는 "Flexbug #241 대응 / min-height 명시"라 적혀 있으나, 실제 변경은 `flex-1` → `flex-[1_1_auto]` 한 줄. **flex 안에서 해결하려던 마지막 시도**이고, 이 방향은 다음 커밋에서 폐기된다.

### 4. 0253 — flex 사이징 배제, 명시 calc로 전환 (전환점)

```ts
// components/SpotFinderMapNaver.tsx (0253 도입 시점)
// 0252: 목록 ul 명시 max-h — iOS Safari가 중첩 flex(클립 래퍼) 안에서 grow를 계산하지 않아
// ul이 한 줄(48px)로 붕괴(실기기 Web Inspector 실측) → flex 사이징 배제, 높이 = min(콘텐츠, calc).
// 58svh = SHEET_MAX_H.half와 동기. 272 = border2 + pt4 + 그래버44 + 제목24 + (mt12+검색46) + (mt12+칩38) + ul mt12 + pb78.
// safe-area 항: pb가 78+env라 노치 기기에선 그만큼 가용 공간이 줄어듦(빼지 않으면 마지막 행이 클립에 가림).
const SHEET_LIST_MAX_H = 'max-h-[calc(58svh-272px-env(safe-area-inset-bottom))]';
```

```tsx
- <ul className="mt-3 flex-[1_1_auto] flex flex-col gap-[7px] overflow-y-auto min-h-0">
+ <ul className={`mt-3 ${SHEET_LIST_MAX_H} shrink-0 flex flex-col gap-[7px] overflow-y-auto`}>
```

### 5. 0254 — `max()` 하한 짝 체계 도입

```ts
// components/SpotFinderMapNaver.tsx (0254)
const SHEET_MAX_H = {
  peek: 'max-h-[calc(156px+env(safe-area-inset-bottom))]',
  // 0254: half 하한 462 = 고정부 272 + 목록 하한 190 — 실기기 Safari는 svh가 주소창·툴바만큼 축소돼
  // 58svh만으론 목록이 1행 남짓. 하한은 아래 SHEET_LIST_MAX_H의 190과 짝(pair) — 한쪽만 바꾸면 클립 잘림.
  half: 'max-h-[max(58svh,calc(462px+env(safe-area-inset-bottom)))]',
} as const;
// 0254: 하한 190 = 행68×2 + gap7×2 + 여유(최소 2행 온전 + 3행째 걸침).
// half 하한 462(=272+190)와 짝 — 검산: 하한 발동 시 272+env+190 = half 하한과 정확 일치.
const SHEET_LIST_MAX_H = 'max-h-[max(calc(58svh-272px-env(safe-area-inset-bottom)),190px)]';
```

**두 상수는 "짝"이고, 주석에 검산식까지 남겼다** — 한쪽만 바꾸면 클립에서 행이 잘린다.

### 6. 0255 → 0256 → 0257 — 하한 3회 완화 (실기기 균형 잡기)

| 커밋 | 목록 하한 | half 하한 | 무엇을 바꿨나 |
|---|---|---|---|
| 0254 | 190 (2행 온전 + 3행째 걸침) | 462 | 하한 도입 — 실기기에서 시트 과점 |
| 0255 | 143 (2행 온전) | 415 | 하한만 완화 |
| 0256 | 143 유지 | 397 | **고정부 압축** 272→254 (`mt-3`→`mt-2` 셋 + `pb` 78→72) |
| 0257 | **105** (1행 + 걸침 30) | **359** | 걸침을 어포던스로 채택 |

```ts
// components/SpotFinderMapNaver.tsx (0256) — pb 72의 근거
// 254 = border2 + pt4 + 그래버44 + 제목24 + (mt8+검색46) + (mt8+칩38) + ul mt8 + pb72 (0256: mt12→8 셋 + pb78→72 압축).
// pb 72 = 탭바 실측(pill h58 + 하단 이격 14) — 콘텐츠 끝 = pill top 정확 일치(겹침 0).
```

```ts
// components/SpotFinderMapNaver.tsx (0257) — 걸침 어포던스
// 0257: 하한 105 = 행68 + gap7 + 걸침30 (1행 온전 + 다음 행 썸네일 상단 20px 걸침 — 스크롤 어포던스,
// 2행 온전 143은 시트 과점이라 축소). half 하한 359(=254+105)와 짝 — 검산: 254+env+105 = half 하한과 정확 일치.
// 하한은 최소 보장선 — svh가 이기는 뷰포트에선 목록이 더 보임(무해).
const SHEET_LIST_MAX_H = 'max-h-[max(calc(58svh-254px-env(safe-area-inset-bottom)),105px)]';
```

> 이력이 상수 주석 한 줄로 압축돼 오늘까지 남아 있다 (`SpotFinderMapNaver.tsx:179`):
> `// (이력: 0254 190/462 과점 → 0255 143/415 → 0256 고정부 압축 143/397 → 0257 걸침 어포던스 105/359)`

### 7. 0258 — 목록을 클립 래퍼 밖으로 (탭바 뒤까지 연장)

목록 `ul`을 peek 클립 래퍼 **밖(루트 직속)**으로 꺼내고, 고정 스택(그래버·제목·검색·칩)만 래퍼가 클립하게 책임을 나눴다.

```ts
// 0258: 고정 스택(그래버·제목·검색·칩) 래퍼의 레벨별 클립 높이 — flex 수축 의존 제거(0253 명시 높이 원칙).
// peek 72 = 그래버44 + 제목24 + 여유4 / half 168 = +mt8+검색46+mt8+칩38.
const SHEET_STACK_MAX_H = { peek: 'max-h-[72px]', half: 'max-h-[168px]' } as const;
```

```tsx
{/* 0258: 래퍼 밖(루트 직속) — 루트는 클립하지 않아 pill 뒤까지 행이 이어져 보임(걸침 신호 상시).
    peek은 max-h-0 + 패딩도 0 — border-box 높이는 패딩 합 이하로 못 내려가(실측 80px 잔존,
    행 조각이 pill 주변에 비침) 패딩까지 접고 전환 속성에 포함해 동기. */}
<ul className={`${sheetLevel === 'peek' ? 'max-h-0 pt-0 pb-0' : `pt-2 pb-[calc(72px+env(safe-area-inset-bottom))] ${SHEET_LIST_MAX_H}`} shrink-0 flex flex-col gap-[7px] overflow-y-auto transition-[max-height,padding] duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)]`}>
```

산식도 "시트 높이 − 182" 형태로 등가 변환됐다 — 현재 코드(`SpotFinderMapNaver.tsx:192`)의 값이 이것이다.

```ts
// 0258→0259: ul = 시트 높이 − 182 (182 = border2 + pt4 + 고정스택168 + ul mt8).
// floor 177 = half 하한 359 − 182 (0257의 가시 목록 105 + pill존 72의 등가 변환 — pill 위 가시값은 0257과 동일).
const SHEET_LIST_MAX_H = 'max-h-[max(calc(58svh-182px),calc(177px+env(safe-area-inset-bottom)))]';
```

### 8. 0259 — 상하 경계 다듬기 (하단 페이드)

```tsx
// components/SpotFinderMapNaver.tsx (0259)
{/* 0259: 하단 페이드 — pill 뒤 비침(걸침 신호)은 남기고 바닥으로 갈수록 시트 배경으로 잦아들게(애플 지도식).
    h = pill존(72+env) + 16(pill 상단 위 시작), pill top 지점 불투명도 ≈18%라 비침 유지·바닥 100%로 잘린 텍스트 소멸.
    끝색은 불투명 var(--card) — 시트 bg(card/90)로 끝내면 바닥에 텍스트 10%가 남음. 토큰 기반이라 라이트/다크 자동.
    DOM 순서로 목록 위, 시트 z-30 컨텍스트 안이라 탭바(z-40) 아래. pointer-events-none — 스크롤·pill 터치 통과. */}
<div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(88px+env(safe-area-inset-bottom))] bg-[linear-gradient(to_bottom,transparent,var(--card))]" />
```

상단은 `pt-2`(내부 패딩)를 `mt-2`(외부 마진)로 되돌려, 스크롤에 밀려 행이 칩에 붙는 현상을 막았다.

---

## 5. 결과 / 배운점

### 결과
- 실기기 iOS Safari에서 목록 높이가 확보됐고, 이후 사이클(0281·0487)에서 값이 조정될 때도 **명시 calc + `max()` 하한 짝** 구조 자체는 유지됐다. 오늘 코드에도 그대로 있다.
- 시트가 지도를 과점하지 않으면서 "더 있음"을 알리는 걸침 어포던스가 남았다.
- 이 묶음의 교훈이 0273에서 **CLAUDE.md §5 뷰포트 높이 절**로 승격됐다 — svh 실기기 과소, 중첩 flex grow 금지, 짝 상수 콜로케이션, Tailwind JIT 리터럴.

### 배운점

- **iOS Safari 시트 높이는 실기기 실측이 필수다.** 데스크탑·시뮬레이터로는 검증이 불가능하다.
- **가설 왕복보다 인스펙터 실측이 빠르다.** `ul`이 48.34px이라는 숫자 하나가 원인을 확정했고, 그 뒤로는 해법이 직진했다.
- **revert는 실패가 아니라 "검증 후 즉시 물림"이다.** 0250은 6분 만에 되돌렸고, 0261에서 더 나은 방식으로 돌아왔다.
- **파생 관계인 상수는 짝으로 묶고 검산식을 주석에 남긴다.** `SHEET_MAX_H.half`와 `SHEET_LIST_MAX_H`는 한쪽만 바꾸면 클립에서 행이 잘린다 — 그 사실 자체를 코드에 적어 뒀다.

---

## 다음 작업
0260~0262 — 상세 스크롤 복구, 마커↔목록 동기 재구현(0250 revert의 귀환), 모바일 행 동작 재배치.
