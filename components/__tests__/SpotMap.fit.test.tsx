import { render, act, screen, fireEvent } from '@testing-library/react';
import SpotMap from '../SpotMap';

// 초기 뷰 규칙(0367) — 0개=기본 유지 / 단일·근접=center+ZOOM_FOCUS / 이격=프로젝션 산출(상한 16).
// naver SDK는 계측 목: GL fitBounds 신뢰 불가 실측(SpotFinderMapNaver:212·656)으로 직접 산출로
// 전환했으므로, 여기선 "규칙이 올바른 setCenter/setZoom을 내는가"를 검증한다(실좌표·타일은 실화면).

jest.mock('@/lib/naver/useNaverMapsLoader', () => ({
  useNaverMapsLoader: () => ({ status: 'ready', slow: false, retry: jest.fn() }),
}));
jest.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
jest.mock('@/lib/spot/nearby', () => ({ findNearbySpots: jest.fn(async () => []) }));
jest.mock('@/lib/spot/searchPlaces', () => ({ searchPlaces: jest.fn() }));
jest.mock('../SpotPopup', () => ({ SpotPopup: () => null }));

type ViewLog = {
  setCenter: Array<{ lat: number; lng: number }>;
  setZoom: number[];
  morph: Array<{ lat: number; lng: number; zoom: number }>;
};
const viewLog: ViewLog = { setCenter: [], setZoom: [], morph: [] };
let initCallbacks: Array<() => void> = [];

class MockLatLng {
  constructor(public _lat: number, public _lng: number) {}
  lat() { return this._lat; }
  lng() { return this._lng; }
}
// 선형 목 프로젝션 — 규칙 검증에는 단조 매핑이면 충분(실제 Mercator는 SDK 소관)
const SCALE = 1000;
class MockMap {
  center: MockLatLng;
  zoom: number;
  constructor(_div: unknown, opts: { center: MockLatLng; zoom: number }) {
    this.center = opts.center;
    this.zoom = opts.zoom;
  }
  getSize() { return { width: 800, height: 500 }; }
  getMinZoom() { return 6; }
  getProjection() {
    return {
      fromCoordToOffset: (c: MockLatLng) => ({ x: c._lng * SCALE, y: -c._lat * SCALE }),
      fromOffsetToCoord: (p: { x: number; y: number }) => new MockLatLng(-p.y / SCALE, p.x / SCALE),
    };
  }
  setCenter(c: MockLatLng) { this.center = c; viewLog.setCenter.push({ lat: c._lat, lng: c._lng }); }
  setZoom(z: number) { this.zoom = z; viewLog.setZoom.push(z); }
  getCenter() { return this.center; }
  getZoom() { return this.zoom; }
  fitBounds() { throw new Error('fitBounds 사용 금지 — GL 신뢰 불가 실측으로 직접 산출로 전환(0367)'); }
  autoResize() {}
  panTo() {}
  morph(c: MockLatLng, z: number) {
    this.center = c; this.zoom = z;
    viewLog.morph.push({ lat: c._lat, lng: c._lng, zoom: z });
  }
  destroy() {}
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID = 'test';
  (globalThis as Record<string, unknown>).naver = {
    maps: {
      Map: MockMap,
      LatLng: MockLatLng,
      LatLngBounds: class { extend() {} },
      Point: class { constructor(public x: number, public y: number) {} },
      Marker: class { setMap() {} setIcon() {} setZIndex() {} }, // 0390: 라벨 마커 선택 강조가 setIcon/setZIndex 호출 — 실 API 표면 반영
      Event: {
        once: (_m: unknown, _t: string, cb: () => void) => { initCallbacks.push(cb); return {}; },
        addListener: () => ({}),
        removeListener: () => {},
      },
    },
  };
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
});
beforeEach(() => {
  viewLog.setCenter.length = 0;
  viewLog.setZoom.length = 0;
  viewLog.morph.length = 0;
  initCallbacks = [];
});

