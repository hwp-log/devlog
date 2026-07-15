'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, ChevronLeft, ChevronRight, Info, Heart } from 'lucide-react';
import type { SpotFinderSpot } from '@/lib/spot/queries';
import { theme, withAlpha } from '@/lib/theme';
import { useNaverMapsLoader } from '@/lib/naver/useNaverMapsLoader';
import { getMarkerClusteringClass, type MarkerClusteringInstance } from '@/lib/naver/MarkerClustering';
import { openNaverDirections } from '@/lib/naver/directionsUrl';
import { formatTransit } from '@/lib/spot/transit';
import { haversineM } from '@/lib/spot/geo';

const PRIMARY = theme.common.primary;

// 작성일 표기 YYYY.MM.DD — 외부 날짜 유틸 없어 이 파일 로컬 (다녀온 이야기 카드 전용)
function formatYmd(d: Date | string): string {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;
}

// 커버 미보유 플레이스홀더 — 중성 그라디언트 + 🎬 (PRIMARY 미사용: wayfinding 색과 의미 분리).
// 작품별 색 매핑이 없어 작품색은 전부 동일 sky라 정보가 없음 → 중성 채택(0192). 작품명은 히어로만.
function SpotCoverPlaceholder({ variant, movieTitle }: { variant: 'hero' | 'list'; movieTitle?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-[linear-gradient(135deg,var(--surface2),var(--card))]">
      <span aria-hidden className={variant === 'hero' ? 'text-4xl opacity-80' : 'text-lg opacity-70'}>🎬</span>
      {variant === 'hero' && movieTitle && (
        <span className="px-4 text-center text-xs text-muted break-keep line-clamp-1">{movieTitle}</span>
      )}
    </div>
  );
}

// 국내 전용 지도 — 제주·독도 포함 한국 bbox (판단값, "국내만 제공" 배너와 정합)
const KOREA_BOUNDS = { south: 32.5, west: 123.5, north: 39.5, east: 132.5 };

// 마커 본체 크기 상수 — anchor 파생 계산의 단일 소스 (라벨 높이는 translate -100%가 자동 흡수)
const MARKER_DOT_SIZE = 11; // 미선택 점 (border-box)
// 선택 카드 72.5 = 시안 58의 1.25배 (사용자 체감 조정 — 2.0/1.5/1.3/1.2배 시도 후 수렴) — 초기 자동
// 선택으로 카드가 첫인상 중심이 된 데 따른 확대. 가림은 선택 1개 한정·z 최상위 기존 위계·팬줌 회피 가능
const MARKER_CARD_SIZE = 72.5; // 선택 썸네일 카드 (border-box)

// HTML 문자열 아이콘에 들어가는 사용자 데이터 최소 이스케이프
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 마커 HTML — 시안 2단계: 미선택 = 지명 라벨 pill + 11px 점 / 선택 = 58px 썸네일 카드 + primary pill.
// 0-크기 외곽 + translate(-50%,-100%)로 "블록 하단 중앙 = 좌표" (시안 앵커 동일, 라벨 가변 폭 대응 — anchor는 Point(0,0))
// 라벨 12px = CLAUDE.md §5 하한 준수 (시안 11px, 기존 눈썹·배지 판정 계열). 색은 토큰(var(--surface2)/var(--fg2)/var(--bg))
function markerContent(spot: SpotFinderSpot, selected: boolean): string {
  const name = escapeHtml(spot.name);
  // 라벨 크기 분기: 선택 22px(히어로 제목 동급 — 24px는 위계 역전이라 기각, 판단값) / 미선택 12px 무변
  const pillSize = selected
    ? 'font-size:15px;padding:4px 11px;'
    : 'font-size:12px;padding:3px 9px;';
  const pillBase = `${pillSize}border-radius:999px;white-space:nowrap;display:inline-block;position:relative;margin-bottom:4px;`;
  const pingAnim = `animation:spot-ping 1.8s cubic-bezier(0,0,0.2,1) infinite`;

  // 스택형 구조 (선택 = 미선택 + 추가 레이어): [카드(선택+사진)] / [라벨] / [점 — 항상 좌표에 고정].
  // 점이 살아 있으므로 발광(이중 링 + 핑)은 항상 점에서 발생 — 카드에 가려질 일이 없음 (radial 불필요).
  // 간격은 시안 준용: 카드-라벨 4px(시안 카드 margin-bottom) / 라벨-점 4px(시안 미선택 간격)
  const dotShadow = selected
    ? `0 0 0 6px ${withAlpha(PRIMARY, 0.15)}, 0 0 0 12px ${withAlpha(PRIMARY, 0.08)}, 0 2px 6px rgba(0,0,0,0.5)`
    : '0 2px 6px rgba(0,0,0,0.5)';
  const pillColor = selected
    ? `background:${PRIMARY};color:#fff;border:1px solid ${PRIMARY}`
    : 'background:var(--surface2);color:var(--fg2);border:1px solid rgba(255,255,255,0.3)';
  const ping = selected
    ? `<span style="position:absolute;left:50%;bottom:${-(41 - MARKER_DOT_SIZE / 2)}px;width:82px;height:82px;margin-left:-41px;border-radius:50%;background:${withAlpha(PRIMARY, 0.75)};pointer-events:none;${pingAnim}"></span>`
    : '';
  // 선택 시 항상 카드 표시 — 사진 있으면 이미지, 없으면 중성 🎬 플레이스홀더(27개 미보유 스팟도 눌러 카드 확인 가능)
  const cardBase = `display:block;width:${MARKER_CARD_SIZE}px;height:${MARKER_CARD_SIZE}px;border-radius:17.5px;border:3px solid #fff;box-shadow:0 10px 30px rgba(0,0,0,0.55);margin:0 auto 5px;position:relative`;
  const card = selected
    ? spot.thumbnailUrl
      ? `<span style="${cardBase};background-image:url('${escapeHtml(spot.thumbnailUrl)}');background-size:cover;background-position:center"></span>`
      : `<span style="${cardBase};background:linear-gradient(135deg,var(--surface2),var(--card));display:flex;align-items:center;justify-content:center;font-size:30px">🎬</span>`
    : '';
  const inner = `${ping}
      ${card}
      <span style="${pillBase}${pillColor}">${name}</span>
      <span style="display:block;width:${MARKER_DOT_SIZE}px;height:${MARKER_DOT_SIZE}px;border-radius:50%;border:2px solid var(--bg);box-shadow:${dotShadow};background:${PRIMARY};position:relative"></span>`;

  // 점 중심 = 좌표 (항상): translate -100%(묶음 전체 — 카드·라벨 높이 자동 흡수) + 점높이/2 하향 보정.
  // 선택 토글 시 점·라벨은 제자리 고정, 카드만 라벨 위에 나타났다 사라진다. 미선택 총높이 ≈ 47px ≥ 44px (§5 히트 타겟)
  return `<div style="position:relative;width:0;height:0">
    <div style="position:absolute;left:0;top:0;transform:translate(-50%, calc(-100% + ${MARKER_DOT_SIZE / 2}px));display:flex;flex-direction:column;align-items:center;min-width:44px;padding:6px 8px 0;cursor:pointer">${inner}</div>
  </div>`;
}

// 0223: 미선택 라벨(pill) 폭 px 근사 — markerContent의 pill 파라미터 미러(font 12px, padding 9+9, border 1+1).
// 한글 12px(1em)·라틴/숫자 6.7·공백 4. 클릭 줌 계산의 겹침 폭에만 쓰임(렌더에는 무영향).
function labelWidthPx(name: string): number {
  let g = 0;
  for (const ch of name) g += ch === ' ' ? 4 : /[가-힣]/.test(ch) ? 12 : /[0-9A-Za-z]/.test(ch) ? 6.7 : 8;
  return g + 18 + 2;
}

// 클러스터 핀 — Logo.tsx 기하 참조(머리 원 + 삼각 꼬리 + 바닥 그림자). 흰 구멍은 제거(0220) — 숫자는 흰 글씨로 머리에 직접.
// viewBox 0 0 18 25, 36×50 렌더(k=2.0 균일): 머리 r8(⌀32) / tip(9,21)=좌표. 핀은 0220과 동일 좌표 — 캔버스 바닥에 1unit(2px)만 추가.
// 그림자 cy23.6(tip 아래 3px 띄움 — 0221, 입체감) rx3.2 ry1.1 PRIMARY. 바닥 여백은 그림자 안착용 투명 공간뿐(핀 크기·tip 위치 불변).
// C(세 자리 대비): 100+는 머리에 안 들어감 — 그때 "99+" 축약 필요. 지금은 미구현.
function clusterIconContent(): string {
  return `<div style="position:relative;width:36px;height:50px;cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">
    <svg viewBox="0 0 18 25" width="36" height="50" style="display:block">
      <ellipse cx="9" cy="23.6" rx="3.2" ry="1.1" fill="${PRIMARY}" opacity="0.55"/>
      <circle cx="9" cy="9" r="8" fill="${PRIMARY}"/>
      <polygon points="2,13 16,13 9,21" fill="${PRIMARY}"/>
    </svg>
    <span data-count style="position:absolute;left:0;top:0;width:36px;height:${(9 / 25) * 50 * 2}px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;line-height:1;transform:translateY(1px)">1</span>
  </div>`;
}

// 초기 뷰: 서울 확대 고정 시작 — 첫 화면에 개별 발광 마커+라벨이 보이게 (흥미 유발).
// 시딩 후 "최고 밀도 지역"으로 바꿀 땐 이 두 상수만 수정.
// 값 근거(실측): 중심 = 서울 4스팟 bbox 중점(평균이 아님 — 390px 뷰포트 폭 0.117°에
// 서쪽 끝 스팟이 들어오는 중심), 줌 11 = 1280px에서 4개 마커+라벨 전부 가시인 유일 줌(11.5부터 3/4)
const INITIAL_CENTER = { lat: 37.5658, lng: 126.94746 };
const INITIAL_ZOOM = 11;
// 0213: 포트폴리오 시연용 첫 화면 고정 스팟(seed=source='seed', 0208 청소 보호). 이름 기반 — id는 환경마다 다름(0207)
const FEATURED_SPOT_NAME = '롯데월드몰';
// 0217: 전체 뷰 fitBounds에서 제주(33도대) 제외 — 육지 최남단(해남 34.29)과 제주 최북(33.56) 사이.
// 실측상 lat 33.51(제주공항)~35.35(동부마을) 공백이라 34.0은 안전한 경계. 마커·목록엔 영향 없음(bounds 계산 전용).
const MAINLAND_LAT_MIN = 34.0;

// 3단계형 내비게이션: 칩 fitBounds·클러스터 클릭·리사이즈 재적합의 종착은 ② 분해 조망.
// 예외 — 스팟 클릭(handleSpotSelect)은 최근접 거리에서 비겹침 최소 줌을 연속 계산(z11~z16, 0223). 그 외 프로그램 이동은 ② 유지.
const STAGE2_MAX_ZOOM = 11; // ② 상한 = 클러스터러 분해 임계와 단일 소스 공유 (분해 "시작" 지점)
const DEGENERATE_SPAN_DEG = 0.0001; // ≈10m — "사실상 1개 지점" 판정 (판단값)
// 0223: 클릭 목표 줌을 최근접 이웃 거리에서 연속 계산(단계·임계 제거).
// z = round(log2(156543·cos(lat)·gapPx / D)), [z11, z16] 클램프. (줌 1↑ = 비겹침 거리 절반)
const SPOT_CLICK_ZOOM_MIN = 11; // = STAGE2_MAX_ZOOM (하한·분해 임계·맥락). 계산값 <11이면 11.
const SPOT_CLICK_ZOOM_MAX = 16; // 상한 — z16 비겹침 175m로 실 도심 전부 분리. 그 이하(구룡포 4m·중복좌표)는 불가, 여기서 멈춤.
const EQUATOR_MPP_Z0 = 156543; // z0 적도 m/px (Web Mercator). mpp(z) = EQUATOR·cos(lat)/2^z
// 0224: 모바일 지도 하단 뷰포트 패딩(px) — 하단 카드/탭바만큼 시각 중심을 위로(줌 무영향). ~카드높이·2 (중심은 pad/2 상승).
const MOBILE_MAP_PAD_BOTTOM = 300;
const MOBILE_MQ = '(max-width: 1023px)'; // lg(1024) 미만 = 모바일 뷰


// 전환 질감 단일 소스 — 모든 프로그램 이동(퇴화·일반 분해·칩)이 공유. 조정은 여기 한 곳.
// easing 'easeOutCubic' = SDK TransitionOptions 기본값(@types 주석 명시, 런타임 실측 확증)
const STAGE2_TRANSITION = { duration: 1200, easing: 'easeOutCubic' }; // duration 1000 = 사용자 체감 조정값

// fitBounds가 주던 마진 그대로 (top 110 = 모바일 플로팅 검색/칩 가림 보정)
const FIT_MARGIN = { top: 110, right: 40, bottom: 40, left: 40 };

