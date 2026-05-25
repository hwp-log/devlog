# 0046b 회고: Spot 마커 추가 인터랙션 + 초기 줌 갈음

- **작성일**: 2026-05-25
- **소요 시간**: 약 27분
- **관련 커밋**: `4138267` feat: 0046b Spot 마커 추가 인터랙션

---

## 1. 한 줄 요약

지도 클릭 → Mapbox Popup + 인라인 폼 동기화 → createSpot 서버 액션 → 새 마커 인터랙션 완성. SpotMap 내부 통합 구조 + stale closure 해결 패턴 적용. 커밋 1개 atomic.

---

## 2. 왜 / 목적 / 이유

### 왜

0046에서 지도 렌더링 + 2D/3D 토글 완료. 0045에서 Spot 테이블 + RLS 완료. 시각화 그릇과 데이터 구조는 준비됐지만 사용자가 직접 마커를 추가하는 인터랙션이 없어 실제 데이터 입력이 불가능한 상태.

### 목적

- 사용자가 수정 페이지에서 지도 클릭 → 좌표 캡처 → 이름 입력 → DB 저장 흐름 완성
- 0047 폴리라인의 기반 마커 데이터 축적
- Mapbox Popup + React 컴포넌트 통합 패턴 학습

### 이유

- **SpotMap 내부 통합**: selectedCoord state + 인라인 폼을 SpotMap 안에 적용. 단일 책임 원칙보다 응집도 우선. 0048 드래그/삭제 확장 시 한 파일에서 작업 가능
- **Popup + 인라인 폼 동시 활성화**: Popup = 위치 확인 (지도 위 시각), 인라인 폼 = 입력 (지도 아래 폼). 두 UI가 selectedCoord state를 공유해 자연스럽게 동기화
- **stale closure 해결 = ref 패턴**: useEffect [] 의존성 안에 map.on('click') 등록 → isAddMode 최신값을 addModeRef로 동기화
- **저장 후 갱신 = key={spots.length} 리마운트**: revalidatePath → 부모로부터 fresh spots 도착 → spots.length 변화 → SpotMap 리마운트
- **신규 작성 페이지 = canAddSpot 비활성**: storyId 없으므로 마커 추가 불가, 별도 안내 처리 불필요
- **초기 줌 12 → 16**: 빌딩이 입체로 보이는 상태에서 시작해 시각적 임팩트 확보

---

## 3. 작성한 프롬프트

