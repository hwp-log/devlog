import { findNearbySpots } from '../nearby';

// 0384 보안: 인증 가드 + radiusM clamp 검증.
// geo.ts(haversine·boundingBox)는 실함수 사용 — prisma.findMany는 고정 rows를 반환(where 무시)하고,
// clamp된 반경이 이후 JS 거리 필터(distanceM<=r)에 미치는 영향을 반환 개수로 판정한다.

const mockGetUser = jest.fn();
const mockFindMany = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve({ auth: { getUser: mockGetUser } })),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: { spot: { findMany: (...a: unknown[]) => mockFindMany(...a) } },
}));

// 기준점 (37.5, 127.0)에서 정북으로 ~90m·~300m·~600m (1도 위도 ≈ 111km)
const BASE = { lat: 37.5, lng: 127.0 };
const row = (id: string, meters: number) => ({
  id,
  name: `spot-${id}`,
  lat: BASE.lat + meters / 111_000,
  lng: BASE.lng,
  spotMovies: [{ movie: { title: `movie-${id}` } }],
  _count: { storySpots: 2 },
});
const ROWS = [row('near', 90), row('mid', 300), row('far', 600)];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  mockFindMany.mockResolvedValue(ROWS);
});

describe('findNearbySpots — 인증 가드', () => {
  it('미인증(user=null)이면 throw하고 prisma를 조회하지 않는다', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    await expect(findNearbySpots(BASE.lat, BASE.lng)).rejects.toThrow('UNAUTHENTICATED');
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('인증 상태면 정상 반환한다', async () => {
    const res = await findNearbySpots(BASE.lat, BASE.lng);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(Array.isArray(res)).toBe(true);
  });
});

describe('findNearbySpots — radiusM clamp', () => {
  it('기본(100m): 90m만 포함(300·600 제외)', async () => {
    const res = await findNearbySpots(BASE.lat, BASE.lng);
    expect(res.map((s) => s.spotId)).toEqual(['near']);
  });

  it('과대값 1e9: 500으로 clamp → 90·300 포함, 600 제외', async () => {
    const res = await findNearbySpots(BASE.lat, BASE.lng, 1e9);
    expect(res.map((s) => s.spotId)).toEqual(['near', 'mid']);
  });

  it('음수 -50: 0으로 clamp → 전부 제외(빈 배열)', async () => {
    const res = await findNearbySpots(BASE.lat, BASE.lng, -50);
    expect(res).toEqual([]);
  });

  it('NaN: 유한 아님 → 기본 100 폴백(90m만 포함)', async () => {
    const res = await findNearbySpots(BASE.lat, BASE.lng, NaN);
    expect(res.map((s) => s.spotId)).toEqual(['near']);
  });

  it('Infinity: 유한 아님 → 기본 100 폴백(90m만 포함)', async () => {
    const res = await findNearbySpots(BASE.lat, BASE.lng, Infinity);
    expect(res.map((s) => s.spotId)).toEqual(['near']);
  });
});
