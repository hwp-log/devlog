# 0054 회고: addSpot 코어 함수 추출

- 작성일: 2026-05-30
- 소요: 약 20분
- 관련 커밋: refactor: 0054 addSpot 코어 함수 추출

## 1. 한 줄 요약

마커 만드는 로직을 `handleSaveSpot` 안에서 떼어내, 어디서든 좌표·이름만 넘기면 호출할 수 있는 `addSpot` 공용 함수로 분리했다.

## 2. 왜 / 목적 / 이유

### 마커 추가 로직을 공용 함수로 추출

- **왜**: 곧 마커 추가 입구가 여러 개로 늘어난다 (지도 직접 클릭 + 촬영지 검색 결과 클릭). 근데 기존 `handleSaveSpot`은 `selectedCoord`·`inputName` 같은 화면 상태(state)에 묶여 있어서, 다른 입구에서 가져다 쓸 수가 없었다.
- **목적**: 좌표와 이름을 인자로 받는 함수 하나를 만들어, 어느 입구든 `addSpot(이름, 경도, 위도)` 한 줄로 마커를 추가할 수 있는 상태.
- **이유**: 입구마다 똑같은 마커 생성 코드를 복사하면 나중에 한 곳만 고쳐도 나머지가 어긋난다. 공용 함수로 모아두면 추가 규칙이 한 군데에만 있어, 입구가 몇 개든 동작이 일관된다. (이번 작업은 동작을 바꾸지 않는 순수 리팩토링이라 커밋 타입도 `feat`이 아니라 `refactor`.)

## 3. 작성한 프롬프트

```
[배경]
검색 추가 기능을 얹기 전 토대 리팩토링. 순수 리팩토링이라 화면 동작은 그대로 유지.
기존 handleSaveSpot은 selectedCoord/inputName state에 묶여 재사용 불가.

[목표]
addSpot(name, lng, lat): string 추출 — tmp_ ID 생성·LocalSpot 추가·onSpotsChange 호출·새 id 반환.
handleSaveSpot은 addSpot 호출 형태로 변경. tmp_ 전략·order·transition 흐름 유지.

[하지 말 것]
UI 변경 ❌ / 동작 변경 ❌ / onSpotsChange·LocalSpot·트랜잭션 흐름 변경 ❌

[검수 모드]
★★★ 아키텍처. "기존과 동작 동일"이 검증 핵심.
작성·수정 두 경로에서 order 부여 정상인지 plan에 포함. plan 요청.
```

## 4. 코드 작성 & 수정

```typescript
// components/SpotMap.tsx

// [추가] 좌표·이름을 인자로 받는 공용 함수
function addSpot(name: string, lng: number, lat: number): string {
  const id = `tmp_${crypto.randomUUID()}`;
  const newSpot: LocalSpot = {
    id, name, lat, lng,
    order: localSpots.length + 1,
  };
  const next = [...localSpots, newSpot];
  setLocalSpots(next);
  onSpotsChange?.(next);
  return id;   // 0055에서 "추가 직후 편집 진입"에 쓸 id
}

// [변경] handleSaveSpot은 검증 + addSpot 호출만 남김
function handleSaveSpot() {
  if (!selectedCoord || !inputName.trim()) return;
  startSpotTransition(() => {
    addSpot(inputName.trim(), selectedCoord.lng, selectedCoord.lat);
    exitAddMode();
  });
}
```

## 5. 결과 / 배운 것

- 작성·수정 두 페이지에서 마커 추가가 기존과 동일하게 동작함을 확인. order(방문 순서 번호)도 정상 부여.
- **배운 것**: "함수 추출"은 지금 당장 여러 곳에서 쓰여서가 아니라, **곧 여러 입구가 생길 걸 예상하고 미리** 할 수도 있다. 핵심은 "재사용 가능한 형태로 만들어두기" — state에 묶인 함수는 그 화면에서만 살 수 있지만, 인자로 받는 함수는 어디서든 부를 수 있다.
- 반환값(`id`)처럼 지금은 안 쓰지만 다음 단계를 위해 미리 터놓는 설계도 함께.
