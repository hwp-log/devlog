# 0110 회고: Write 버튼 반투명 적응형 배경 적용

- 작성일: 2026-06-24
- 소요: 약 1시간
- 관련 커밋: f584455

## 1. 한 줄 요약

0081에서 Write 버튼을 불투명 + 그림자(`btn-elevated`)로 띄웠으나, 헤더가 반투명이라 스크롤 시 버튼만 재질이 갈라져 보여, 버튼을 반투명(`btn-soft`)으로 바꿔 헤더와 톤을 통일했다. blur 없이 알파 합성으로 구현했다.

## 2. 왜 / 목적 / 이유

### 불투명 버튼(btn-elevated)에서 반투명 버튼(btn-soft)으로 교체

- 왜: 0081에서 Write 버튼을 불투명 흰색 + 큰 그림자(`btn-elevated`)로 띄웠다. 그런데 헤더(`glass-header`)는 반투명이라, 아래로 스크롤해 뒤 콘텐츠가 비칠 때 헤더는 비치는데 버튼만 꽉 찬 불투명으로 남았다. 같은 헤더 영역 안에서 재질이 둘로 갈라져 보였다. 미세하지만 이런 불일치 하나하나가 사용자 경험을 해친다.
- 목적: Write 버튼이 헤더와 같은 반투명 톤으로 어우러지면서도, 그림자로 "누를 수 있는 버튼"임은 유지되는 상태.
- 이유: 버튼 배경을 `rgba(255,255,255,0.45)`로 바꿔 헤더와 재질을 통일했다. 단 `backdrop-filter`(blur)는 쓰지 않았다. 0081에서 "흰 배경 위에서는 blur가 비칠 내용이 없어 글래스 효과가 성립하지 않는다"를 배웠으므로, blur 대신 알파 합성을 택했다. 45% 불투명 흰색이라 뒤 배경 톤이 그대로 비쳐, 밝은 배경에선 밝게·어두운 요소가 지나가면 톤이 살짝 어두워지는 식으로 자연히 어우러진다. inset 하이라이트(상단 흰색)와 그림자로 입체감은 유지했다.

### "적응형"의 의미

- 왜: 커밋 이름에 "적응형"을 썼으나, 능동적으로 환경을 감지해 바뀌는 처리는 아니다. 용어를 정확히 정리해 둘 필요가 있다.
- 목적: "적응형"이 무엇을 뜻하는지 코드 근거로 명확히 한다.
- 이유: `btn-soft`에는 JS 감지나 미디어쿼리 분기가 없다. 반투명(알파 0.45)이라 뒤 배경이 비치는 결과로 톤이 어우러질 뿐이다. 즉 능동(active) 적응이 아니라 패시브(passive) 적응 — 반투명 합성의 자연스러운 부산물이다.

## 3. 작성한 프롬프트

```
[배경]
0110 회고 작성용. 커밋 f584455 "Write 버튼 반투명 적응형 배경 적용"의 실제 변경 확인.

[목표] 읽고 보고만:
1. git show f584455 --stat 으로 변경 파일
2. git show f584455 로 실제 diff — Write 버튼 배경을 어떻게 바꿨는지
3. "적응형"이 코드로 무엇을 의미하는지

[하지 말 것]
❌ 수정 금지 — git show로 읽고 보고만.
❌ 추측 금지 — 실제 diff 기준으로.

[보고] 변경 파일 + 실제 diff + "적응형"의 의미.
```

## 4. 코드 작성 & 수정

### 클래스 교체 (두 layout 동일)

```tsx
// app/(protected)/layout.tsx, app/story/layout.tsx
// Write 버튼 <Link href="/story/new">

// before
className="btn-elevated flex items-center px-4 py-1.5 text-slate-600 text-sm"
// after
className="btn-soft flex items-center px-4 py-1.5 text-slate-600 text-sm"
```

### .btn-soft 신규 정의

```css
/* app/globals.css */
.btn-soft {
  position: relative;
  background: rgba(255, 255, 255, 0.45);   /* 반투명 — blur 없이 알파 합성 */
  border-radius: 9999px;
  overflow: hidden;
  isolation: isolate;                       /* 자기 stacking context — 합성 안정화 */
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 2px 6px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9), /* 상단 흰색 highlight */
    inset 0 -1px 1px rgba(0, 0, 0, 0.06);
  transition: transform .55s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow .55s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-soft:hover {
  transform: translateY(-3px);
}

.btn-soft:active {
  transform: scale(0.96);
  transition-duration: .1s;
}
```

### 헤더도 같이 조정 (영역 통일감)

```css
/* app/globals.css — .glass-header */
/* before: background: rgba(255, 255, 255, 0.7); */
background: rgba(255, 255, 255, 0.6);          /* 더 투명하게 */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);    /* 헤더-본문 경계 부드럽게 */
```

## 5. 결과 / 배운점

- 스크롤 시 헤더와 Write 버튼이 같은 반투명 톤으로 어우러지면서, 버튼만 떠 보이던 이질감이 사라졌다.
- 시각적 일관성: 한 영역(헤더) 안에서 재질이 갈라지면 미세한 이질감이 UX를 해친다. "버튼을 튀게 하는 것"이 항상 좋은 UX는 아니고, 영역 안에서 톤이 일관된 것이 더 자연스럽다. 0081이 "구분"을 목표로 했다면 0110은 "통일"을 목표로 한 셈이다.
- 기술 선택: 0081의 교훈(흰 배경에선 blur가 무력) 위에서, 적응형 반투명을 `backdrop-filter`가 아닌 알파 합성으로 구현했다. 같은 "반투명"이라도 blur(글래스)와 알파 합성은 다른 도구이고, 배경 조건에 따라 무엇이 맞는지 달라진다.
- 용어: "적응형"은 능동 감지가 아니라, 반투명 합성으로 뒤 배경에 자연히 어우러지는 패시브 적응이다. 커밋·회고에서 용어를 결과 기준으로 정확히 쓴다.
