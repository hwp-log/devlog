# 0050 회고: 지도 2D 기본 + 콘텐츠 폭 조정 + 글작성 UI 조정 + map 초기 줌 조정

**작성일**: 2026-05-27
**소요 시간**: 약 3시간 (멘토링 직후 진입 + 시각 검증 반복)
**관련 커밋**: 2f71d87 (feat: 0050 지도 2D 기본 + 콘텐츠 폭 조정 + 글작성 UI 조정 + map 초기 줌 조정)

---

## 1. 한 줄 요약

멘토 피드백 후 첫 작업. 지도 2D 기본 + 콘텐츠 폭을 브런치 패턴(max-w-4xl)으로 맞추고, 본문과 지도의 시각 위계를 구분선 + 헤딩으로 명확화. 시각 검증을 5번 반복하면서 잘못된 해석을 수정한 과정 기록.

---

## 2. 왜 / 목적 / 이유

### 지도 2D 기본
- **왜**: 멘토 피드백 = "지도 2D로". 3D는 멋있어 보이지만 정보 가독성이 떨어짐.
- **목적**: 지도 정보를 명확하게. 사용자가 마커와 도로를 즉시 인식.
- **이유**: 3D는 건물이 시선을 분산시킴. 2D 평면이 정보 파악에 유리.

### 콘텐츠 폭 max-w-4xl (브런치 패턴)
- **왜**: 첫 시도 = 전체 폭(max-w-7xl). 사진이 너무 크고 본문 줄 길이가 너무 길어 가독성 저하.
- **목적**: 브런치 / Medium / Velog 표준 패턴으로 콘텐츠 가독성 확보.
- **이유**: 웹 타이포그래피 표준 = 줄 길이 60~75자. max-w-4xl(896px)이 부합. 여백이 집중에 도움.

### 시각 위계 (구분선 + "촬영지 지도" 헤딩)
- **왜**: 본문과 지도 사이 시각 분리 단서가 없어서 헷갈림.
- **목적**: 사용자가 "여기부터 지도"를 즉시 인식.
- **이유**: UXPin "partial map" 패턴 = 본문은 주, 지도는 보조. 구분선 + 헤딩으로 시각 위계 명확화.

### 초기 줌 13
- **왜**: 기본 줌이 너무 가까움 (시내가 화면에 꽉 참).
- **목적**: 마커 + 주변 컨텍스트 동시 표시.
- **이유**: 사용자 시선이 랜드마크를 먼저 잡음 (eye-tracking 연구). 줌 13이 동네 + 도로 + 마커를 모두 표시.

---

## 3. 작성한 프롬프트

```
[콘텐츠 폭 요청]
상세 페이지 콘텐츠 폭을 헤더 폭에 맞춰 일치시켜 줘.
사진이 너무 크게 나옴.

[시각 위계 요청]
본문과 지도가 헷갈림. 구분선 + "촬영지 지도" 헤딩으로 시각 위계 명확하게 해줘.
MapPin 아이콘 추가.
(γ 갈래 선택)

[줌 조정 요청]
지도 초기 줌 조정. zoom: 약 14 정도. 현재 줌 확인 후 적절 값(13~14)으로 갈음.
→ zoom: 11, 12, 13으로 순차 확인 후 13으로 결정.

[tiptap 이미지 폭 요청]
tiptap 이미지가 정렬이 안 됨.
.tiptap-content img CSS 추가: width: 100%; height: auto; display: block.
```

---

## 4. 코드 작성 & 수정

### 1. SpotMap.tsx — 지도 2D 기본 + 줌 13

```tsx
// components/SpotMap.tsx

// is3D 초기값 변경
const [is3D, setIs3D] = useState(false);  // true → false

// 줌 초기값 변경
const map = new mapboxgl.Map({
  container: containerRef.current,
  style: 'mapbox://styles/mapbox/standard',
  center,
  zoom: 13,   // 기존 16 → 13
  pitch: 60,
});
```

### 2. app/story/[id]/page.tsx — 콘텐츠 폭 + 시각 위계

```tsx
// app/story/[id]/page.tsx
import { MapPin } from 'lucide-react';

<div className="max-w-7xl mx-auto">
  <div className="glass-outer p-8">
    <div className="max-w-4xl mx-auto">
      {/* 제목 / 메타 / 본문 / 태그 */}

      {story.spots.length > 0 && (
        <div className="border-t border-black/10 pt-6 mt-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#1A1A1A] mb-4">
            <MapPin size={16} />
            촬영지 지도
          </h2>
          <SpotMap spots={story.spots} />
        </div>
      )}
    </div>
  </div>
</div>
```

