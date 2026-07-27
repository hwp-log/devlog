// 플랜파인더 한 페이지 크기 — 스토리(STORY_PAGE_SIZE=15)와 동일.
// lib/plan/queries.ts는 'server-only'라 클라이언트(PlanListClient)가 import 불가 →
// 무-server-only 파일에 상수만 분리해 클라·서버 양쪽이 쓴다.
export const PLAN_PAGE_SIZE = 14;