```
# 0046b Spot 마커 추가 인터랙션 + 초기 줌 갈음

## 배경
0046에서 지도 렌더링 + 2D/3D 토글 완료. 이제 사용자가 지도에 직접 마커를 추가하는
인터랙션 진행. 컴포넌트 확장 자리는 0046에서 준비됨
(onMapClick, onSpotClick, interactive props).

## 목표
1. 초기 줌 레벨 12 → 16 갈음 (빌딩 입체로 보이는 상태)
2. SpotMap에 "마커 추가" 모드 토글 버튼 추가 (지도 우측 상단)
3. 모드 진입 시 지도 클릭 → 좌표 캡처
   - Mapbox Popup으로 좌표 표시 (위치 확인용, 닫기 가능)
   - 동시에 인라인 폼에 좌표 표시 + 입력칸 활성화 (입력용)
4. 인라인 폼에서 이름 입력 → createSpot 서버 액션 → DB 저장
5. 저장 성공 → Popup 닫힘 + 새 마커 추가 + 모드 종료 + 폼 초기화

## 컴포넌트 확장
components/SpotMap.tsx
- onMapClick prop 활용 (모드 진입 시에만 호출)
- interactive prop 활용 (모드 활성 표시용)
- 새 prop: storyId (서버 액션 호출 필요)
- 초기 zoom: 16 (12에서 갈음)

## 두 UI 동기화 패턴
공통 React state로 selectedCoord 관리:
- 지도 클릭 → setSelectedCoord({ lng, lat })
- Popup이 selectedCoord 읽어서 표시
- 인라인 폼이 selectedCoord 읽어서 표시
- 저장 또는 취소 → setSelectedCoord(null) → 둘 다 초기화

## Mapbox Popup 구현
- new mapboxgl.Popup({ closeButton: true, closeOnClick: false })
- setLngLat + setHTML로 좌표만 표시 (입력칸 없음, 위치 확인용)
- 모드 종료 시 popup.remove()

## 새 파일
app/story/[id]/spots/actions.ts
- 'use server'
- createSpot(storyId, { name, lng, lat })
  - 인증 확인 (auth.uid())
  - Story 소유자 검증 (다른 사람 story에 spot 추가 차단)
  - order = 기존 spots 개수 + 1 (자동 계산)
  - prisma.spot.create
  - revalidatePath(`/story/${storyId}`)

## 인라인 폼 위치
- Story 작성/수정 페이지: SpotMap 바로 아래에 폼 위치
- Story 상세 페이지: 폼 없음 (읽기 전용, 작성자만 추가 가능 별도 처리)

## 하지 말 것
- ❌ 마커 삭제 (0048 범위)
- ❌ 드래그 정렬 (0048 범위)
- ❌ 사진 업로드 (0049 범위)
- ❌ 폴리라인 (0047 범위)
- ❌ Popup에 사진/이름/설명 (0047 이후 범위, 지금은 좌표만)
- ❌ Optimistic UI (0048 또는 별도)
- ❌ Co-Authored-By

## 검수 모드 (★★★★★ 보안 + 외부 라이브러리)
1. createSpot에서 Story 소유자 검증 = 명시적 조회
2. order 자동 계산 = 기존 spots 개수 기반
3. 모드 토글 = useState로 관리, 모드 OFF 시 클릭 무시
4. Popup cleanup = 모드 종료 + 컴포넌트 언마운트 시 popup.remove()
5. 인라인 폼 = SpotMap 내부에 적용 (응집도 우선)
6. createSpot 호출 후 revalidatePath로 spots 갱신
7. NEXT_PUBLIC_MAPBOX_TOKEN 동일 (재발급 불필요)
```

플랜 검토 중 추가된 수정 사항:
- Claude Code 초기 제안(selectedCoord = StoryWriteForm 외부) → 사용자 결정으로 SpotMap 내부 통합으로 갈음
- `canAddSpot` prop 추가 (신규 작성 페이지에서 버튼 미노출)
- `key={spots.length}` 리마운트 패턴 결정

---

## 4. 코드 작성 & 수정

### 변경 파일 (4개)

1. `components/SpotMap.tsx` (수정) — state 5개 + Popup + 인라인 폼 + createSpot 호출 추가
2. `app/story/[id]/spots/actions.ts` (신규) — createSpot 서버 액션
3. `app/story/new/StoryWriteForm.tsx` (수정) — storyId prop 추가 + SpotMap 호출 갈음
4. `app/story/[id]/edit/page.tsx` (수정) — StoryWriteForm에 storyId 전달

### 커밋 1개

```
4138267 feat: 0046b Spot 마커 추가 인터랙션
4 files changed, 153 insertions(+), 15 deletions(-)
create mode 100644 app/story/[id]/spots/actions.ts
```

### 핵심 코드

**app/story/[id]/spots/actions.ts** (신규) — 서버 액션

```typescript
'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function createSpot(
  storyId: string,
  data: { name: string; lng: number; lat: number }
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인이 필요합니다' };

  const story = await prisma.story.findUnique({ where: { id: storyId } });
  if (!story || story.userId !== user.id) return { error: '권한이 없습니다' };

  const spotCount = await prisma.spot.count({ where: { storyId } });

  await prisma.spot.create({
    data: { storyId, name: data.name, lng: data.lng, lat: data.lat, order: spotCount + 1 },
  });

  revalidatePath(`/story/${storyId}`);
  revalidatePath(`/story/${storyId}/edit`);
  return { ok: true };
}
```