### 3. app/story/new/StoryWriteForm.tsx — 글작성 UI 조정

```tsx
// app/story/new/StoryWriteForm.tsx
import { MapPin } from 'lucide-react';

<form action={formAction} className="flex flex-col gap-4">
  <div className="max-w-4xl mx-auto w-full flex flex-col gap-4">
    {/* 제목 / 본문 / 태그 */}

    <div className="border-t border-black/10 pt-6 mt-2">
      <h2 className="flex items-center gap-2 text-base font-semibold text-[#1A1A1A] mb-4">
        <MapPin size={16} />
        촬영지 지도
      </h2>
      <SpotMap key={spots.map(s => s.id).join(',')} spots={spots} storyId={storyId} canAddSpot={!!storyId} />
    </div>
  </div>
</form>
```

### 4. app/globals.css — tiptap 이미지 폭

```css
/* app/globals.css */
.tiptap-content img { width: 100%; height: auto; display: block; }
```

---

## 5. 결과 / 배운점

### 결과
- 콘텐츠 폭이 브런치 패턴으로 가독성 향상.
- 본문 + 사진 + 태그 + 지도가 시각 일관성 확보.
- 구분선 + 헤딩으로 본문과 지도 사이 시각 분리 명확.
- 줌 13으로 마커 + 컨텍스트 균형.
- 멘토 피드백 1번(지도 2D) 완료.

### 배운점

**1. UXPin "partial map" 패턴**
지도는 본문에 통합된 일부. 본문 = 주(primary), 지도 = 보조(secondary). 사용자 시선이 본문을 먼저, 지도가 컨텍스트로 보충. Airbnb / Google Maps / Travel blogs의 표준 패턴.

**2. 브런치 패턴 = 콘텐츠 폭 기준**
웹 타이포그래피 표준 = 줄 길이 60~75자. max-w-4xl(약 896px)이 한국어 본문에 부합. 여백이 집중에 도움. 본문이 좁고 사진/지도도 같은 폭일 때 시각 일관성 확보.

**3. 사용자 시선 + 랜드마크 본질**
eye-tracking 연구 결과 = 줌 이후 사용자가 랜드마크에 먼저 시선이 감. Salience(눈에 띔)가 있는 객체로 자동 시선 이동. 지도의 줌 + POI 표시가 사용자 인지 부담에 영향.

**4. 잘못된 해석을 시각 검증으로 수정**
"헤더 폭 일치"의 첫 해석 = max-w-7xl (전체 폭). 실제 의도 = 콘텐츠 영역의 가독성 폭. 시각 검증을 통해 의도 명확화. 5번의 시각 수정 후 max-w-4xl로 정착.

**5. 시각 분리 단서 = 구분선 + 헤딩**
본문 끝 + 지도 시작 사이에 명확한 시각 단서가 필요. 구분선(border-t) + "촬영지 지도" 헤딩으로 사용자가 섹션을 즉시 인식. Notion / Medium의 패턴.

**6. 줌 레벨 결정**
줌 13 = 동네 + 도로 + 마커 균형. 줌 12 = 너무 멀음, 줌 14 = 너무 가까움. 마커가 1개일 때와 여러 개일 때 본질이 다름. 여러 개 = fitBounds로 자동 조정 (0054로 분리).

**7. 함정 = 사이드 카드의 검색 영역 보존**
지도 폭을 줄이려 시도했으나 사이드 카드가 좁아져서 0054의 검색 결과 공간이 부족해질 위험. 결정 = 지도는 전체 폭 유지. 의존 본질을 미리 짚어야 함.

---

## 결정 (Decisions)

- 콘텐츠 폭 = max-w-4xl (브런치 패턴, 가독성 우선)
- 지도 = 콘텐츠 영역 안에서 전체 폭 (사이드 카드의 검색 영역 보존)
- 줌 = 13 (마커 + 컨텍스트 균형)
- 시각 위계 = 구분선 + MapPin 아이콘 + 헤딩 (Notion 패턴)
- tiptap 이미지 = width: 100% (Medium / Velog 패턴)

---

## 다음 작업

0051 (유저 아이콘 드롭다운 통합) → 0052 (글 작성 페이지 통합 + 검색) → 0053 (여행 계획 기획) → ...

추후 메모:
- 0053 Mapbox POI 클러터 정리 (Airbnb 패턴, 마커 두드러짐)
- 0053 사진 정렬 (Tiptap 이미지 수정)
- 0054 사이드 카드 동적 + Search Box API
- 0055 헤더 브런치 패턴 (프로덕트 태그)
