import { config } from "dotenv";
import { existsSync } from "fs";

// 로컬 개발: .env.local 읽기
// Vercel 빌드: process.env 그대로 사용 (.env.local 없음)
if (existsSync(".env.local")) {
  config({ path: ".env.local" });
}

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // seed 설정 없음 — 의도된 부재다. 이 config에 seed 항목을 둔 적이 없어
    // `prisma db seed`는 애초에 동작하지 않았다 (비활성화가 아니라 미설정).
    // prisma/seed.ts는 0575에서 폐기: DB 실물과 내용이 어긋난 지 오래였고
    // (스토리 12건 중 7건은 이미 삭제됨), StorySpot·Spot을 만들지 않으며,
    // 첫 줄의 Story deleteMany가 현재 스토리 5건을 지우고 그에 걸린
    // 플랜 2건의 연결(Story.planId, onDelete: SetNull)까지 끊는 구조였다.
    // 시드가 필요한 데이터는 각 스크립트를 단독 실행한다:
    //   node --env-file=.env.local node_modules/.bin/tsx prisma/seed-movies.ts
    //   node --env-file=.env.local node_modules/.bin/tsx prisma/seed-spots.ts
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});