설계 결정:
- 인증(getUser) → 소유권 검증(story.userId !== user.id) → order 자동 계산(spotCount + 1) → create → revalidatePath 2개 순서
- 에러 메시지 모호화("권한이 없습니다") → Story 존재 여부를 가려서 정보 누출 방지
- revalidatePath 2개 = 상세 페이지 + 수정 페이지 양쪽 캐시 갱신
- Discriminated Union 반환 타입(`{ error } | { ok: true }`) → 호출처에서 `'error' in result` 분기

**components/SpotMap.tsx** — stale closure 해결 + Popup + 인라인 폼

```typescript
// stale closure 방지
const addModeRef = useRef(false);
useEffect(() => { addModeRef.current = isAddMode; }, [isAddMode]);

useEffect(() => {
  // ...지도 초기화...
  map.on('click', (e) => {
    if (!addModeRef.current) return;  // ref로 최신값 읽음
    const { lng, lat } = e.lngLat;
    setSelectedCoord({ lng, lat });

    popupRef.current?.remove();
    popupRef.current = new mapboxgl.Popup({ closeButton: true, closeOnClick: false })
      .setLngLat([lng, lat])
      .setHTML(`<p style="font-size:12px;margin:0;color:#1e293b">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>`)
      .addTo(map);
  });
  // ...
  return () => {
    popupRef.current?.remove();  // 언마운트 cleanup
    popupRef.current = null;
    // 마커 + 지도 cleanup
  };
}, []); // 마운트 1회

function exitAddMode() {
  setIsAddMode(false);
  setSelectedCoord(null);
  setInputName('');
  setSpotError('');
  popupRef.current?.remove();  // 모드 종료 cleanup
  popupRef.current = null;
}

function handleSaveSpot() {
  if (!selectedCoord || !storyId || !inputName.trim()) return;
  startSpotTransition(async () => {
    const result = await createSpot(storyId, { name: inputName.trim(), ...selectedCoord });
    if ('error' in result) { setSpotError(result.error); return; }
    exitAddMode();
  });
}
```

설계 결정:
- `addModeRef` = useEffect [] 의존성 안에서 isAddMode 최신값 읽기용. ref 패턴 표준
- Popup cleanup 2곳 = 언마운트(useEffect return) + 모드 종료(exitAddMode) 양쪽 필수
- useTransition = 저장 중 pending 상태 관리 + 비동기 흐름 제어
- Enter 키 저장 + e.preventDefault() = outer form submit 방지

**SpotMap JSX** — 버튼 스택 + 인라인 폼 디자인

```typescript
// 마커 추가 버튼 (활성/비활성 시각 강조)
<button
  type="button"
  onClick={() => (isAddMode ? exitAddMode() : setIsAddMode(true))}
  className={`text-xs font-medium px-3 py-1.5 rounded-lg shadow-md transition-colors ${
    isAddMode
      ? 'bg-sky-500 text-white hover:bg-sky-600'
      : 'bg-white/90 backdrop-blur-sm text-slate-700 hover:bg-white'
  }`}
>
  {isAddMode ? '완료' : '마커 추가'}
</button>

// 인라인 폼 (글래스 톤)
{isAddMode && selectedCoord && (
  <div className="bg-white/90 backdrop-blur-sm border border-black/10 rounded-xl px-4 py-3 flex flex-col gap-2 shadow-sm">
    <p className="text-xs text-slate-500">
      위도 {selectedCoord.lat.toFixed(5)}, 경도 {selectedCoord.lng.toFixed(5)}
    </p>
    <div className="flex gap-2">
      <input
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveSpot(); } }}
        placeholder="장소 이름 (예: 후암동 오리올)"
        className="flex-1 border-[0.5px] border-black/15 rounded-[10px] ..."
      />
      <button
        type="button"
        onClick={handleSaveSpot}
        disabled={spotPending || !inputName.trim()}
      >
        {spotPending ? '저장 중...' : '저장'}
      </button>
      <button type="button" onClick={exitAddMode}>취소</button>
    </div>
    {spotError && <p className="text-xs text-red-600">{spotError}</p>}
  </div>
)}
```

