import { prisma } from "../lib/prisma";

async function main() {
  const movieTitles = [
    "수리남",
    "오징어 게임",
    "범죄도시",
    "미생",
    "도깨비",
    "빈센조",
    "이상한 변호사 우영우",
    "서울의 봄",
    "헤어질 결심",
    "응답하라 1988",
    "기생충",
    "이태원 클라쓰",
  ];

  for (const title of movieTitles) {
    const existing = await prisma.movie.findFirst({ where: { title } });
    if (existing) {
      console.log(`⏭️ 이미 존재: ${title}`);
      continue;
    }
    await prisma.movie.create({ data: { title } });
    console.log(`🎬 생성: ${title}`);
  }

  console.log("🎬 Movie 시드 완료");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
