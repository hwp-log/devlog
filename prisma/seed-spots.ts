import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../lib/prisma";

// 0190: 한국문화정보원 공공데이터 큐레이션(prisma/seed-spots.json) 순수 추가 시딩.
// 기존 사용자 데이터(스팟·스토리·좋아요·유저)는 절대 건드리지 않는다 — INSERT 전용, 기존 행 UPDATE/DELETE 없음.
// 멱등: movie=title 재사용 / spot=name+좌표4자리 dedup / spot_movie=@@unique upsert(update 무동작).

type SeedSpot = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  movies: { title: string; description: string }[];
};
type SeedFile = { movies: string[]; spots: SeedSpot[] };

// name+좌표(소수 4자리) 중복 방어 키 — json 내부·기존 DB 공용
const spotKey = (name: string, lat: number, lng: number) =>
  `${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`;

async function main() {
  const file = join(process.cwd(), "prisma", "seed-spots.json");
  const data: SeedFile = JSON.parse(readFileSync(file, "utf8"));

  let movieCreated = 0,
    movieReused = 0,
    spotCreated = 0,
    spotSkipped = 0,
    linkCreated = 0,
    linkSkipped = 0;

  // 1) Movie — title 기준 find-or-create (title은 @unique 아님 → findFirst). 캐시로 중복 조회 방지.
  const movieIdByTitle = new Map<string, string>();
  const resolveMovie = async (title: string): Promise<string> => {
    const cached = movieIdByTitle.get(title);
    if (cached) return cached;
    const existing = await prisma.movie.findFirst({ where: { title } });
    if (existing) {
      movieReused++;
      movieIdByTitle.set(title, existing.id);
      return existing.id;
    }
    const created = await prisma.movie.create({
      data: { title, status: "APPROVED" },
    });
    movieCreated++;
    movieIdByTitle.set(title, created.id);
    console.log(`🎬 movie 생성: ${title}`);
    return created.id;
  };

  // 기존 spot 키 집합 (재실행/충돌 방어). 이번 런에서 만든 것도 누적.
  const existingSpots = await prisma.spot.findMany({
    select: { id: true, name: true, lat: true, lng: true },
  });
  const spotIdByKey = new Map<string, string>();
  for (const s of existingSpots) spotIdByKey.set(spotKey(s.name, s.lat, s.lng), s.id);

  for (const seed of data.spots) {
    const key = spotKey(seed.name, seed.lat, seed.lng);

    // 2) Spot — name+좌표4자리 dedup. 있으면 그 id 재사용(생성 건너뜀), 없으면 생성. storyId 생략(null).
    let spotId = spotIdByKey.get(key);
    if (spotId) {
      spotSkipped++;
    } else {
      const created = await prisma.spot.create({
        data: {
          name: seed.name,
          address: seed.address,
          lat: seed.lat,
          lng: seed.lng,
          source: "seed", // 0207: 시딩 프로비넌스. 청소 로직(0208) 보호 대상 표식
          order: 0, // Spot.order NOT NULL. 리스트 정렬축은 createdAt이라 미사용 — 0 고정(교통·사진 0191/0192)
          // storyId 생략(null) / movieId 생략(null) / nearestStation·transitMinutes·photoUrl 미기입
        },
      });
      spotId = created.id;
      spotCreated++;
      console.log(`📍 spot 생성: ${seed.name}`);
    }
    spotIdByKey.set(key, spotId);

    // 3) SpotMovie — description 포함, @@unique([spotId, movieId]) 멱등.
    //    사전 존재 확인으로 생성/건너뜀을 정확히 카운트. 기존 링크는 무동작(description 클로버 금지).
    for (const link of seed.movies) {
      const movieId = await resolveMovie(link.title);
      const exists = await prisma.spotMovie.findUnique({
        where: { spotId_movieId: { spotId, movieId } },
        select: { id: true },
      });
      if (exists) {
        linkSkipped++;
        continue;
      }
      await prisma.spotMovie.create({
        data: { spotId, movieId, description: link.description },
      });
      linkCreated++;
    }
  }

  console.log(
    `\n요약: movie(생성 ${movieCreated}/재사용 ${movieReused}) · ` +
      `spot(생성 ${spotCreated}/건너뜀 ${spotSkipped}) · ` +
      `spot_movie(생성 ${linkCreated}/건너뜀 ${linkSkipped})`,
  );
  console.log("✅ seed-spots 완료");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