const 서울 = { id: 's1', name: '서울', lat: 37.56, lng: 126.97, order: 1 };
const 서울옆 = { id: 's2', name: '서울 옆 20m', lat: 37.5601, lng: 126.9701, order: 2 }; // ~20m
const 제주 = { id: 's3', name: '제주', lat: 33.45, lng: 126.57, order: 3 };

function mountWithSpots(spots: Array<typeof 서울>) {
  render(<SpotMap spots={spots} readOnly />);
  act(() => { initCallbacks.forEach(cb => cb()); }); // GL 'init' 발화 재현
}

describe('지도 초기 뷰 규칙(0367)', () => {
  it('스팟 0개: 초기 뷰를 건드리지 않는다(기본 뷰 유지)', () => {
    mountWithSpots([]);
    expect(viewLog.setCenter).toEqual([]);
    expect(viewLog.setZoom).toEqual([]);
  });

  it('스팟 1개: 그 좌표 중심 + 고정 줌 16(ZOOM_FOCUS)', () => {
    mountWithSpots([서울]);
    expect(viewLog.setCenter).toEqual([{ lat: 서울.lat, lng: 서울.lng }]);
    expect(viewLog.setZoom).toEqual([16]);
  });

  it('여러 개지만 전부 근접(50m 이내): 단일과 동일 — 과확대 방지', () => {
    mountWithSpots([서울, 서울옆]);
    expect(viewLog.setCenter).toEqual([{ lat: 서울.lat, lng: 서울.lng }]);
    expect(viewLog.setZoom).toEqual([16]);
  });

  it('이격 스팟(서울+제주): 두 점의 중점으로 축소 — 줌은 16 미만·min 이상', () => {
    mountWithSpots([서울, 제주]);
    expect(viewLog.setCenter).toHaveLength(1);
    const c = viewLog.setCenter[0];
    expect(c.lat).toBeCloseTo((서울.lat + 제주.lat) / 2, 5);
    expect(c.lng).toBeCloseTo((서울.lng + 제주.lng) / 2, 5);
    expect(viewLog.setZoom).toHaveLength(1);
    expect(viewLog.setZoom[0]).toBeLessThan(16);
    expect(viewLog.setZoom[0]).toBeGreaterThanOrEqual(6);
  });

  it('초기 1회만 — 같은 인스턴스에서 재실행 없음(호출 1세트)', () => {
    mountWithSpots([서울, 제주]);
    expect(viewLog.setZoom).toHaveLength(1); // 추가 rAF 재시도·재실행 없음
  });

  it('초기 로드는 0ms 점프 — morph를 쓰지 않는다(0367 판단 불변)', () => {
    mountWithSpots([서울, 제주]);
    expect(viewLog.morph).toEqual([]);
  });
});

describe('사용자 조작 전환(0369) — morph', () => {
  it('리뷰장소 전체보기 오버레이: 스팟 0개면 미렌더', () => {
    mountWithSpots([]);
    expect(screen.queryByRole('button', { name: '방문장소 전체보기' })).not.toBeInTheDocument();
  });

  it('오버레이 클릭: morph로 전체 뷰(부드러운 전환) — 0ms 경로와 분리', () => {
    mountWithSpots([서울, 제주]);
    viewLog.setCenter.length = 0; viewLog.setZoom.length = 0; // 초기 핏 기록 제거
    fireEvent.click(screen.getByRole('button', { name: '방문장소 전체보기' }));
    expect(viewLog.morph).toHaveLength(1);
    expect(viewLog.morph[0].zoom).toBeLessThan(16);
    expect(viewLog.setZoom).toEqual([]); // smooth 경로는 setZoom 미사용
  });

  it('목록 항목 클릭: 해당 좌표로 morph + 줌 하한 16(축소 없음)', () => {
    mountWithSpots([서울, 제주]); // 초기 핏으로 줌 16 미만 상태
    fireEvent.click(screen.getByText('서울'));
    expect(viewLog.morph).toHaveLength(1);
    expect(viewLog.morph[0]).toMatchObject({ lat: 서울.lat, lng: 서울.lng });
    expect(viewLog.morph[0].zoom).toBe(16); // Math.max(현재줌<16, ZOOM_FOCUS)
  });
});
