@AGENTS.md

# Claude Code 특화 규칙

공통 규칙은 `AGENTS.md` 참조. 이 파일은 Claude Code 전용 본질만 작성.

---

## 1. Plan Mode 적용 시점

4단계 사이클 중 Plan Mode 적용 규칙:

- **1차 바이브**: Plan Mode 사용 안 함 (기능 단위로 빠르게 진행)
- **2차 TDD-Green 작동 확인**: 테스트 영역만 Plan Mode 적용
- **3차 TDD 리팩토링**: Plan Mode 필수 (영역 → 플랜 → 컨펌 → 실행 → 검증)
- **4차 PR + 리뷰**: 변경 사항 요약 작성

---

## 2. "go" 명령어 흐름 (3차 TDD 리팩토링)

3차 리팩토링 시점에 사용자가 "go"라고 하면 다음 순서로 진행:

1. 다음 테스트 케이스 식별
2. 실패하는 테스트 작성 (Red)
3. 테스트 실행하여 실패 확인
4. 최소 구현 (Green)
5. 테스트 통과 확인
6. 리팩터링 (Refactor, 필요시)
7. 전체 테스트 실행

---

## 3. Code Classification & Intent Report

AI 코드 생성 후 다음 형식으로 분류 + 의도 보고한다.

**형식**:
```
생성된 코드:
- /path/to/file.ts (★★★★★ 등급명)
  → 검토 필수. 의도: [한 줄 설명]
- /path/to/another.tsx (★ 보일러플레이트)
  → 스킵 가능. 의도: [한 줄 설명]
```

**근거**:
- 사용자 시간 = 비즈니스 로직 검토에 집중
- 보일러플레이트 = AI에게 위임 가능
- AI 시대 = 외우는 능력 X / 판단 능력 O

> 검토 우선순위 등급 (★★★★★ ~ ★)은 `AGENTS.md` > `Review Priority` 참조.

---

## 4. @import 참조 규칙

이 파일 상단의 `@AGENTS.md`는 Claude Code의 `@import` 문법.

- 세션 시작 시 자동 로드됨
- 이후 이 파일 내용 추가됨
- 다른 AI 도구는 일반 텍스트로 처리