**StoryWriteForm.tsx + edit/page.tsx**

```diff
// StoryWriteForm.tsx
+ storyId?: string;
- export function StoryWriteForm({ action, initialData, userId, spots = [] }: StoryWriteFormProps) {
+ export function StoryWriteForm({ action, initialData, userId, spots = [], storyId }: StoryWriteFormProps) {
- <SpotMap spots={spots} />
+ <SpotMap key={spots.length} spots={spots} storyId={storyId} canAddSpot={!!storyId} />

// edit/page.tsx
+ storyId={story.id}
```

---

## 5. 결과 / 배운점

### 결과

- 수정 페이지에서 마커 추가 인터랙션 정상 작동 확인 (마커 1, 2 추가 테스트)
- Popup + 인라인 폼 동기화 확인 (좌표 표시 일치)
- 저장 후 자동 갱신 확인 (key={spots.length} 리마운트)
- 권한 검증 작동 (소유자만 추가 가능)
- 2D/3D 토글 + 마커 표시 정상 (Production 배포 확인)
- pnpm tsc --noEmit 통과
- 작업 시간 27분 = 0046(약 1시간 30분) 대비 3배 빠름 → 학습 자산 축적 효과

### 함정

**1. Mapbox Popup + React 통합 패턴**
- 원인: Mapbox Popup은 vanilla JS API라 React state 변화를 자동 감지하지 못함.
- 해결: useRef로 popup 인스턴스 추적 + 좌표 변경 시 기존 popup remove 후 새로 생성.
- 학습: vanilla JS 라이브러리의 동적 UI를 React에 통합할 때 ref 패턴 + 명시적 cleanup이 표준.

**2. stale closure 함정**
- 원인: useEffect [] 의존성 안에 map.on('click') 핸들러 등록 시 클로저가 isAddMode 초기값(false)에 고정됨. 모드 진입 후 클릭해도 핸들러는 항상 false로 인식.
- 결과: 마커 추가 모드가 작동하지 않을 함정 (plan 단계에서 사전 방지).
- 해결: addModeRef로 최신값 동기화. ref 패턴 = React 클로저 함정의 표준 해결책.
- 학습: useEffect 의존성 배열이 []인 핸들러 안에서 state를 읽어야 할 때는 ref 패턴 필수.

**3. import 경로 `[id]` 처리**
- 우려: `import { createSpot } from '@/app/story/[id]/spots/actions';` 경로의 `[id]`를 TypeScript/Webpack이 정상 처리할지 불확실.
- 결과: pnpm tsc --noEmit 통과 + Vercel 빌드 통과 → 정상 작동.
- 학습: Next.js 동적 라우트 폴더(`[id]`) = TypeScript paths(`@/`) 기반 import 경로로도 정상 작동.

### 배운점

**1. 검수 등급별 깊이 차등 적용 효과 검증**
- 단계 1 (zoom 갈음) = ★ 무검수
- 단계 2 (createSpot) = ★★★★★ 줄 단위 검수 (소유권 검증 + order 자동 계산 + revalidatePath 2개)
- 단계 3 (SpotMap) = ★★★★ 줄 단위 검수 (stale closure + Popup cleanup + 디자인)
- 단계 4 (prop 전달) = ★ 무검수
- 단계 5 (빌드 + 커밋) = ★★ 결과 확인만
- 등급별 차등 적용 결과 = 27분에 완성, 함정 0개.

