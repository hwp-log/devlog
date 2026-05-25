# 0046 회고: Mapbox 지도 렌더링 + 2D/3D 토글

- **작성일**: 2026-05-25
- **소요 시간**: 약 3시간
- **관련 커밋**: 1개
  - `2a6102e` feat: 0046 Mapbox 지도 렌더링 + 2D/3D 토글

---

## 1. 한 줄 요약

Mapbox GL JS v3를 도입해 Story 상세/작성/수정 페이지에 Spot 마커 지도 렌더링 + 2D/3D 토글 버튼 추가. SSR 제한 우회를 위한 SpotMapWrapper(dynamic ssr:false) 패턴 확립. 커밋 1개 atomic.

---

## 2. 왜 / 목적 / 이유

### a) Mapbox GL JS = 촬영지 시각화 핵심

- **왜**: 0045에서 Spot 테이블을 추가했지만 실제 UI에서 좌표 데이터를 볼 수 없음.
- **목적**: Story 안의 Spot들을 번호 마커로 시각화해 촬영지의 위치 맥락을 즉시 전달.
- **이유**: 텍스트 주소보다 지도 마커가 공간 정보를 직관적으로 전달함. Mapbox Standard 스타일은 3D 빌딩 렌더링을 기본 지원해 MVP에서도 시각적 품질 확보 가능.

### b) 2D/3D 토글 = pitch 조작

- **왜**: 기본 pitch 60도(3D)가 기본이지만 평면 지도가 필요한 경우도 있음.
- **목적**: 버튼 하나로 pitch 60° ↔ 0° 전환 제공.
- **이유**: `easeTo({ pitch, duration: 1000 })` 한 줄로 구현 가능. 별도 스타일 변경 없이 부드러운 전환 효과.

### c) SpotMapWrapper = SSR 제한 우회

- **왜**: Mapbox GL JS는 브라우저 전용 API(`window`, `WebGL`)에 의존해 SSR에서 실패함.
- **목적**: Next.js App Router의 Server Component에서 안전하게 지도 컴포넌트를 포함할 수 있는 경계 확립.
- **이유**: `dynamic({ ssr: false })`는 Client Component 안에서만 사용 가능. Server Component에서 직접 사용 시 Next.js 빌드 에러. Wrapper 패턴으로 Server ↔ Client 경계 명확히 분리.

---

## 3. 작성한 프롬프트

```
[배경]
0045에서 Spot 테이블 + RLS 추가 완료.
Story 상세/작성/수정 페이지에 Spot 마커 지도를 보여줘야 함.
Mapbox GL JS v3 (mapbox-gl 패키지) 사용.

[목표]
1. SpotMap.tsx 컴포넌트 작성 (mapboxgl.Map + Marker)
   - spots: Spot[] prop으로 마커 표시
   - 2D/3D 토글 버튼 (pitch 60 ↔ 0)
   - Mapbox Standard 스타일 + lightPreset: 'dusk'
2. SpotMapWrapper.tsx 작성 (dynamic ssr:false 래퍼)
3. app/story/[id]/page.tsx — spots 포함 + 지도 렌더링
4. app/story/new/StoryWriteForm.tsx — spots prop + 지도 렌더링
5. app/story/[id]/edit/page.tsx — spots 포함 + StoryWriteForm에 전달
6. pnpm tsc --noEmit 통과 확인

[하지 말 것]
- 마커 추가 UI (클릭 → 좌표 저장) ← 0046b 범위
- Spot CRUD 서버 액션 ← 0046b 범위
- Co-Authored-By 커밋 메시지

[검수 모드 ★★★★]
- mapboxgl.Map에 interactive 옵션 전달하지 않을 것 (zoom/pan 차단 위험)
- SSR boundary: dynamic({ ssr: false })는 Client Component 안에서만
- NEXT_PUBLIC_MAPBOX_TOKEN 접두사 확인 (pk. 토큰만, sk. 금지)
- useEffect cleanup: map.remove() + markers clear 확인
```

