import { prisma } from "../lib/prisma";

async function main() {
  const user = await prisma.user.findFirst();

  if (!user) {
    console.log("⚠️ 사용자 없음. 먼저 회원가입 후 시드 실행.");
    return;
  }

  const tag1 = await prisma.tag.upsert({
    where: { name: "촬영지" },
    update: {},
    create: { name: "촬영지" },
  });
  const tag2 = await prisma.tag.upsert({
    where: { name: "이태원클라쓰" },
    update: {},
    create: { name: "이태원클라쓰" },
  });

  await prisma.story.create({
    data: {
      title: "이태원 클라쓰 단밤 포차 - 후암동 오리올",
      content:
        "드라마 속 '단밤' 포차의 실제 촬영지인 후암동 오리올에 다녀왔다. " +
        "이태원이 아닌 후암동 남산 아랫자락에 있는 게 의외였다. " +
        "3층 루프탑에서 보는 남산뷰가 압권. " +
        "박새로이의 가게가 그대로 남아있어서 감동.",
      photoUrl: null,
      userId: user.id,
      tags: {
        connect: [{ id: tag1.id }, { id: tag2.id }],
      },
    },
  });

  console.log("✅ 시드 완료");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });