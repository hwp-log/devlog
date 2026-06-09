# 0082 회고: 예산요약 부분에 지갑 아이콘 반영, write 버튼에 hover 트랜지션 다듬기

- 작성일: 2026-06-09
- 소요: 약 2시간
- 관련 커밋: cfae82c

## 1. 한 줄 요약

예산 요약 헤더에 Wallet 아이콘을 추가해 여행동선(MapPin) 헤더와 통일하고, Write 버튼 hover 트랜지션을 부드러운 곡선으로 늦추되 누름(active)은 빠른 촉감으로 분리했다.

## 2. 왜 / 목적 / 이유

### 예산 헤더 Wallet 아이콘

- 왜: 예산 요약 헤더에 의미 아이콘이 없어 여행동선(MapPin) 헤더와 시각적으로 불균형했다.
- 목적: "여기가 돈 얘기"라는 의미를 한눈에 전달하고, 여행동선 헤더와 패턴을 통일한다.
- 이유: 통화 기호(₩/$)는 외국인 사용자(i18n)에게 혼란을 줄 수 있어, 통화 중립적인 Wallet 아이콘을 채택했다. MapPin과 동일한 size·gap·색(currentColor 상속)으로 두 헤더의 아이콘 패턴을 맞췄다.

### Write 버튼 hover 트랜지션 다듬기

- 왜: hover 시 올라오는 애니메이션이 `.2s ease`라 끊기는 느낌이었다.
- 목적: 올라옴은 부드럽게, 누름은 빠른 촉감을 유지한다.
- 이유: hover 올라옴(`translateY`)과 active 눌림(`scale`)이 같은 `transform` 속성을 공유한다. CSS transition은 속성 단위라 `transition: transform .25s` 하나면 둘 다 `.25s`가 되어, hover를 늦추는 순간 누름도 같이 굼떠진다. 그래서 `:active`에만 `transition-duration: .1s`를 덮어 분리했다. 한 속성을 공유하는 두 동작 중 한쪽(hover)을 늦추면 다른 쪽(active)이 끌려가는 부작용을 끊은 것.

## 3. 작성한 프롬프트

Wallet 아이콘:

```
[배경]
예산 요약 헤더에 의미 아이콘이 없음.
여행동선 헤더엔 MapPin 아이콘이 이미 있음 — 예산 쪽도 같은 방식으로 지갑 아이콘 추가.
통화 기호(₩/$)는 외국인 i18n 때문에 안 씀 — 아이콘으로 "예산" 의미 전달.

[목표]
예산 요약 헤더 제목 옆에 lucide-react Wallet 아이콘 추가.
(확인됨: import { Wallet } from 'lucide-react')
여행동선 헤더의 MapPin과 동일한 size·색·gap·정렬로 맞춤 — 그 코드 찾아서 그대로 적용.

[하지 말 것]
❌ MapPin과 다른 size/색/gap (반드시 통일)
❌ 통화 기호(₩/$) 추가
❌ 다른 헤더·레이아웃 변경

[참조 패턴]
여행동선 헤더의 MapPin 아이콘 — 먼저 찾아 size/색/gap 그대로 가져옴.

[검수 모드]
두 헤더 아이콘이 size/색/gap 동일한지 작동 확인. ★(UI 디테일).

plan 요청.
```

Write 버튼 hover 트랜지션:

```
[배경]
.btn-elevated hover 시 올라오는(translateY) 게 .2s라 끊기는 느낌. 조금 늦춰 부드럽게.
함정: transform transition을 늘리면 active 눌림(scale)도 같이 느려져 촉감이 굼떠짐 → 분리 필요.

[목표]
1. hover 올라옴 부드럽게:
   transition을 transform/box-shadow .2s ease → .25s cubic-bezier(0.4, 0, 0.2, 1)
2. active 눌림은 빠른 촉감 유지:
   .btn-elevated:active에 transition-duration: .1s 추가

[하지 말 것]
❌ translateY·shadow·scale 값 변경 (속도/곡선만)
❌ active 눌림까지 느리게 (촉감 죽음)
❌ 다른 버튼/요소 변경

[검수 모드]
hover 올라옴이 부드러운지(끊김 완화) + active 눌림은 여전히 빠른지.

plan 요청.
```

## 4. 코드 작성 & 수정

```tsx
// app/story/[id]/page.tsx — Wallet 아이콘 추가
import { MapPin, Wallet } from 'lucide-react';

// 예산 요약 헤더 (MapPin 헤더와 동일 패턴)
<h2 className="flex items-center gap-2 text-base font-semibold text-[#1A1A1A] mb-4">
  <Wallet size={16} />
  예산 요약
</h2>
```

```css
/* app/globals.css — hover 트랜지션 곡선·속도 조정 + active 분리 */
.btn-elevated {
  /* .2s ease → .25s 부드러운 곡선 */
  transition:
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-elevated:active {
  transform: scale(0.96);
  transition-duration: 0.1s; /* 누름은 빠른 촉감 유지 (transform 공유 분리) */
}
```

## 5. 결과 / 배운점

- 예산 요약 헤더가 Wallet 아이콘으로 여행동선 헤더와 통일됐다. Write 버튼은 hover 올라옴이 부드러워지고 누름은 빠른 촉감을 유지한다.
- 배운점 1: 의미 전달 아이콘은 통화 기호 같은 문자보다 언어 중립적이라 i18n에 유리하다.
- 배운점 2: CSS transition은 *속성 단위*라, 한 속성(`transform`)을 공유하는 여러 동작(hover lift, active press)은 한쪽 속도를 바꾸면 다른 쪽도 끌려간다. `:active`에 `transition-duration`을 덮어쓰면 같은 속성이라도 동작별로 속도를 분리할 수 있다.