플랜 검토 중 추가된 수정 사항:
- `interactive` prop을 `mapboxgl.Map` 생성자에 전달하는 코드 제거 (사용자 발견)
- Server Component에서 `dynamic({ ssr: false })` 직접 사용 → SpotMapWrapper 분리 패턴으로 수정
- `prisma generate` 미실행으로 `story.spots` 타입 `never` → generate 추가

---

## 4. 코드 작성 & 수정

### 변경 파일 (5개)

1. `components/SpotMap.tsx` (신규) — Mapbox 지도 컴포넌트
2. `components/SpotMapWrapper.tsx` (신규) — SSR 제한 우회 래퍼
3. `app/story/[id]/page.tsx` (수정) — spots include + 지도 렌더링
4. `app/story/new/StoryWriteForm.tsx` (수정) — spots prop + 지도 렌더링
5. `app/story/[id]/edit/page.tsx` (수정) — spots include + prop 전달

### 커밋 1개

```
2a6102e feat: 0046 Mapbox 지도 렌더링 + 2D/3D 토글
  - components/SpotMap.tsx
  - components/SpotMapWrapper.tsx
  - app/story/[id]/page.tsx
  - app/story/new/StoryWriteForm.tsx
  - app/story/[id]/edit/page.tsx
```

### 핵심 코드

**components/SpotMap.tsx** — Mapbox 지도 + 마커 + 2D/3D 토글

```typescript
'use client';
import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Spot } from '@prisma/client';

// interactive prop: 0046b에서 onMapClick 호출 여부 제어용. mapboxgl.Map의 interactive 옵션과는 무관.
type Props = {
  spots: Spot[];
  initialCenter?: [number, number];
  interactive?: boolean;
  onSpotClick?: (spot: Spot) => void;
  onMapClick?: (lng: number, lat: number) => void;
};

export default function SpotMap({ spots, initialCenter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [is3D, setIs3D] = useState(true);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!containerRef.current || !token) return;
    mapboxgl.accessToken = token;
    const center: [number, number] = spots.length > 0
      ? [spots[0].lng, spots[0].lat]
      : (initialCenter ?? [126.978, 37.566]);
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/standard',
      center, zoom: 12, pitch: 60,
    });
    map.on('style.load', () => {
      map.setConfigProperty('basemap', 'lightPreset', 'dusk');
    });
    spots.forEach((spot, i) => {
      const el = document.createElement('div');
      el.textContent = String(i + 1);
      Object.assign(el.style, {
        width: '28px', height: '28px', borderRadius: '50%',
        background: '#0ea5e9', color: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: 'bold',
        border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', cursor: 'default',
      });
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([spot.lng, spot.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({ pitch: is3D ? 60 : 0, duration: 1000 });
  }, [is3D]);

  if (!token) {
    return (
      <div className="w-full h-[400px] rounded-xl bg-slate-100 flex items-center justify-center text-sm text-slate-500">
        지도를 표시하려면 Mapbox 토큰이 필요합니다.
      </div>
    );
  }
  return (
    <div className="relative w-full h-[400px] rounded-xl overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      <button
        type="button"
        onClick={() => setIs3D((prev) => !prev)}
        className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg shadow-md hover:bg-white transition-colors"
      >
        {is3D ? '2D' : '3D'}
      </button>
    </div>
  );
}
```

**components/SpotMapWrapper.tsx** — SSR 제한 우회 래퍼

```typescript
'use client';
import dynamic from 'next/dynamic';

const SpotMap = dynamic(() => import('./SpotMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] rounded-xl bg-slate-100 animate-pulse" />
  ),
});

export default SpotMap;
```

설계 결정:
- `SpotMapWrapper`에 `'use client'` 필수 — `dynamic({ ssr: false })`는 Client Component 경계 안에서만 동작
- Server Component(`app/story/[id]/page.tsx` 등)에서 Wrapper를 import하면 SSR 경계 자동 설정
- SpotMap 자체도 `'use client'`지만 Wrapper 없이 Server Component에서 직접 import 시 빌드 에러 발생

---

## 5. 결과 / 배운점

### 결과