function moveToStage2(map: naver.maps.Map, points: naver.maps.LatLng[]) {
  if (points.length === 0) return;
  let minLat = points[0].lat(), maxLat = minLat, minLng = points[0].lng(), maxLng = minLng;
  points.forEach((p) => {
    minLat = Math.min(minLat, p.lat()); maxLat = Math.max(maxLat, p.lat());
    minLng = Math.min(minLng, p.lng()); maxLng = Math.max(maxLng, p.lng());
  });
  if (Math.max(maxLat - minLat, maxLng - minLng) < DEGENERATE_SPAN_DEG) {
    // 퇴화 스팬: GL fitBounds가 무시함(실측) + 분해 무의미 → ② 상한으로 morph.
    // setZoom+setCenter는 0ms 점프(실측)라 기각. morph는 중심·줌 원자 전환이라 클램프 함정 없음
    map.morph(points[0], STAGE2_MAX_ZOOM, STAGE2_TRANSITION);
    return;
  }

  // fitBounds 대체: 줌·중심을 직접 산출해 morph — fitBounds는 duration/easing 노브가 없어
  // (내장 ~500ms 고정, 실측) 질감 통일 불가. Mercator 상수 하드코딩 대신 SDK 프로젝션에
  // 위임 (GL의 도/픽셀 비가 표준 256 기반 예측과 어긋났던 실측 이력 — 프로젝션은 정의상 일치)
  const proj = map.getProjection();
  const pSW = proj.fromCoordToOffset(new naver.maps.LatLng(minLat, minLng));
  const pNE = proj.fromCoordToOffset(new naver.maps.LatLng(maxLat, maxLng));
  const dx = Math.abs(pNE.x - pSW.x);
  const dy = Math.abs(pNE.y - pSW.y);
  const size = map.getSize();
  const availW = size.width - FIT_MARGIN.left - FIT_MARGIN.right;
  const availH = size.height - FIT_MARGIN.top - FIT_MARGIN.bottom;
  const currentZoom = map.getZoom();
  // 두 축이 모두 마진 안쪽에 담기는 최대 확대량
  const dz = Math.log2(Math.min(availW / dx, availH / dy));
  const targetZoom = Math.min(Math.max(currentZoom + dz, map.getMinZoom()), STAGE2_MAX_ZOOM);
  const s = Math.pow(2, targetZoom - currentZoom); // 캡 반영 후 실제 배율
  // 비대칭 마진 보정: bounds 중심이 마진 안쪽 사각형의 중앙에 오도록 (target px → 현재 줌 px 환산 = ÷s)
  const center = proj.fromOffsetToCoord(new naver.maps.Point(
    (pSW.x + pNE.x) / 2 - (FIT_MARGIN.left - FIT_MARGIN.right) / 2 / s,
    (pSW.y + pNE.y) / 2 - (FIT_MARGIN.top - FIT_MARGIN.bottom) / 2 / s,
  ));
  map.morph(center, targetZoom, STAGE2_TRANSITION);
}

function fitMapToSpots(map: naver.maps.Map, spots: SpotFinderSpot[]) {
  moveToStage2(map, spots.map((s) => new naver.maps.LatLng(s.lat, s.lng)));
}

type Props = { spots: SpotFinderSpot[] };

