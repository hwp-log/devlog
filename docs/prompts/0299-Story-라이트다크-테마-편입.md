# 0299 회고: Story 라이트/다크 테마 편입

**작성일**: 2026-07-21
**관련 커밋**: `b2ced3f` feat: 0299 Story 라이트/다크 테마 편입 - 하드코딩 색·유리 틀을 기존 테마 토큰으로 치환

> 참고: docs/prompts에 0289~0292·0295~0297 파일이 없는 번호 공백이 있음(과거 묶음 회고로 병합 추정). 0299는 미사용 번호라 신규 작성 안전.

---

## 1. 한 줄 요약

Story 화면(카드·헤더·검색창·빈 상태)이 쓰던 하드코딩 색(text-slate-600, text-[#1A1A1A] 등)과 유리 틀(glass-outer)을, SpotFinder 트랙(0267~0298)에서 이미 정의된 기존 테마 토큰으로 치환 — 카드 재구성(0300) 전에 라이트/다크 일관성의 바닥을 먼저 통일.

---

## 2. 왜 / 목적 / 이유

- **왜**: Story 화면은 그때까지 하드코딩 색과 유리 틀을 써서 라이트/다크 테마 대응이 안 됐음. 하드코딩 위에서 카드 구조를 바꾸면 색 문제와 구조 문제를 동시에 디버깅해야 함.
- **목적**: 색·표면을 양쪽 테마에서 일관되게 만들어, 다음 커밋(0300)에서 카드 "구조"에만 집중할 수 있는 바닥을 확보.
- **이유**: 관심사 분리. 테마/색 문제를 먼저 없애고 → 구조에 집중. 이미 SpotFinder 트랙에서 만든 토큰이 있어 신규 정의 없이 재사용, 그 자체로 화면 간 일관성도 확보.

---

## 3. 작성한 프롬프트

```
[배경]
Story 화면(카드·헤더·검색창·빈 상태)이 하드코딩 색·유리 틀 사용 → 라이트/다크
미대응. SpotFinder 트랙에서 이미 정의한 테마 토큰으로 치환. 신규 토큰 정의 없음.

[작업]
1. StoryCard·StoryHeader·TagSearchBar·page 빈 상태의 하드코딩 색 → 토큰
2. glass-outer 유리 틀 → bg/border 토큰 기반 평면 표면
3. 라이트/다크 양쪽 육안 확인

[하지 말 것]
theme.ts 토큰 신규 정의 ❌ / 카드 구조 변경 ❌(0300에서) / 커밋 ❌

[검수 모드]
읽고 보고만 아님 — 실제 치환. plan 요청.
```

> 실제 프롬프트 원문이 다르면 [사용자 확인 필요] — 위는 커밋 내용 기반 재구성.

---

## 4. 코드 작성 & 수정

변경 파일 6개: StoryCard · StoryCardList · StoryHeader · TagSearchBar · layout · page.
**theme.ts 미변경** — 0299는 토큰을 신규 정의한 게 아니라, SpotFinder 트랙(0267~0298)에서 이미 정의된 기존 토큰을 소비/편입한 커밋.

### 소비한 기존 토큰 (theme.ts에 이미 정의, 라이트/다크 쌍)

```
bg(#fff/#151718) · bg-deep(#f6f6f8/#0f1112) · card(#f2f2f5/#1d1f21)
surface2(#e8e8ee/#26292b) · fg(#191a1c/#f0eee8) · fg2(#55565c/#c8c4be)
muted(#8a8a90/#7a7870) · border(rgba) · primary(#4d9eff) · heart-active(#e24b4a)
```

### 하드코딩 → 토큰 치환 대표 사례 (- 전 / + 후)

```tsx
// StoryCard.tsx — 카드 컨테이너: 유리 틀 → 평면 카드
- glass-outer glass-outer-interactive
+ bg-bg border border-border rounded-2xl shadow-sm hover:shadow-md

// StoryCard.tsx — 제목/본문
- text-[#1A1A1A]  /  text-slate-600
+ text-fg  /  text-fg2

// StoryCard.tsx — 태그칩·구분선·하트
- bg-slate-100 text-slate-600  /  border-slate-100  /  fill-rose-500 text-rose-500
+ bg-card text-fg2  /  border-border  /  fill-heart-active text-heart-active

// StoryHeader.tsx — 눈썹·제목
- text-sky-500  /  text-[#1A1A1A]
+ text-primary  /  text-fg   (+ 헤드라인 "여행자들의 이야기" 고정)

// TagSearchBar.tsx — 검색창(회색 pill 언어)
- border border-slate-200 bg-white/70 focus:ring-slate-300
+ bg-card border-0 dark:border dark:border-border focus:border-primary

// page.tsx — 빈 상태
- glass-outer ... text-slate-500
+ bg-card border border-border rounded-2xl ... text-fg2
```

---

## 5. 결과 / 배운점

### 결과
- Story 화면 전체가 라이트/다크 양쪽에서 토큰 기반으로 일관 렌더.
- 유리 틀(glass-outer) 제거로 카드가 평면 표면화 — 0300 미니멀 재구성의 전제 확보.
- 브라우저 수동 확인 잔여(사용자): 라이트/다크 전환 시 카드·헤더·검색창·빈 상태 색 일관성.

### 배운점
- **관심사 분리를 "순서"로 실현**: 하드코딩 위에서 구조를 바꾸면 색 문제와 구조 문제를 동시에 디버깅해야 한다. 그래서 색/테마를 먼저 토큰으로 통일(0299)하고, 그 위에서 구조만 다루도록(0300) 작업을 분리했다. 한 커밋에 색+구조를 섞지 않은 게 이후 디버깅 비용을 낮췄다.
- **기존 자산 재사용 = 공짜 일관성**: SpotFinder 트랙에서 만든 토큰을 그대로 소비하니, 별도 정의 없이 화면 간 테마 일관성이 따라왔다.
- [추가 배운점 있으면 사용자 확인]

---

## 결정 (Decisions)

- **카드 재구성 전에 토큰 편입을 먼저** — 색/테마 문제와 구조 문제를 한 커밋에 섞지 않기 위해. 관심사 분리로 각 단계의 디버깅 범위를 좁힘.
- **theme.ts 신규 정의 없이 기존 토큰 소비** — SpotFinder 트랙(0267~0298) 토큰이 이미 라이트/다크 쌍으로 존재. 재정의는 중복·불일치 위험이라 재사용이 정답.