- Story 상세/작성/수정 페이지에 Mapbox 지도 + 번호 마커 렌더링 완료
- 2D/3D 토글 버튼 동작 확인 (pitch 60° ↔ 0°, easeTo 1초 전환)
- `pnpm tsc --noEmit` 통과
- Vercel 배포 완료 + `NEXT_PUBLIC_MAPBOX_TOKEN` 환경변수 추가 후 재배포로 지도 렌더링 확인

### 함정

**1. `prisma generate` 미실행 → `story.spots` 타입 `never`**
- 원인: 0045에서 수동 마이그레이션 절차(`migrate diff → 폴더/파일 생성 → db execute → migrate resolve --applied → migrate status`) 완료 후 `prisma generate`를 실행하지 않음. Prisma Client가 새 Spot 모델을 인식하지 못한 상태.
- 결과: `story.spots`가 `never[]`로 추론되어 `'Property 'length' does not exist on type 'never''` 에러 발생.
- 해결: `pnpm prisma generate` 실행 후 타입 정상 인식.
- 학습: P3006 우회 절차(migrate diff → 폴더/파일 생성 → db execute → migrate resolve --applied → migrate status)에 prisma generate 단계 추가 필요. migrate dev는 자동 수행하지만 수동 절차는 명시 필요.

**2. `dynamic({ ssr: false })` = Server Component에서 직접 사용 불가**
- 원인: `app/story/[id]/page.tsx`(Server Component)에서 `SpotMap`을 직접 `dynamic({ ssr: false })`로 import 시도.
- 결과: Next.js 빌드 에러 — Server Component 안에서 `ssr: false` 금지.
- 해결: `SpotMapWrapper.tsx`(`'use client'`) 안에서 dynamic import를 수행하고, 모든 페이지에서 Wrapper를 import.
- 학습: `dynamic({ ssr: false })`는 Client Component 경계 안에서만 사용 가능. Wrapper 패턴 = 브라우저 전용 라이브러리를 App Router Server Component에서 안전하게 포함하는 표준 경계 설정 방법.

**3. zsh `[id]` 글로브 — git add 실패**
- 원인: `git add app/story/[id]/page.tsx` 실행 시 zsh가 `[id]`를 글로브 패턴으로 해석해 파일을 찾지 못함.
- 결과: `zsh: no matches found: app/story/[id]/page.tsx`
- 해결: 싱글 쿼트로 감싸기 → `git add 'app/story/[id]/page.tsx'`
- 학습: zsh에서 `[]`를 포함한 경로는 반드시 싱글 쿼트로 감싸야 함. Next.js 동적 라우트 경로 전체에 적용.

**4. `interactive` prop → `mapboxgl.Map` 생성자 전달 시 zoom/pan 차단**
- 원인: Props 타입에 정의된 `interactive` 필드가 `mapboxgl.Map` 생성자 옵션에 그대로 spread될 경우, Mapbox의 `interactive: false` 옵션이 활성화되어 사용자 인터랙션(줌, 패닝) 전체 차단.
- 결과: 지도가 정적으로 고정되고 사용자가 탐색 불가 (AI 자체 검수에서 미감지).
- 해결: `mapboxgl.Map` 생성자에 `interactive` 전달 코드 제거. Props 타입에는 0046b `onMapClick` 제어 용도로 유지.
- 학습: 외부 라이브러리 옵션과 같은 이름의 Props는 생성자에 전달 전 의도 확인 필수. ★★★★ 이상 파일은 AI 체크리스트 보고 신뢰하지 않고 직접 확인.

**5. `NEXT_PUBLIC_` 환경변수 = 빌드 시 인라인 → 재배포 필요**
- 원인: Vercel 대시보드에서 `NEXT_PUBLIC_MAPBOX_TOKEN`을 추가했지만 기존 빌드에는 반영되지 않음.
- 결과: 배포된 페이지에서 지도 미표시 (토큰 없음 fallback UI 노출).
- 해결: Vercel에서 환경변수 추가 후 재배포(Redeploy) 실행.
- 학습: `NEXT_PUBLIC_` 접두사 변수는 런타임이 아닌 빌드 시 번들에 인라인됨. 환경변수 추가/변경 후 반드시 재배포 필요. 서버사이드 환경변수(`process.env.XXX`)와 다른 점.

