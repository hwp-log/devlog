# DevLog

개발자 학습 기록 대시보드. 개인 + 지인용 프로토타입.

## 소개

개인 학습 대시보드.  
"무엇을 얼마나 기록했는가"가 아니라 "왜 공부하고, 어떻게 기억하며, 어떻게 학습해 나갈 것인가"를 다루는 도구입니다.

## 무엇을 만드는가

TIL, 딥다이브, 기술 탐구를 기록하고 통계로 시각화합니다.

- **학습 목적 설정**: 왜 공부하는지 명시하고 매일 상기
- **매번 무엇을 쓸지 막막할 때**: TIL, DeepDive, TechStudy 유형별 양식 제공
- **연속 기록 통계**: 꾸준함을 시각화해 동기 유지
- **최근 기록 타임라인**: 어제 무엇을 공부했는지 즉시 확인

## 기술 스택

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **상태 관리**: Jotai (클라이언트), TanStack Query (서버)
- **Backend**: Supabase (PostgreSQL + Auth)
- **Deployment**: Vercel

## 로컬 실행

```bash
npm install
npm run dev
```

`http://localhost:3000`에서 확인.

환경변수는 `.env.local`에 설정 필요:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Roadmap

- [x] M1: 초기 셋업 + 배포
- [ ] M2: 인증 (로그인 + 회원가입)
- [ ] M3: 글 작성
- [ ] M4: 글 목록 + 상세 조회
- [ ] M5: 공개 준비 (이메일 인증, 비밀번호 재설정)
- [ ] M6: 위젯 대시보드
- [ ] M7: 위젯 커스터마이즈