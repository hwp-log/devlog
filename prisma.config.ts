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
    // prisma db seed 비활성화: seed.ts는 test@dotrip.com의 Story를
    // deleteMany로 전부 삭제 후 재생성하는 비멱등 로직이라 위험.
    // Movie 시드는 단독 실행:
    //   node --env-file=.env.local --import tsx prisma/seed-movies.ts
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});