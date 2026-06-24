# 0111 회고: Dotrip 로고 추가 (스카이블루 마커형 + 위치점)

- 작성일: 2026-06-24
- 소요: 약 1시간
- 관련 커밋: 3c23605

## 1. 한 줄 요약

"여행한 위치를 찍어 공유한다"는 Dotrip 콘셉트를 'o'를 지도 마커로 치환해 로고로 시각화했다. 헤더 정렬 과정에서 flex·Tailwind reset이 얽힌 3단 함정을 추측 없이 코드로 원인을 확인하며 풀었다.

## 2. 왜 / 목적 / 이유

### 로고 모양 — 'o'를 지도 마커로 치환

- 왜: Dotrip은 "여행한 곳의 위치와 정보를 공유한다 = 위치에 점을 찍는다"는 뜻에서 지은 이름이다(Dot + trip). 브랜드명에 담긴 이 콘셉트를 로고에서도 한눈에 보여주고 싶었다.
- 목적: 이름·태그라인("여행에 점을 찍다")·로고가 "점을 찍는다"는 하나의 콘셉트로 일관되게 이어지는 상태.
- 이유: 글자 'o'를 지도 마커(핀)로 치환했다. 'o' = 동그라미 = 지도 위 한 점 = 다녀온 촬영지. 별도 심볼을 붙이는 대신 글자 자체를 의미로 바꿔, 브랜드명과 의미가 한 덩어리가 되게 했다. 핀 아래에는 위치점(ellipse)을 두어 "지도 위 한 지점에 꽂힌" 느낌을 더했다.

### 정렬 디버깅 — 추측 대신 코드로 원인 확인

- 왜: 로고를 헤더에 넣으니 핀이 글자보다 위로 솟았다. 핀을 'o' 자리로 내리려고 `verticalAlign`을 -5px → -8px로 바꿨는데 변화가 전혀 없었다.
- 목적: 핀이 'o' 자리에 앉고 위치점이 baseline 아래로 떨어지는, 의도한 정렬 상태.
- 이유: "값을 더 키워보자"는 추측 대응 대신 "왜 안 먹는지" 원인부터 봤다. 가설(flex 컨테이너라 vertical-align이 무시되는 것)을 세우되 단정하지 않고, CC에게 실제 코드를 읽혀 검증했다. 추측으로 값만 만졌으면 영영 못 고쳤을 문제다.

## 3. 작성한 프롬프트

원인 분석 단계(수정 없이 읽기만):

```
[배경]
로고 마커 정렬 문제. verticalAlign을 -5px → -8px로 바꿨는데 시각적 변화가 전혀 없음.

[목표] 수정하지 말고 원인만:
1. Logo.tsx 현재 코드 전체를 읽어 그대로 보고 (Link className, SVG 스타일 포함).
2. 가설 검증: Link가 inline-flex / flex인지, align-items가 걸려 있는지.
   - flex 컨테이너 안에서는 자식의 vertical-align이 무시되고 align-items가 정렬을 지배함.
   - 지금 구조가 이 경우에 해당하는지, 그래서 verticalAlign이 무효인지 코드로 확인.

[하지 말 것]
❌ 아무것도 수정하지 마 — 코드 읽고 원인만.
❌ 추측 단정 말고, 실제 Logo.tsx 코드 기준으로.

[보고] Logo.tsx 현재 코드 + verticalAlign이 무효인 이유.
```

## 4. 코드 작성 & 수정

### 로고 SVG (마커 + 위치점)

```tsx
// app/(protected)/_components/Logo.tsx
<svg viewBox="0 0 20 27" width="16" height="21.5" aria-hidden="true"
     style={{ verticalAlign: '-4px', display: 'inline-block' }}>
  <ellipse cx="10" cy="25" rx="3.4" ry="1.4" fill="#0EA5E9" opacity="0.55" /> {/* 위치점 */}
  <circle  cx="10" cy="9"  r="8"  fill="#0EA5E9" />                          {/* 핀 머리 */}
  <polygon points="3,13 17,13 10,21" fill="#0EA5E9" />                       {/* 핀 꼬리 */}
  <circle  cx="10" cy="9"  r="3"  fill="white" />                            {/* 핀 구멍 */}
</svg>
```

### 3단 함정과 해결

```
1단 — flex 아이템엔 vertical-align이 안 먹는다
  Link가 inline-flex items-baseline → 자식 svg는 flex 아이템 →
  vertical-align 무시(align-items가 지배). verticalAlign -5→-8 바꿔도 변화 0.

2단 — Tailwind preflight가 svg를 block으로 만든다
  inline-flex items-baseline 제거 → inline 흐름 복귀 →
  Tailwind reset의 svg { display: block } 때문에 svg가 줄을 통째로 차지 →
  로고가 세로로 쪼개짐 (D / 핀 / trip 세 줄).

3단 — inline-block으로 복원
  svg에 display: inline-block 부여 → 한 줄로 붙음 +
  inline-block엔 vertical-align이 먹으므로 verticalAlign 작동.
  -8px는 과해서 -4px로 미세조정 → 핀이 'o' 자리에 안착.
```

```tsx
// 적용된 헤더 2곳
// app/(protected)/layout.tsx, app/story/layout.tsx → <Logo />
```

## 5. 결과 / 배운점

- 핀이 'o' 자리에 앉고 위치점이 baseline 아래로 떨어져, "여행에 점을 찍다"가 로고에 그대로 담겼다. 헤더 2곳에 한 컴포넌트로 반영했다.
- vertical-align은 inline 세계 전용이다: `display: flex`(또는 inline-flex)가 되는 순간 자식은 flex 아이템이 되고 vertical-align은 무시된다. 세로 정렬은 align-items가 지배한다. "flex냐 아니냐에 따라 vertical-align이 먹느냐 안 먹느냐"가 갈린다.
- Tailwind preflight는 svg를 `display: block`으로 reset한다: inline 흐름에서 svg를 글자와 한 줄에 두려면 `inline-block`(또는 inline)으로 되돌려야 한다. 프레임워크의 기본 reset이 기본 동작을 바꿔놓는다는 걸 의식해야 한다.
- 추측보다 코드: "안 먹네? 값을 더 키워보자"로 갔으면 원인(flex)을 못 만나 헛수고했을 것이다. 가설을 세우되 단정하지 않고 코드로 검증하니, 한 함정을 풀 때마다 다음 함정(block reset)이 정확히 드러났다.
