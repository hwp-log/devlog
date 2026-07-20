# 0298 회고: SpotFinder 모바일 시트 테마 토글 — 헤더 부재 화면 보강

**작성일**: 2026-07-20
**관련 커밋**: `7341413` feat: 0298 SpotFinder 모바일 시트에 테마 토글 추가 - 제목 행 우측, 데스크톱 lg:hidden 중복 방지

---

## 1. 한 줄 요약

SpotFinder 모바일 바텀시트 제목 행("총 N곳" 옆)에 기존 ThemeToggle(0293)을 배치 — HeaderGate로 헤더가 숨겨진 SpotFinder 모바일에만 없던 테마 토글을 보강. 시트 루트가 이미 lg:hidden이라 데스크톱 중복 없음, 로직·컴포넌트 무변 재사용.

---

## 2. 왜 / 목적 / 이유

- **왜**: 0293 토글은 헤더에 있는데, SpotFinder 모바일만 HeaderGate(`hidden lg:contents`)로 헤더를 통째 숨겨 유일하게 토글이 없었음. [사용자 확인 필요]
- **목적**: SpotFinder 모바일에도 테마 전환 수단 — 시트 제목 행 우측이 데스크톱 "칼럼 헤더 옆"과 위계 일치하는 자리.
- **이유**: ThemeToggle은 반응형 클래스 없는 순수 스위치라 무변 재사용. 탭바(4탭 폭 꽉 참·내비 전용)·플로팅(지도 위 요소 증가)은 기각, 시트 헤더성 영역이 완성도 훼손 최소.

---

## 3. 작성한 프롬프트

```
[배경]
SpotFinder 모바일에만 테마 토글 없음(HeaderGate 헤더 숨김). 시트 제목 행 우측
("총 N곳" 옆)에 테마 토글 추가. 데스크톱 트랙 스위치(0293)와 위계 일치.

[작업]
1. 시트 제목 행 우측에 ThemeToggle — 총 N곳 → 토글 순서, 모바일 전용
2. 폭 확인 (~380px 넘침 여부)
3. 고정 스택(SHEET_STACK_MAX_H) 안이라 peek/half 노출되는지

[하지 말 것]
데스크톱 중복 ❌ / ThemeToggle 로직 변경 ❌ / 다른 화면 헤더 토글 ❌ /
탭바 추가 ❌ / 커밋 ❌
```

---

## 4. 코드 작성 & 수정

### `components/SpotFinderMapNaver.tsx` — import + 제목 행 우측 그룹

```tsx
import { ThemeToggle } from '@/app/(protected)/_components/ThemeToggle';

// 제목 행 (:1171~) — 우측 그룹으로 "총 N곳" + 토글 묶음
<div className="flex items-center justify-between gap-2">
  <h1 className="min-w-0 text-base font-semibold ... break-keep">영화·드라마 촬영지 검색</h1>
  <div className="flex shrink-0 items-center gap-2.5">
    <span className="text-xs text-muted">총 {listSpots.length}곳</span>
    <ThemeToggle />
  </div>
</div>
```

- **min-w-0**: 우측 그룹 확대로 좁아진 폭에서 제목이 오버플로 대신 break-keep 줄바꿈(§5 320px 무스크롤).
- **lg:hidden 미부착**: 시트 루트(:1157)가 이미 `lg:hidden` — 토글은 데스크톱에서 구조적 미노출. 중복 클래스 불요(주석 명시).

---

## 5. 결과 / 배운점

### 결과
- 빌드 성공, `npm test` 기존 실패(6스위트/8테스트) 외 증가 없음.
- 폭 검산: 시트 px-4 기준 320px→콘텐츠 288px. 제목 176 + 우측 그룹 98(총 N곳 36+gap 10+토글 52) + gap 8 ≈ 282 < 288 — 무오버플로, 최악 시 제목 줄바꿈.
- 고정 스택 확인: 제목 행이 SHEET_STACK_MAX_H 래퍼(:1160) 안 → peek(72)·half(168) 양쪽에서 노출.
- 데스크톱 무중복: SpotFinder 데탑은 상단 헤더 토글(0293) 유지, 시트는 lg:hidden 조상으로 미렌더.
- 다른 화면 무변 — Story·PlanFinder 등 헤더 토글 미접촉.
- 브라우저 수동 확인 잔여(사용자): 360/390/320px에서 제목 행 넘침 없음, peek/half 노출, 토글 전환 동작, 데탑 시트 미노출.

### 배운점
- [사용자 확인 필요]

---

## 결정 (Decisions)

- **헤더 부재 화면(SpotFinder 모바일)의 토글 = 시트 제목 행** — 데스크톱 칼럼 헤더 옆과 같은 위계. 탭바(내비 전용·폭 포화)·플로팅(완성도) 기각.
- **조상이 이미 lg:hidden이면 하위에 중복 lg:hidden 안 붙임** — 구조적 미노출이 보장되므로 클래스 노이즈 회피(주석으로 근거 보존). 지시의 "왜"(데탑 중복 방지)는 조상 스코프로 이미 충족.
