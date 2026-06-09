# 0081 회고: Write 버튼 입체 스타일 적용

- 작성일: 2026-06-09
- 소요: 약 4시간
- 관련 커밋: 93e740f

## 1. 한 줄 요약

Write 버튼을 카드와 통일하려 글래스(frost)를 적용했으나 흰 헤더 위에서 효과가 묻혀, frost를 빼고 흰색 + 큰 그림자(elevation) 방식으로 두 헤더 버튼을 통일했다.

## 2. 왜 / 목적 / 이유

### 글래스(frost) 포기, 그림자(elevation) 채택

- 왜: Write 버튼이 카드와 시각적으로 분리돼 보였다. 통일하려고 `.glass-outer` + specular(frost)를 버튼에 적용했으나, 흰 헤더 위에서 글래스 효과가 보이지 않았다.
- 목적: 버튼이 카드와 같은 "떠 있는" 그룹으로 읽히게 한다.
- 이유: frost가 안 된 원인이 두 겹이었다.
  1. 헤더 배경이 흰색이라, 투과(backdrop blur)해도 흰색만 비쳐 효과가 묻혔다. (frost의 본질은 배경 투과이고, 비칠 배경이 흰색뿐이면 효과가 성립하지 않는다.)
  2. 헤더가 이미 `backdrop-filter`를 사용해 자기 배경 기준점을 만들었고, 그 안의 버튼 `backdrop-filter`는 페이지가 아니라 헤더의 흰 면만 블러했다(중첩).
  
  카드를 다시 보니 frost가 아니라 "흰색 + 큰 drop shadow(`0 20px 60px`)"로 배경에서 떠 있었다. 즉 카드와 버튼을 묶는 공통분모는 frost가 아니라 그림자(elevation)였다. 통일하려는 속성을 frost로 잘못 짚었다가, 진짜 공통분모가 그림자임을 찾아 문제를 다시 정의했다. → 흰색 + 큰 그림자 + rim + hover 광택을 갖춘 `.btn-elevated`로 통일했다.

## 3. 작성한 프롬프트

```
[배경]
글래스(frost) 포기 확정 — 흰 헤더 위엔 비출 게 없어 유리 불가(Apple도 흰 배경은 단색 처리).
확증: 카드도 frost가 아니라 "흰색+큰 그림자"로 떠 있음. 그 방식 그대로 버튼에 적용.
방향 A: 흰 솔리드 + 큰 그림자(elevation) + 미세 rim + hover 광택.

[목표]
globals.css에 .btn-elevated 신설(두 버튼 재사용), Write 버튼 두 곳에 적용.
.btn-elevated:
  position:relative; background:#fff; border-radius:9999px; overflow:hidden;
  isolation:isolate;   ← frost 버려 backdrop-filter 없어짐 → stacking context 보장용
  box-shadow:
    0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08),
    inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 1px rgba(0,0,0,0.06);
  transition: transform .2s ease, box-shadow .2s ease;
.btn-elevated::after (광택, z-index:1, pointer-events:none, border-radius:inherit):
  background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.5) 50%, transparent 65%);
  background-size:250% 100%; background-position:150% 0; transition:background-position .7s ease;
.btn-elevated:hover::after { background-position:-80% 0; }
.btn-elevated:hover { transform:translateY(-1px); box-shadow 강화 }
.btn-elevated:active { transform:scale(0.96); }
글자+아이콘 감싼 span: position:relative; z-index:2 (광택 위).

적용:
- app/(protected)/layout.tsx: glass-outer glass-specular rounded-full! → btn-elevated
- app/story/layout.tsx: 구버전(bg-white border-slate-300) → btn-elevated로 동일 적용, span 구조 맞춤

[하지 말 것]
❌ .glass-outer 수정 (카드 공용 — 그대로)
❌ frost/backdrop-filter 재도입 (흰 헤더에선 무의미)
❌ 두 버튼 다르게 (동일 클래스로 통일)
❌ 안 쓰게 된 .glass-specular는 사용처 없으면 제거

[검수 모드]
두 헤더 버튼이 동일하게 흰색+그림자로 떠 보이는지, hover 떠오름+광택, active 들어감,
글자 또렷(z-index:2), isolate로 z 정상. ★★(globals 토큰 추가).

plan 요청.
```

## 4. 코드 작성 & 수정

```css
/* app/globals.css — .btn-elevated 신설, .glass-specular 제거 */
.btn-elevated {
  position: relative;
  background: #fff;
  border-radius: 9999px;
  overflow: hidden;
  isolation: isolate; /* frost 제거로 backdrop-filter 없어짐 → stacking context 보장 */
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 2px 6px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 -1px 1px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.btn-elevated::after { /* hover 광택 */
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  border-radius: inherit;
  background: linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.5) 50%, transparent 65%);
  background-size: 250% 100%;
  background-position: 150% 0;
  transition: background-position 0.7s ease;
}

.btn-elevated:hover::after { background-position: -80% 0; }

.btn-elevated:hover {
  transform: translateY(-1px);
  box-shadow:
    0 14px 36px rgba(0, 0, 0, 0.16),
    0 4px 10px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 -1px 1px rgba(0, 0, 0, 0.06);
}

.btn-elevated:active { transform: scale(0.96); }
```

```tsx
// app/(protected)/layout.tsx — glass-outer glass-specular rounded-full! → btn-elevated
// 글자+아이콘을 span(z-[2])으로 감싸 광택 위에 위치
<Link href="..." className="btn-elevated ... text-slate-600">
  <span className="relative z-[2] flex items-center gap-1.5">
    {/* 아이콘 + Write */}
  </span>
</Link>

// app/story/layout.tsx — 구버전(bg-white border-slate-300) → btn-elevated 동일 적용
```

## 5. 결과 / 배운점

- frost를 버리고 `.btn-elevated`로 두 헤더 버튼(`(protected)`, 구버전 `story`)을 통일했다. 카드와 같은 톤으로 떠 보인다.
- 배운점 1: 글래스(frost) 효과는 배경이 비쳐야 성립한다. 흰 배경 + 중첩된 `backdrop-filter` 조건에선 효과가 묻혀 불가능하다.
- 배운점 2: "통일하려는 속성"을 frost로 잘못 짚었다가, 진짜 공통분모가 그림자(elevation)임을 찾아 문제를 다시 정의했다. 수단(frost)에 매달리지 않고 목표(떠 있는 느낌)에 집중하니 더 단순한 방법으로 닿았다.
- 배운점 3: `backdrop-filter`를 제거하면 그 요소가 만들던 stacking context가 사라지므로, `::after`(광택)와 글자 span의 레이어 순서를 보장하려면 `isolation: isolate`를 명시해야 한다.