// 상세 콘텐츠 단일 정의 — 모바일 플로팅 카드와 데탑 우측 고정 패널이 공유 (내용·순서 동일)
function SpotDetailContent({ spot, onClose }: { spot: SpotFinderSpot; onClose: () => void }) {
  return (
    <>
      <div className="relative h-[210px] flex-shrink-0">
        {spot.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={spot.thumbnailUrl} alt={spot.name} className="w-full h-full object-cover" />
        ) : (
          <SpotCoverPlaceholder variant="hero" movieTitle={spot.primaryMovie.title} />
        )}
        {/* 시안 실측 스크림 — 하단 제목 가독 + 상단 X 대비. No Image 폴백에도 동일 적용해 흰 제목 가독 보장 */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(13,13,20,0.85)_0%,rgba(13,13,20,0.15)_45%,rgba(13,13,20,0.35)_100%)]"
        />
        {/* 작품 배지 — 시안 실측 top12/left14, 중립 오버레이 배경(작품색 매핑 부재로 기판정 제외) */}
        <div className="absolute top-3 left-3.5 flex">
          <span className="rounded-full bg-white/[0.18] px-[7px] py-[2px] text-xs font-normal text-white whitespace-nowrap">
            {spot.primaryMovie.title}{spot.extraMovieCount > 0 ? ` +${spot.extraMovieCount}` : ''}
          </span>
        </div>
        <div className="absolute left-4 right-4 bottom-[14px]">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] leading-[1.3] text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.60)]">
            {spot.name}
          </h2>
        </div>
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-card/80 hover:bg-card flex items-center justify-center flex-shrink-0 transition-colors text-fg shadow-sm"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium text-muted mb-1">촬영지 리뷰</p>
          {spot.review ? (
            <p className="text-sm text-fg2 whitespace-pre-wrap">{spot.review}</p>
          ) : (
            <p className="text-sm text-muted">리뷰 없음</p>
          )}
        </div>

        {/* 메타 — 아이콘 카드 2열 그리드 (시안 실측). 교통·별점·작품·스토리 (별점은 rating 있을 때만 → 2×2 완성).
            별점 없으면 미렌더(빈 별·0.0 금지). 새 색 토큰 없음. 부제 11px는 CLAUDE.md §5 하한(12px)으로 클램프 */}
        <div className="grid grid-cols-2 gap-[11px] border-b border-border pb-[15px]">
          {spot.nearestStation && spot.transitMinutes != null && (
            <div className="flex items-start gap-[9px]">
              <div className="w-[30px] h-[30px] rounded-[9px] bg-surface2 border border-border flex items-center justify-center shrink-0">
                <span className="text-[12.5px] leading-none">🚉</span>
              </div>
              {/* 주 문구 = 좌측 리스트 메타줄과 동일(formatTransit 단일 소스). 수단(도보/차로)이 이미 담겨 부제 생략(§8② 중복 회피) */}
              <span className="block text-[12.5px] font-normal text-fg break-keep">{formatTransit(spot.nearestStation, spot.transitMinutes, spot.transitMode)}</span>
            </div>
          )}
          {/* 별점 — rating 있을 때만(평균 파생). 순서: 교통 다음, 작품 앞 → 2×2 (교통·별점·작품·스토리) */}
          {spot.rating != null && (
            <div className="flex items-start gap-[9px]">
              <div className="w-[30px] h-[30px] rounded-[9px] bg-surface2 border border-border flex items-center justify-center shrink-0">
                <span className="text-[12.5px] leading-none">⭐</span>
              </div>
              <div className="min-w-0">
                <span className="block text-[12.5px] font-normal text-fg">{spot.rating.toFixed(1)}</span>
                <span className="block text-xs text-muted">평점 {spot.ratingCount}개</span>
              </div>
            </div>
          )}
          <div className="flex items-start gap-[9px]">
            <div className="w-[30px] h-[30px] rounded-[9px] bg-surface2 border border-border flex items-center justify-center shrink-0">
              <span className="text-[12.5px] leading-none">🎬</span>
            </div>
            <div className="min-w-0">
              <span className="block text-[12.5px] font-normal text-fg">작품 {spot.movieCount}편</span>
              <span className="block text-xs text-muted">이 장소에서 촬영</span>
            </div>
          </div>
          <div className="flex items-start gap-[9px]">
            <div className="w-[30px] h-[30px] rounded-[9px] bg-surface2 border border-border flex items-center justify-center shrink-0">
              <span className="text-[12.5px] leading-none">✍️</span>
            </div>
            <div className="min-w-0">
              <span className="block text-[12.5px] font-normal text-fg">스토리 {spot.storyCount}편</span>
              <span className="block text-xs text-muted">다녀온 기록</span>
            </div>
          </div>
        </div>

        {/* 이 장소의 작품 — 제목만 (썸네일·에피소드·년도·날짜 없음. B2 별점 미표시 — 자리 자체 없음) */}
        <div>
          <p className="text-xs font-medium text-muted mb-2">이 장소의 작품</p>
          <ul className="flex flex-col gap-2.5">
            {spot.movies.map((m) => (
              <li key={m.id}>
                <p className="text-sm text-fg">{m.title}</p>
                {/* per-link 촬영 장면 설명 — null이면 요소 자체 미렌더(빈 줄·플레이스홀더 금지) */}
                {m.description && (
                  <p className="mt-0.5 text-xs text-muted line-clamp-2 break-keep">{m.description}</p>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* 다녀온 이야기 — 카드형(시안): 사진(방문 증거) + 인용 발췌 + 메타(작성자·♥·날짜) + › .
            작품↔이야기 구분선은 이 래퍼의 border-t (조건부라 이야기 없으면 라인도 없음 — dangling 방지). */}
        {spot.stories.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-xs font-medium text-muted mb-2">다녀온 이야기</p>
            <ul className="flex flex-col gap-2">
              {spot.stories.map((story) => (
                <li key={story.id}>
                  {/* 카드 배경 surface2 — 모바일 플로팅(bg-card)·데탑 aside(bg-bg) 양쪽에서 보이는 유일 surface.
                      hover는 lighter 토큰 부재로 opacity solidify(휴지 /80 → hover 100%).
                      0210: Link로 스토리 상세 이동(같은 탭). story.id는 이미 내려옴 — 추가 쿼리 없음. */}
                  <Link href={`/story/${story.id}`} className="flex items-center gap-3 rounded-[13px] bg-surface2/80 px-3 py-2.5 transition-colors hover:bg-surface2">
                    {story.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={story.photoUrl} alt="" className="w-14 h-14 rounded-[10px] object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-[10px] bg-surface2 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] leading-[1.6] text-fg2 line-clamp-2 break-keep">&ldquo;{story.excerpt}&rdquo;</p>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                        <span className="truncate">{story.author.nickname}</span>
                        <span className="shrink-0 flex items-center gap-0.5">
                          <Heart size={11} /> {story.likeCount}
                        </span>
                        <span className="shrink-0">{formatYmd(story.createdAt)}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

export default function SpotFinderMapNaver({ spots }: Props) {
  const { ready, error } = useNaverMapsLoader();

  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<naver.maps.Map | null>(null);
  // 초기 자동 선택: 시연 고정 스팟(FEATURED_SPOT_NAME) ?? spots[0](최신순 폴백) = 상호작용 안내용 첫 화면.
  // handleSpotSelect(클릭 경로)를 타지 않는 state 초기값이라 지도 이동(panTo)이 구조적으로 없음
  const featuredSpot = useMemo(
    () => spots.find((s) => s.name === FEATURED_SPOT_NAME) ?? spots[0] ?? null,
    [spots],
  );
  const [selectedSpot, setSelectedSpot] = useState<SpotFinderSpot | null>(featuredSpot);
  const [detailOpen, setDetailOpen] = useState(false); // 0224: 모바일 상세 풀스크린 모달(?detail=id, 네이티브 history)
  const selectedItemRef = useRef<HTMLLIElement | null>(null); // 0214: 첫 진입 스크롤 대상(선택 li)
  const didInitialScrollRef = useRef(false); // 0214: 첫 진입 1회 가드
  const [searchQuery, setSearchQuery] = useState('');
  const [showArrows, setShowArrows] = useState(false);
  const chipBarRef = useRef<HTMLDivElement>(null);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const userInteractedRef = useRef(false);
  const lastSizeRef = useRef({ w: 0, h: 0 });
  const prevMovieIdRef = useRef<string | null>(null); // Effect A 마운트 발화 차단용 이전 칩 값
  const hasFitRef = useRef(false); // 프로그램 fit 이력 — 리사이즈 재적합의 초기 뷰 점프 방지
  // 명령형 마커 관리 — 마커 리빌드 없이 최신 선택/핸들러 참조 유지
  const markersRef = useRef(new Map<string, naver.maps.Marker>());
  const clustererRef = useRef<MarkerClusteringInstance | null>(null);
  const selectedSpotRef = useRef<SpotFinderSpot | null>(null);
  const prevSelectedIdRef = useRef<string | null>(null);
  const handleSpotSelectRef = useRef<(s: SpotFinderSpot) => void>(() => { });

  // 렌더 중 ref 쓰기 금지(react-hooks 규칙) — 커밋 후 동기화. 마커 effect보다 먼저 선언되어 같은 커밋 내 선행 실행
  useEffect(() => {
    selectedSpotRef.current = selectedSpot;
  }, [selectedSpot]);

  // 작품별 그룹핑 + 칩 정렬 — 이미 전량 내려온 spots의 파생 집계 (별도 집계 쿼리는 이중 소스라 기각).
  // S2: 한 스팟이 복수 작품에 속하므로 s.movies 순회 (스팟은 각 소속 작품 그룹에 카운트)
  const movieGroups = useMemo(() => {
    const acc = spots.reduce<Record<string, { title: string; count: number; latestAt: number }>>(
      (rec, s) => {
        const t = new Date(s.createdAt).getTime();
        for (const m of s.movies) {
          if (rec[m.id]) {
            rec[m.id].count++;
            rec[m.id].latestAt = Math.max(rec[m.id].latestAt, t);
          } else {
            rec[m.id] = { title: m.title, count: 1, latestAt: t };
          }
        }
        return rec;
      },
      {}
    );
    return Object.entries(acc)
      .map(([id, v]) => ({ id, ...v }))
      // 정렬 규칙: ① 스팟 수 내림차순 → ② 최근 스팟 등록 시각 내림차순 ("전체" 칩은 별도 버튼 — 항상 맨 앞)
      .sort((a, b) => b.count - a.count || b.latestAt - a.latestAt);
  }, [spots]);

  // 검색 매칭의 단일 소스 — 작품명 OR 스팟명 (주소·지역 비지원 = 서비스 정체성, 촬영지 탐색).
  // 소비자는 칩·리스트만 — 지도 마커(visibleSpots)에 태우면 키스트로크마다 클러스터 전체
  // 파괴·재생성이라 제외 (검색 = 찾기 도구, 칩·리스트 클릭 = 필터·이동 도구 역할 분리)
  const spotMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return (s: SpotFinderSpot) =>
      s.name.toLowerCase().includes(q) || s.movies.some((m) => m.title.toLowerCase().includes(q));
  }, [searchQuery]);

  const filteredMovieGroups = useMemo(() => {
    if (!spotMatches) return movieGroups;
    // 칩 = 매칭 스팟을 보유한 작품 (작품명 매치 시 전 스팟이 매치 — 현행 결과 완전 포함).
    // 카운트는 작품 전체 스팟 수 유지 (movieGroups 집계 그대로)
    return movieGroups.filter((g) => spots.some((s) => s.movies.some((m) => m.id === g.id) && spotMatches(s)));
  }, [movieGroups, spots, spotMatches]);

  const visibleSpots = useMemo(
    () => selectedMovieId
      ? spots.filter((s) => s.movies.some((m) => m.id === selectedMovieId))
      : spots,
    [spots, selectedMovieId]
  );

  // 리스트 전용 검색 적용 — 지도 마커는 visibleSpots 그대로 (위 주석의 역할 분리)
  const listSpots = useMemo(
    () => (spotMatches ? visibleSpots.filter(spotMatches) : visibleSpots),
    [visibleSpots, spotMatches]
  );

  // 0217: fitBounds 입력 — "전체" 칩(selectedMovieId=null)일 때만 제주 제외(과축소·흔들림 제거).
  // 작품 칩은 visibleSpots 그대로(무변경). 전부 제주면(작품 칩 아닌 한 불가) visibleSpots로 폴백.
  // 마커·목록(visibleSpots/listSpots)은 무영향 — 제주는 계속 노출.
  const boundsSpots = useMemo(() => {
    if (selectedMovieId !== null) return visibleSpots;
    const mainland = visibleSpots.filter((s) => s.lat >= MAINLAND_LAT_MIN);
    return mainland.length > 0 ? mainland : visibleSpots;
  }, [visibleSpots, selectedMovieId]);

  // 지도 생성 — 명령형 init/destroy (StrictMode 이중 마운트 안전, GL 컨텍스트 해제)
  useEffect(() => {
    if (!ready || !mapDivRef.current) return;
    // WebGL 미지원 환경(구형 기기·차단·일부 헤드리스): 래스터 폴백 — 커스텀 스타일만 미적용, 기능 동일
    const supportsGl = !!document.createElement('canvas').getContext('webgl');
    if (!supportsGl) console.warn('[SpotFinderMapNaver] WebGL 미지원 — 래스터 폴백 (커스텀 스타일 미적용)');
    // 초기 중심 = 초기 선택 스팟(featuredSpot — 시연 고정 ?? spots[0]) — 선택 마커가 화면 크기와 무관하게 정중앙 시작.
    // 못 찾거나 spots가 비면 INITIAL_CENTER(서울 bbox 중점) 폴백. 생성 옵션만 — 렌더 후 이동 없음(0172 원칙)
    const first = featuredSpot;
    const map = new naver.maps.Map(mapDivRef.current, {
      center: new naver.maps.LatLng(first?.lat ?? INITIAL_CENTER.lat, first?.lng ?? INITIAL_CENTER.lng),
      zoom: INITIAL_ZOOM, // 초기 뷰 = 서울 확대 (전체 fitBounds 시작 폐지 — Effect A 마운트 발화 가드 참조)
      minZoom: 6,
      maxBounds: new naver.maps.LatLngBounds(
        new naver.maps.LatLng(KOREA_BOUNDS.south, KOREA_BOUNDS.west),
        new naver.maps.LatLng(KOREA_BOUNDS.north, KOREA_BOUNDS.east),
      ),
      // customStyleId는 GL(벡터) 전용. STYLE_VERSION env는 JS SDK에 대응 옵션이 없음 —
      // Style Editor 배포 버전이 자동 반영되므로 미소비 (발명 금지)
      ...(supportsGl
        ? { gl: true, customStyleId: process.env.NEXT_PUBLIC_NAVER_MAP_STYLE_ID }
        : {}),
    });
    // GL 지도는 비동기 초기화 — init 전에 fitBounds/클러스터러를 붙이면 빈 bounds로
    // 계산되어 마커가 그려지지 않는다 (실측). init 이벤트 후 인스턴스 공개.
    const initListener = naver.maps.Event.once(map, 'init', () => setMapInstance(map));
    return () => {
      naver.maps.Event.removeListener(initListener);
      setMapInstance(null);
      map.destroy();
    };
    // spots를 deps에 넣지 않음(의도): RSC prop이라 router.refresh/revalidate 시 새 참조로 내려와
    // 지도가 파괴·재생성됨(뷰·줌 소실). init effect는 1회 생성이 의도 — spots[0]은 최초 마운트 값만 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // 0214: 첫 진입 시 좌측 목록을 선택 스팟(featuredSpot)으로 스크롤 — 선택 카드가 화면 중앙에 보이게.
  // 리스트는 ready 이후에만 렌더(605)라 [ready]에 발화 + 1회 가드. 폴백(=맨 위)·featured 부재 시 스킵(불필요 스크롤 방지).
  useEffect(() => {
    if (!ready || didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    if (featuredSpot && listSpots[0]?.id !== featuredSpot.id) {
      selectedItemRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' }); // 즉시 위치, 애니메이션 없음
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // 마커·클러스터 구축 — visibleSpots 변경 시 파괴·재생성 (공식 유틸에 setMarkers 없음).
  // 칩 fitBounds effect보다 먼저 선언 필수: 애니메이션 시작 후 오버레이 대량 탈부착이 겹치면 GL 지도 이동이 동결됨 (실측)
  useEffect(() => {
    if (!mapInstance) return;
    const MarkerClustering = getMarkerClusteringClass();
    const markerIndex = markersRef.current; // 클린업 시점 ref 재조회 경고 회피 — 같은 Map 인스턴스 캡처
    const markers = visibleSpots.map((spot) => {
      const selected = selectedSpotRef.current?.id === spot.id;
      const marker = new naver.maps.Marker({
        // map 미지정 — 클러스터러가 클러스터 상태에 따라 부착/해제를 관리
        position: new naver.maps.LatLng(spot.lat, spot.lng),
        // 0-크기 콘텐츠 + 내부 translate(-50%,-100%) 구조라 anchor는 (0,0) — 하단 중앙 = 좌표
        icon: { content: markerContent(spot, selected), anchor: new naver.maps.Point(0, 0) },
        zIndex: selected ? 10 : 1,
      });
      naver.maps.Event.addListener(marker, 'click', () => handleSpotSelectRef.current(spot));
      markerIndex.set(spot.id, marker);
      return marker;
    });
    const clusterer = new MarkerClustering({
      map: mapInstance,
      markers,
      averageCenter: true,
      minClusterSize: 1,
      maxZoom: STAGE2_MAX_ZOOM, // 분해 임계 = 프로그램 이동 상한 (단일 소스)
      gridSize: 120,
      disableClickZoom: false,
      // 클러스터 클릭 = 멤버 bounds로 분해 스냅 (벤더 패치 3건 위임).
      // 멤버가 사실상 1지점이면 moveToStage2의 퇴화 경로가 ② 상한 직행으로 자연 분기
      onClusterClick: (members: naver.maps.Marker[]) => {
        moveToStage2(mapInstance, members.map((m) => m.getPosition() as naver.maps.LatLng));
      },
      icons: [{ content: clusterIconContent(), size: new naver.maps.Size(36, 50), anchor: new naver.maps.Point(18, 42) }], // 핀 tip(18,42)이 좌표 (캔버스 50, 바닥 2px는 그림자용)
      indexGenerator: [Infinity], // 단일 아이콘 — 카카오 CLUSTER_STYLES 1개와 동일
      stylingFunction: (clusterMarker, count) => {
        const root = (clusterMarker as unknown as { getElement(): HTMLElement | null }).getElement();
        const el = root?.querySelector('[data-count]'); // SVG 아닌 count 전용 요소만 갱신
        if (el) el.textContent = String(count);
      },
    });
    clustererRef.current = clusterer;
    return () => {
      // 순서 중요: 클러스터러 먼저 해제 — 역순이면 idle 재그리기가 유령 마커를 재부착
      clusterer.setMap(null);
      markers.forEach((m) => m.setMap(null));
      markerIndex.clear();
      clustererRef.current = null;
    };
  }, [mapInstance, visibleSpots]);

  // 선택 변경 — 전체 리빌드 대신 prev/next 두 마커만 아이콘 교체 (클러스터 플리커 방지, setIcon=DOM 교체라 핑 재시작 보장)
  useEffect(() => {
    const prevId = prevSelectedIdRef.current;
    if (prevId && prevId !== selectedSpot?.id) {
      const prev = markersRef.current.get(prevId);
      const prevSpot = spots.find((s) => s.id === prevId);
      if (prev && prevSpot) {
        prev.setIcon({ content: markerContent(prevSpot, false), anchor: new naver.maps.Point(0, 0) });
        prev.setZIndex(1);
      }
    }
    if (selectedSpot) {
      const next = markersRef.current.get(selectedSpot.id);
      if (next) {
        next.setIcon({ content: markerContent(selectedSpot, true), anchor: new naver.maps.Point(0, 0) });
        next.setZIndex(10);
      }
    }
    prevSelectedIdRef.current = selectedSpot?.id ?? null;
  }, [selectedSpot, spots]);


  // 칩 클릭 시 자동 줌 — visibleSpots 대신 selectedMovieId 의존으로 무한루프 방지.
  // 이전 값 비교 가드: 마운트·지도 재생성 시(null===null) 발화하지 않아 초기 서울 뷰가 유지된다
  // (구 "초기 전체 fitBounds"의 실체가 이 마운트 발화였음). "전체" 칩은 여전히 전국 조망 복귀.
  useEffect(() => {
    if (!mapInstance || visibleSpots.length === 0) return;
    if (selectedMovieId === prevMovieIdRef.current) return;
    prevMovieIdRef.current = selectedMovieId;
    hasFitRef.current = true;
    fitMapToSpots(mapInstance, boundsSpots); // 0217: 전체 칩 시 제주 제외된 육지 bounds
  }, [selectedMovieId, mapInstance]);

  // 사용자 조작 감지 — 순수 제스처만 신뢰 (dragstart/pinchstart/dblclick + DOM wheel).
  // 카카오 zoom_start 대응인 zoom_changed는 애니메이션 fitBounds 중에도 계속 발화해
  // 시간창 가드로도 오탐이 남는다 (실측: 초기 fit 애니메이션이 사용자 조작으로 오인됨)
  useEffect(() => {
    if (!mapInstance) return;
    const markInteracted = () => { userInteractedRef.current = true; };
    // removeListener는 핸들 기반 — 카카오식 (target, type, fn) 해제는 조용히 누수
    const listeners = [
      naver.maps.Event.addListener(mapInstance, 'dragstart', markInteracted),
      naver.maps.Event.addListener(mapInstance, 'pinchstart', markInteracted),
      naver.maps.Event.addListener(mapInstance, 'dblclick', markInteracted),
    ];
    const el = mapDivRef.current;
    el?.addEventListener('wheel', markInteracted, { passive: true });
    return () => {
      listeners.forEach((l) => naver.maps.Event.removeListener(l));
      el?.removeEventListener('wheel', markInteracted);
    };
  }, [mapInstance]);

  // 칩 바 넘침 감지 — 폰트 스왑 후 재측정 포함(Pretendard 로드 완료 시)
  useEffect(() => {
    const el = chipBarRef.current;
    if (!el) return;
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      setShowArrows(el.scrollWidth > el.clientWidth);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    document.fonts?.ready?.then(check);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [filteredMovieGroups, ready]);

  // 컨테이너 크기 변경 시: 항상 relayout, 사용자 조작 전이면 bounds 재적합 / 이후면 center 보존
  useEffect(() => {
    const el = mapWrapperRef.current;
    if (!el || !mapInstance) return;
    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      // 재-observe 즉발 콜백 가드: visibleSpots 변경으로 effect가 재실행되면 observe가
      // 즉시 콜백을 발화하는데, 크기 불변이면 무시 — 진행 중인 fit 애니메이션에
      // autoResize/setCenter가 끼어들어 지도 이동이 동결되는 충돌 방지 (실측)
      const { width, height } = el.getBoundingClientRect();
      if (width === lastSizeRef.current.w && height === lastSizeRef.current.h) return;
      lastSizeRef.current = { w: width, h: height };
      frame = requestAnimationFrame(() => {
        const center = mapInstance.getCenter();
        mapInstance.autoResize(); // 카카오 relayout() 상응
        if (!userInteractedRef.current && hasFitRef.current && visibleSpots.length > 0) {
          fitMapToSpots(mapInstance, boundsSpots); // 0217: 전체 상태 리사이즈 재적합도 제주 제외 유지
        } else {
          mapInstance.setCenter(center); // 초기 서울 뷰·사용자 조작 후 = 중심 보존 (전체 fit 점프 방지)
        }
      });
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [mapInstance, boundsSpots]);

  function scrollChips(dir: 'left' | 'right') {
    chipBarRef.current?.scrollBy({ left: dir === 'right' ? 150 : -150, behavior: 'smooth' });
  }

  // 스팟 선택 단일 정의 — 마커·좌측 리스트가 공유 (규율 5)
  function handleSpotSelect(spot: SpotFinderSpot) {
    setSelectedSpot(spot);
    if (!mapInstance) return;
    // 0223: 최근접 이웃까지 거리에서 "라벨이 안 겹치는 최소 줌"을 연속 계산. 비교 대상 = visibleSpots(렌더 마커). 매 클릭 O(n) 무해.
    let nearest = Infinity, nearestSpot: SpotFinderSpot | null = null;
    for (const other of visibleSpots) {
      if (other.id === spot.id) continue;
      const d = haversineM(spot.lat, spot.lng, other.lat, other.lng);
      if (d < nearest) { nearest = d; nearestSpot = other; }
    }
    let targetZoom = SPOT_CLICK_ZOOM_MIN; // 이웃 없음 → 하한(z11) 맥락
    if (nearestSpot) {
      // 비겹침: 중심거리(px) ≥ 두 라벨 half폭 합 = (Wa+Wb)/2. px = m/mpp, mpp = 156543·cos(lat)/2^z.
      // ⇒ z = log2(156543·cos(lat)·gapPx / D). 라벨 폭은 실제 이름 길이(긴 이름 = 더 넓은 간격 필요).
      const gapPx = (labelWidthPx(spot.name) + labelWidthPx(nearestSpot.name)) / 2;
      const mppZ0 = EQUATOR_MPP_Z0 * Math.cos((spot.lat * Math.PI) / 180);
      const zReq = Math.log2((mppZ0 * gapPx) / nearest); // nearest=0(중복좌표) → +Inf → 상한 클램프
      targetZoom = Math.max(SPOT_CLICK_ZOOM_MIN, Math.min(SPOT_CLICK_ZOOM_MAX, Math.round(zReq)));
    }
    // 구룡포(4m)·중복좌표 등 어떤 줌으로도 안 풀리는 초밀집은 상한(z16)에서 멈춤 — 완전 분리 불가(별건).
    // morph로 중심·줌 원자 전환(panTo는 줌 미변경). 계산 줌 모두 ≥maxZoom(11)이라 클러스터 분해. 초기 선택은 이 경로 미경유(0172 불변).
    mapInstance.morph(new naver.maps.LatLng(spot.lat, spot.lng), targetZoom, STAGE2_TRANSITION);
  }

  // 0224: 선택 디스패처 — 모바일은 pan-only(줌 유지, Airbnb 표준: 과확대 않고 ‹›로 옆 스팟 맥락 유지),
  // 데스크탑은 handleSpotSelect(0223 거리기반 확대) 그대로. 마커·카드·페이저 전부 이 경로 공유. handleSpotSelect 무수정.
  function selectSpot(spot: SpotFinderSpot) {
    if (typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches) {
      setSelectedSpot(spot);
      mapInstance?.panTo(new naver.maps.LatLng(spot.lat, spot.lng), STAGE2_TRANSITION); // 줌 미변경, 하단 패딩 반영해 카드 위 중앙
      return;
    }
    handleSpotSelect(spot);
  }

  // 마커 클릭 리스너의 스테일 클로저 방지 — 매 커밋 최신 핸들러 동기화 (렌더 중 ref 쓰기 금지 규칙 준수)
  useEffect(() => {
    handleSpotSelectRef.current = selectSpot; // 마커 클릭도 디스패처 경유(모바일 pan-only / 데스크탑 확대)
  });

  // 0224: 모바일 지도 하단 패딩 — 선택 스팟이 하단 카드에 안 가리게 시각 중심 상향(줌 무영향, 네이티브 padding MapOption).
  useEffect(() => {
    if (!mapInstance) return;
    const mq = window.matchMedia(MOBILE_MQ);
    const apply = () => mapInstance.setOptions('padding', { bottom: mq.matches ? MOBILE_MAP_PAD_BOTTOM : 0 });
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mapInstance]);

  // 0224: 상세 모달 열기 — ?detail=id를 네이티브 history로 push(Next 라우터 미경유 → 지도 재마운트·선택·중심·줌 보존).
  function openDetail(spot: SpotFinderSpot) {
    window.history.pushState({ detail: spot.id }, '', '?detail=' + spot.id);
    setDetailOpen(true);
  }
  // 뒤로가기(popstate) → 모달만 닫음. 페이지 이탈 없음.
  useEffect(() => {
    const onPop = () => setDetailOpen(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  if (error) {
    return (
      <div className="w-full h-full bg-card flex items-center justify-center p-6 text-center">
        <p className="text-sm text-muted">지도를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
      </div>
    );
  }
  if (!ready) return <div className="w-full h-full bg-card animate-pulse" />;

  return (
    <div ref={mapWrapperRef} className="relative w-full h-full flex">
      {/* 좌측 칼럼 — 모바일: 지도 위 플로팅(absolute) / md: 320px 정적 열 (같은 DOM, 클래스 전환).
          열 구분선 0.12 = 시안 --t15 실측값 — 시안 t13(0.08)과 동일값이었으나 체감 보강으로 상위 단계 채택 (구분선 한정, border 토큰 무변) */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-col gap-2 lg:static lg:top-auto lg:left-auto lg:right-auto lg:z-auto lg:w-[320px] lg:shrink-0 lg:h-full lg:bg-bg lg:border-r lg:border-[rgba(255,255,255,0.12)] lg:p-3">
        {/* 데탑 전용 헤더 — 시안 실측 18/20/10, 칼럼 md:p-3(12)+gap-2(8) 보정. 눈썹은 하한 준수 12px(시안 11px) */}
        <div className="hidden lg:block pt-1.5 px-2 pb-0.5">
          <p className="text-xs font-normal tracking-widest text-primary">SpotFinder</p>
          <h1 className="mt-1 text-base font-semibold tracking-[-0.02em] text-fg break-keep">
            영화·드라마 촬영지 검색
          </h1>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="작품명·촬영지를 입력하세요"
          className="w-full rounded-xl px-4 py-2 text-sm border border-border bg-card text-fg placeholder:text-muted shadow-sm transition-[color,border-color,box-shadow] duration-200 ease-out hover:border-muted focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(77,158,255,0.15)]"
        />

        <div className="flex items-center gap-2 rounded-xl border border-border bg-card/80 backdrop-blur-sm shadow-sm px-2 py-1.5">
          {showArrows && (
            <button
              type="button"
              aria-label="이전"
              onClick={() => scrollChips('left')}
              className="hidden lg:flex shrink-0 w-7 h-7 rounded-full bg-card text-fg items-center justify-center shadow-sm hover:bg-surface2 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
          )}
          <div ref={chipBarRef} className="flex-1 flex gap-2 overflow-x-auto min-w-0 [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setSelectedMovieId(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${selectedMovieId === null
                ? 'bg-primary text-white border-primary'
                : 'bg-card text-fg2 border-border'
                }`}
            >
              전체 ({spots.length})
            </button>
            {filteredMovieGroups.map((g) => (
              <button
                type="button"
                key={g.id}
                onClick={() => setSelectedMovieId(g.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${selectedMovieId === g.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-fg2 border-border'
                  }`}
              >
                {g.title} ({g.count})
              </button>
            ))}
          </div>
          {showArrows && (
            <button
              type="button"
              aria-label="다음"
              onClick={() => scrollChips('right')}
              className="hidden lg:flex shrink-0 w-7 h-7 rounded-full bg-card text-fg items-center justify-center shadow-sm hover:bg-surface2 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* 스팟 리스트 (lg 전용) — 시안 실측 구성: 썸네일 48 + 이름 + 배지 (메타줄은 데이터 부재로 생략) */}
        <ul className="hidden lg:flex flex-col gap-[7px] flex-1 overflow-y-auto min-h-0">
          {listSpots.map((spot) => {
            const selected = selectedSpot?.id === spot.id;
            return (
              <li key={spot.id} ref={selected ? selectedItemRef : undefined}>
                <button
                  type="button"
                  onClick={() => handleSpotSelect(spot)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${selected
                    ? 'border-primary bg-primary/[0.08]'
                    : 'border-transparent hover:bg-card'
                    }`}
                >
                  {spot.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={spot.thumbnailUrl}
                      alt=""
                      className="w-12 h-12 rounded-[10px] object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-[10px] overflow-hidden shrink-0">
                      <SpotCoverPlaceholder variant="list" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 text-sm font-semibold text-fg truncate">{spot.name}</p>
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-surface2 text-fg2 text-xs px-2 py-0.5 border border-border">
                        {spot.primaryMovie.title}{spot.extraMovieCount > 0 ? ` +${spot.extraMovieCount}` : ''}
                      </span>
                    </div>
                    {/* 교통 메타줄 — 시안 위치(이름 아래, mt 3px, muted). 12px = 하한 준수(시안 11px). 두 값 모두 있을 때만 */}
                    {spot.nearestStation && spot.transitMinutes != null && (
                      <p className="mt-[3px] text-xs text-muted truncate">
                        {formatTransit(spot.nearestStation, spot.transitMinutes, spot.transitMode)}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* 길찾기 딥링크 — 열 flex-col + 리스트 flex-1 구조라 자연 하단 고정. 모바일은 플로팅
            스택 하단(앱 스킴 경로). 스타일 = 기존 primary 버튼 문법(Write) 재사용 + w-full */}
        {selectedSpot && (
          <button
            type="button"
            onClick={() => openNaverDirections(selectedSpot)}
            className="hidden lg:block w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            &quot;{selectedSpot.name}&quot; 길찾기
          </button>
        )}
      </div>

      {/* 지도 영역 — 좌측 열·우측 패널을 제외한 남은 폭. 우측 경계 = 시안 실측 (3열 구분선) */}
      <div className="relative flex-1 min-w-0 lg:border-r lg:border-[rgba(255,255,255,0.12)]">

        {/* 우하단 안내 배너 — 제공 범위 + 공공데이터 출처 표기(의무). 2행 스택, items-start로 아이콘 상단 정렬 */}
        <div className="absolute right-3 z-[40] bottom-[calc(56px+env(safe-area-inset-bottom)+12px)] lg:bottom-6 lg:z-[1000] pointer-events-none flex items-start gap-1.5 rounded-xl border border-border bg-card/80 backdrop-blur-sm px-3 py-1.5 shadow-sm">
          <Info size={12} className="mt-0.5 text-muted shrink-0" />
          <div className="flex flex-col leading-snug">
            <span className="text-xs text-fg2">촬영지 정보는 국내만 제공됩니다</span>
            <span className="text-xs text-muted">출처: 한국문화정보원 미디어콘텐츠</span>
          </div>
        </div>

        {/* 지도 캔버스 — 마커·클러스터·이동은 명령형 effect가 관리 (네이버 SDK 직접 소비) */}
        <div ref={mapDivRef} className="w-full h-full" />
      </div>

      {/* 데탑 우측 고정 패널 (A005 §8 미결1 잠정 채택 — 시안 실측 350px, bg 층) */}
      <aside className="hidden lg:flex w-[350px] shrink-0 flex-col bg-bg">
        {selectedSpot ? (
          <SpotDetailContent spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-5">
            <div className="w-2 h-2 rounded-full bg-primary mb-2.5" />
            <p className="text-xs text-muted leading-relaxed">
              탐색할 촬영지가 있어요.
              <br />
              촬영지를 선택하면 상세 정보가 표시됩니다.
            </p>
          </div>
        )}
      </aside>

      {/* 0224: 모바일 하단 선택 카드 (lg:hidden, 지도 위 floating). 탭바(h-14=56) 위에 안착. */}
      {selectedSpot && (() => {
        const idx = visibleSpots.findIndex((s) => s.id === selectedSpot.id);
        const n = visibleSpots.length;
        const go = (delta: number) => { if (n > 1 && idx >= 0) selectSpot(visibleSpots[(idx + delta + n) % n]); };
        return (
          <div className="lg:hidden fixed inset-x-3 z-[45] bottom-[calc(56px+env(safe-area-inset-bottom)+12px)] flex items-center gap-3 rounded-2xl border border-border bg-card shadow-lg p-3">
            {selectedSpot.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedSpot.thumbnailUrl} alt="" className="w-14 h-14 rounded-[10px] object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-[10px] overflow-hidden shrink-0">
                <SpotCoverPlaceholder variant="list" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="min-w-0 text-sm font-semibold text-fg truncate break-keep">{selectedSpot.name}</p>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-surface2 text-fg2 text-xs px-2 py-0.5 border border-border">
                  {selectedSpot.primaryMovie.title}{selectedSpot.extraMovieCount > 0 ? ` +${selectedSpot.extraMovieCount}` : ''}
                </span>
              </div>
              {selectedSpot.nearestStation && selectedSpot.transitMinutes != null && (
                <p className="mt-[3px] text-xs text-muted truncate">
                  {formatTransit(selectedSpot.nearestStation, selectedSpot.transitMinutes, selectedSpot.transitMode)}
                </p>
              )}
              <p className="mt-[3px] text-xs text-muted">스토리 {selectedSpot.storyCount}편</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => openDetail(selectedSpot)}
                className="min-h-[44px] rounded-full bg-primary px-4 text-sm font-semibold text-white"
              >
                상세
              </button>
              {n > 1 && (
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="이전 스팟" onClick={() => go(-1)} className="w-11 h-11 flex items-center justify-center rounded-full text-fg2 hover:bg-surface2 transition-colors">
                    <ChevronLeft size={18} />
                  </button>
                  <button type="button" aria-label="다음 스팟" onClick={() => go(1)} className="w-11 h-11 flex items-center justify-center rounded-full text-fg2 hover:bg-surface2 transition-colors">
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 0224: 모바일 상세 풀스크린 모달 (?detail=id, 탭바까지 덮음). 지도 인스턴스 유지 → 뒤로가기/X로 선택·위치·줌 보존. */}
      {detailOpen && selectedSpot && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-bg overflow-y-auto" style={{ height: '100svh' }}>
          <SpotDetailContent spot={selectedSpot} onClose={() => window.history.back()} />
        </div>
      )}
    </div>
  );
}
