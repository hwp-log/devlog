// 더미 공개 플랜 30개 넣기/지우기 통합 스크립트 (커밋 여부 미정 — 확인용).
// 넣기(기본):   node --env-file=.env.local node_modules/.bin/tsx prisma/seed-dummy-plans.ts
// 지우기(--clean): node --env-file=.env.local node_modules/.bin/tsx prisma/seed-dummy-plans.ts --clean
//
// 목적: 목록이 많아졌을 때의 스크롤 길이·첫 로딩 체감·커버 중복 회피 동작 확인 후 삭제.
// 원칙: 커버는 pickPlanCover 경유(하드코딩 금지). currency KRW(비KRW면 가격대 band 미계산).
//       실제 플랜 5개는 title 접두사 불일치로 절대 미접촉.
import { prisma } from '../lib/prisma';
import { pickPlanCover } from '../lib/plan/pick-cover';
import type { CostCategory } from '@prisma/client';

const PREFIX = '[DUMMY] ';
const OWNER_EMAIL = 'test@dotrip.com';
const COUNT = 30;

// 0421: 무촬영지 작품 전용 랜덤 지역(전체의 소수만 사용). '경주'는 시·도 밖(풀 없음)이라
// 커버 null 케이스가 일부 자연 발생 — 무채 폴백 화면 확인용으로 유지.
const FALLBACK_REGIONS = ['서울', '서울', '제주도', '제주도', '부산', '인천', '강원도 강릉', '경주'];
// 30개 중 무촬영지 작품 몫(소수). i % NO_SPOT_EVERY === 0 슬롯에 배정 → 6개.
const NO_SPOT_EVERY = 5;

// Spot.address 첫 토큰 → region 축약형(REGION_ALIAS가 해석 가능한 형태)
const ADDR_PROV: Record<string, string> = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주',
  대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 경기도: '경기',
  강원특별자치도: '강원', 강원도: '강원', 충청북도: '충북', 충청남도: '충남',
  전북특별자치도: '전북', 전라북도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남',
  제주특별자치도: '제주도', 제주도: '제주도',
};
const CATEGORIES: CostCategory[] = ['TRANSPORT', 'ACCOMMODATION', 'FOOD', 'ENTRANCE', 'ETC'];

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// i%3으로 세 가격대 구간 균등 분배(under50 / 50to100 / over100). 단위 만원.
function targetTotalFor(i: number): number {
  const bucket = i % 3;
  if (bucket === 0) return randInt(10, 49) * 10_000;   // ~50만 (총액 < 500k)
  if (bucket === 1) return randInt(50, 99) * 10_000;   // 50~100만 (500k~<1M)
  return randInt(100, 150) * 10_000;                   // 100만~ (>=1M)
}

// 목표 총액을 2~4개 PlanCost로 분할(합=총액, 각 조각 >= 1만).
function splitCosts(total: number, days: number) {
  const parts = randInt(2, 4);
  const rows: { day: number; category: CostCategory; label: string; amount: number }[] = [];
  let remaining = total;
  for (let k = 0; k < parts; k++) {
    const rest = parts - 1 - k; // 뒤에 남을 조각 수(각 최소 1만 확보)
    let amount: number;
    if (rest === 0) {
      amount = remaining;
    } else {
      const maxUnits = Math.floor(remaining / 10_000) - rest; // 뒤 조각들 1만씩 남김
      amount = randInt(1, Math.max(1, maxUnits)) * 10_000;
    }
    remaining -= amount;
    rows.push({ day: randInt(1, days), category: pick(CATEGORIES), label: '더미 비용', amount });
  }
  return rows;
}

async function resolveOwnerId(): Promise<string> {
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
  if (owner) return owner.id;
  const any = await prisma.user.findFirst({
    where: { NOT: { email: { startsWith: 'deleted_' } } },
    select: { id: true, email: true },
  });
  if (!any) throw new Error('소유자로 쓸 유저가 없습니다.');
  console.log(`⚠️ ${OWNER_EMAIL} 없음 → 대체 소유자 ${any.email}`);
  return any.id;
}

async function report(tag: string) {
  const publicCount = await prisma.myPlan.count({ where: { isPublic: true } });
  const totalCount = await prisma.myPlan.count();
  const dummies = await prisma.myPlan.findMany({
    where: { title: { startsWith: PREFIX } },
    select: { coverUrl: true, costs: { select: { amount: true } } },
  });
  const buckets = { under50: 0, '50to100': 0, over100: 0 };
  for (const d of dummies) {
    const t = d.costs.reduce((s, c) => s + c.amount, 0);
    if (t < 500_000) buckets.under50++;
    else if (t < 1_000_000) buckets['50to100']++;
    else buckets.over100++;
  }
  const coverCounts = new Map<string, number>();
  for (const d of dummies) {
    const k = d.coverUrl ?? '(null 무채폴백)';
    coverCounts.set(k, (coverCounts.get(k) ?? 0) + 1);
  }
  console.log(`\n===== ${tag} =====`);
  console.log(`공개 플랜: ${publicCount} / 총 플랜: ${totalCount} / 더미: ${dummies.length}`);
  console.log('가격대 구간 분포:', JSON.stringify(buckets));
  console.log('커버 URL별 사용 횟수:');
  const sorted = [...coverCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [url, n] of sorted) console.log(`  ${n}회  ${url}`);
}