### 배운점

**1. 브라우저 전용 라이브러리 통합 = SpotMapWrapper 패턴**
- `useRef + useEffect` 조합으로 vanilla JS 라이브러리를 React 생명주기에 맞춤.
- cleanup 함수(`map.remove()`, markers clear)는 컴포넌트 언마운트 시 메모리 누수 방지에 필수.
- `dynamic({ ssr: false })`는 Client Component 경계에서만 가능 → Wrapper 패턴이 App Router 표준.

**2. 검수 등급별 깊이 차등 적용**
- 0045 ★★★★★: 4라운드, 함정 4개 (보안/마이그레이션)
- 0046 ★★★★: 6라운드, 함정 5개 (외부 라이브러리)
- 함정 수가 등급과 비례하지 않음. 0045는 도메인(보안) 함정, 0046은 통합(라이브러리/배포/환경) 함정으로 종류가 다름.
- 등급이 낮아도 통합 복잡도가 높으면 함정이 많이 발생함. 검수 깊이는 등급 + 통합 복잡도를 함께 고려해야 함.

**3. Mapbox Standard 스타일 = `style.load` 이후 setConfigProperty**
- `style.load` 이벤트 전에 `setConfigProperty` 호출 시 에러. 스타일 로드 완료 후 호출해야 함.
- `lightPreset: 'dusk'` = 야간 조명 효과. `'day'` / `'dawn'` / `'night'` 선택 가능.

### 면접 답변 재료

- "Mapbox를 React에 통합할 때 어떻게 했나요?" → `useRef + useEffect` 패턴. 컨테이너 ref를 `mapboxgl.Map`에 전달. cleanup에서 `map.remove()` + 마커 clear. SSR 방지는 `dynamic({ ssr: false })` + Client Component Wrapper.
- "Next.js App Router에서 브라우저 전용 라이브러리를 어떻게 처리했나요?" → SpotMapWrapper 패턴. `'use client'` 파일 안에서 `dynamic({ ssr: false })` 사용. Server Component에서는 Wrapper만 import.
- "`NEXT_PUBLIC_` 환경변수의 동작 방식을 설명해보세요." → 빌드 시 번들에 인라인됨. 런타임이 아닌 빌드 타임에 값이 결정되므로, 환경변수 추가/변경 후 재배포 필요. 서버사이드 `process.env.XXX`는 런타임 참조이므로 재배포 불필요.
- "2D/3D 토글을 어떻게 구현했나요?" → `easeTo({ pitch: is3D ? 60 : 0, duration: 1000 })`. 별도 스타일 변경 없이 카메라 각도만 조작. React state(`is3D`)와 `useEffect`로 동기화.

---

## 결정 (Decisions)

- **SpotMapWrapper 패턴**: `'use client'` 파일 안에서 `dynamic({ ssr: false })` 래핑. Server Component에서 브라우저 전용 라이브러리 포함 시 표준 경계 설정 방법.
- **Mapbox Standard + lightPreset 'dusk'**: 기본 스타일 선택. 3D 빌딩 + 야간 조명 효과 제공.
- **번호 마커**: Spot order 기반 1-based 번호 표시. 커스텀 `div` 엘리먼트 사용.
- **`NEXT_PUBLIC_MAPBOX_TOKEN` 재배포 주의**: 빌드 타임 인라인 변수이므로 Vercel 환경변수 추가 후 재배포 필요.

---

## 다음 작업

```
0046b = Spot 추가 UI (마커 클릭 → 좌표 저장)
  - SpotMap에 onMapClick 핸들러 활성화
  - 좌표 클릭 → Spot 이름 입력 모달
  - prisma.spot.create 서버 액션
  - Story 작성/수정 폼에서 Spot 목록 관리
  - 초기 줌 레벨 갈음 (zoom: 16, 빌딩이 입체로 보이는 상태)
```