**2. SpotMap 내부 통합 vs StoryWriteForm 외부 분리 트레이드오프**
- Claude Code 초기 제안 = StoryWriteForm 외부 분리 (단일 책임 원칙)
- 사용자 결정 = SpotMap 내부 통합 (응집도)
- 결과 = SpotMap이 도메인 의존성(createSpot import)을 갖게 됐지만, 사용자 흐름(지도 → 폼)이 한 단위라 응집도가 단일 책임보다 가치. 0048 확장 시 한 파일에서 작업 가능한 이점.

**3. Mapbox 클릭 핸들러 등록 패턴**
- map.on('click')은 map 초기화 useEffect 안에 함께 등록해야 map 인스턴스 접근 가능.
- 이 때문에 stale closure 문제가 발생하고, ref 패턴이 불가피.
- 패턴 고정: vanilla JS 이벤트 핸들러 → ref로 최신 state 동기화 → 핸들러는 ref.current 읽기.

### 면접 답변 재료

- "vanilla JS 라이브러리(Mapbox)와 React state를 어떻게 동기화했나요?" → useRef로 Mapbox 인스턴스 추적 + useEffect [] 안에 핸들러 등록 + stale closure 방지를 위한 ref 패턴(addModeRef).
- "useEffect 의존성 배열이 []인 핸들러에서 최신 state를 읽으려면?" → ref 패턴. useState + useRef 두 개를 함께 사용하고 useEffect로 동기화. 핸들러는 ref.current로 최신값 읽음.
- "Server Action에서 보안 검증을 어떻게 했나요?" → getUser로 인증 → Story 조회 + userId 비교로 소유권 검증 → 에러 메시지 모호화로 정보 누출 방지.
- "revalidatePath를 여러 개 호출한 이유?" → 같은 데이터가 여러 페이지에서 조회되면 모든 경로 갱신 필요. 상세 + 수정 페이지 둘 다 spots를 조회하므로 각각 적용.
- "단일 책임 원칙 vs 응집도 트레이드오프?" → SpotMap이 도메인 책임(createSpot)을 갖게 됐지만, 사용자 흐름(지도 → 폼)이 한 단위라 응집도 우선. 0048 드래그/삭제 확장 시 한 파일에서 작업 가능한 이점.
- "key prop으로 컴포넌트 강제 리마운트한 이유?" → useEffect [] 의존성 안에서 spots 변경 감지 불가. revalidatePath → 부모로부터 fresh spots 도착 → spots.length 변화 → key 변화 → 리마운트로 마커 전체 재렌더링.

---

## 결정 (Decisions)

- **SpotMap 내부 통합**: selectedCoord + 인라인 폼을 SpotMap 안에 적용. 응집도 우선.
- **stale closure = ref 패턴**: addModeRef로 최신 isAddMode 동기화.
- **key={spots.length} 리마운트**: revalidatePath 후 자동 갱신.
- **canAddSpot = !!storyId**: 신규 작성 페이지(storyId 없음) = 마커 추가 불가.
- **초기 줌 12 → 16**: 빌딩 입체로 보이는 상태에서 시작.

---

## 다음 작업

```
0047 = 폴리라인 (좌표만)
  - Mapbox Directions API로 마커 사이 도로 곡선 (driving 프로필)
  - GeoJSON LineString + map.addLayer (amber-400, line-width 4)
  - 출발(0번) = 초록, 도착(마지막) = 빨강, 경유 = 파랑 (sky-500) 분기
  - spots.length < 2면 폴리라인 생략

0048 = 드래그 정렬 + 번호 갱신
  - DnD 라이브러리 도입 (dnd-kit 또는 react-beautiful-dnd 검토)
  - 마커 순서 갱신 → order 갱신 (트랜잭션)
  - 드래그 끝나면 자동 저장 + 폴리라인 즉시 반영
  - key={spots.length} → key={spots.map(s=>s.id).join(',')} 갈음 검토

0049 = 사진 업로드
  - Supabase Storage story-photos 버킷 재활용 ({userId}/spot/...)
  - Spot 테이블 photoUrl 컬럼 추가 마이그레이션
  - 마커 클릭 시 Popup에 사진 + 이름 표시
```