async function insert() {
  const ownerId = await resolveOwnerId();
  // 0421: 작품을 먼저 고르고 그 작품의 촬영지 시·도를 region으로 (불가능 조합 방지).
  const movies = await prisma.movie.findMany({
    select: { title: true, spotMovies: { select: { spot: { select: { address: true } } } } },
  });
  if (movies.length === 0) throw new Error('Movie 데이터가 없습니다.');
  const provsOf = new Map<string, string[]>(); // 작품 → 촬영지 시·도(축약, dedup)
  for (const m of movies) {
    const set = new Set<string>();
    for (const sm of m.spotMovies) {
      const first = sm.spot.address?.trim().split(/\s+/)[0];
      const prov = first ? ADDR_PROV[first] : undefined;
      if (prov) set.add(prov);
    }
    if (set.size) provsOf.set(m.title, [...set]);
  }
  const withProv = movies.map((m) => m.title).filter((t) => provsOf.has(t));
  const withoutProv = movies.map((m) => m.title).filter((t) => !provsOf.has(t));
  if (withProv.length === 0) throw new Error('촬영지 시·도가 있는 작품이 없습니다.');

  const base = new Date(2026, 7, 1); // 8월 1일 기준(일수 파생용, 값 자체는 무의미)
  for (let i = 0; i < COUNT; i++) {
    // 무촬영지 작품은 소수 슬롯(i%5==0 → 6개)만: 지역 랜덤(경주 포함 → 커버 null 일부 유지)
    const noSpotSlot = i % NO_SPOT_EVERY === 0 && withoutProv.length > 0;
    const movie = noSpotSlot ? pick(withoutProv) : pick(withProv);
    const region = noSpotSlot ? pick(FALLBACK_REGIONS) : pick(provsOf.get(movie)!);
    const days = randInt(1, 5);
    const spots = randInt(1, 8);
    const headcount = randInt(1, 6);
    const total = targetTotalFor(i);

    const start = new Date(base);
    start.setDate(base.getDate() + i);
    const end = new Date(start);
    end.setDate(start.getDate() + (days - 1));

    // 직전까지 커밋된 플랜 기준 최소사용 커버 선택(순차 생성이라 회피 동작이 실제로 작동)
    const coverUrl = await pickPlanCover(movie, region);

    await prisma.$transaction(async (tx) => {
      const plan = await tx.myPlan.create({
        data: {
          ownerId,
          title: `${PREFIX}${region} ${movie} 코스`,
          currency: 'KRW',
          startDate: start,
          endDate: end,
          region,
          movie,
          headcount,
          isPublic: true,
          coverUrl,
        },
      });
      for (let s = 0; s < spots; s++) {
        await tx.planSpot.create({
          data: { planId: plan.id, day: (s % days) + 1, order: s, name: `${movie} 스팟 ${s + 1}`, lat: 0, lng: 0 },
        });
      }
      for (const c of splitCosts(total, days)) {
        await tx.planCost.create({
          data: { planId: plan.id, day: c.day, category: c.category, label: c.label, amount: c.amount },
        });
      }
    });
  }
  await report('넣기 완료');
}

async function clean() {
  const dummies = await prisma.myPlan.findMany({
    where: { title: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = dummies.map((d) => d.id);
  if (ids.length === 0) {
    console.log('삭제할 더미 플랜이 없습니다.');
  } else {
    await prisma.$transaction([
      prisma.planCost.deleteMany({ where: { planId: { in: ids } } }),
      prisma.planSpot.deleteMany({ where: { planId: { in: ids } } }),
      prisma.planFlight.deleteMany({ where: { planId: { in: ids } } }),
      prisma.planLike.deleteMany({ where: { planId: { in: ids } } }),
      prisma.myPlan.deleteMany({ where: { id: { in: ids }, title: { startsWith: PREFIX } } }),
    ]);
    console.log(`🧹 더미 플랜 ${ids.length}개 삭제`);
  }
  await report('지우기 완료');
}

async function main() {
  const isClean = process.argv.includes('--clean');
  if (isClean) await clean();
  else await insert();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
