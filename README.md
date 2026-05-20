# Dotrip

한국 콘텐츠 촬영지 탐방·기록·여행계획 플랫폼

## 컨셉

영화·드라마 촬영지를 다녀온 사람이 기록을 남기고,
같은 작품의 팬이 그 기록을 참고해 여행을 계획하는 플랫폼.
작성자·소비자 국적 제한 없음.

## MVP 타깃

- **콘텐츠**: 한국 영화 / 드라마
- **소비자**: 방한 K-콘텐츠 팬덤
- **시장 검증**: VELTRA·JTB·KONEST 등 일본 여행사가 K-드라마 투어 패키지 판매 중
- **언어**: 한일 다국어 (= next-intl 예정)

## 기술 스택

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **상태 관리**: Jotai (클라이언트), TanStack Query (서버)
- **Backend**: Supabase (PostgreSQL + Auth)
- **Deployment**: Vercel
- **국제화**: next-intl (예정)
- **지도**: 지도 API (예정)

## 로컬 실행

​```bash
npm install
npm run dev
​```

`http://localhost:3000`에서 확인.

환경변수는 `.env.local`에 설정 필요:

​```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
​```