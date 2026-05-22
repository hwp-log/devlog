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
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});