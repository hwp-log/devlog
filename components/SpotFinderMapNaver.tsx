'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Info, Heart } from 'lucide-react';
import type { SpotFinderSpot } from '@/lib/spot/queries';
import { theme, withAlpha } from '@/lib/theme';
import { useNaverMapsLoader, type NaverLoaderStatus } from '@/lib/naver/useNaverMapsLoader';
import { SpotFinderMapSlot } from './SpotFinderMapSlot';
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
  // 0269 확정: 미선택 = 회색 pill(목업 스펙) — 밝은 테두리(흰 0.5)+상단 inset 하이라이트가 다크 지도 지명과의 구분을 담당
  // (앰버 0267~0268은 실기기 비교로 기각 — 토큰도 삭제). 선택 = primary 파랑, 그림자 문법만 통일.
  // 그라데이션 밝은 톤 #33383d 리터럴 근거: surface2(#26292b)의 흰색 혼합 파생으로는 목업의 청색 성분(+5B)이 재현 안 됨
  // — color-mix 파생(0268 관례) 불가 판정, 목업 확정값을 그대로 사용.
  const pillColor = selected
    ? `background:linear-gradient(to bottom,color-mix(in srgb,${PRIMARY} 82%,#fff),${PRIMARY});color:#fff;border:1px solid ${PRIMARY};box-shadow:inset 0 1px 0 rgba(255,255,255,0.2),0 2px 6px rgba(0,0,0,0.4);`
    : 'background:linear-gradient(to bottom,#33383d,var(--surface2));color:var(--fg2);border:1px solid rgba(255,255,255,0.5);box-shadow:inset 0 1px 0 rgba(255,255,255,0.14),0 2px 6px rgba(0,0,0,0.4);';
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
  // 0270: data-pill = hover 강조 CSS 타깃(globals.css — pill엔 inline transform이 없어 클래스 transform이 안전)
  const inner = `${ping}
      ${card}
      <span data-pill style="${pillBase}${pillColor}">${name}</span>
      <span style="display:block;width:${MARKER_DOT_SIZE}px;height:${MARKER_DOT_SIZE}px;border-radius:50%;border:2px solid var(--bg);box-shadow:${dotShadow};background:${PRIMARY};position:relative"></span>`;

  // 점 중심 = 좌표 (항상): translate -100%(묶음 전체 — 카드·라벨 높이 자동 흡수) + 점높이/2 하향 보정.
  // 선택 토글 시 점·라벨은 제자리 고정, 카드만 라벨 위에 나타났다 사라진다. 미선택 총높이 ≈ 47px ≥ 44px (§5 히트 타겟)
  // 0270: data-spot-id = 데탑 목록 hover가 이 마커 DOM을 찾는 키(setIcon 재생성 없이 classList 토글 — SDK API 비의존)
  return `<div data-spot-id="${escapeHtml(spot.id)}" style="position:relative;width:0;height:0">
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
// 0243→0281: 모바일 지도 하단 패딩 — 고정 200px는 시트 half(svh 비례)와 파생 페어가 어긋나
// 큰 뷰포트(브라우저 모바일 뷰)에서 선택 마커가 가시 영역 중앙을 이탈(0281 확증) → 시트 half
// 공칭 산식에서 파생 계산으로 대체. SHEET_MAX_H.half(58svh·359px) ↔ SLOT_TOP(SpotFinderMapSlot)
// ↔ computeMapPadBottom 3자 페어 — 한쪽만 바꾸면 어긋남.
// MARKER_BLOCK_CENTER_OFFSET = 좌표(점 중심)에서 마커 블록(카드+pill+점) 중심까지 위쪽 거리.
// 유도: 점 위 5.5(MARKER_DOT_SIZE/2) + 4(pill 간격) + pill≈31(15px font+패딩+보더, 판단값) +
// 5(카드 간격) + MARKER_CARD_SIZE 72.5 ≈ 블록 118 → 중심 ≈ 좌표 −56. 실기기 체감 조정 여지.
const MARKER_BLOCK_CENTER_OFFSET = 56;
// pad = 시트half − 2×블록보정 → 좌표 안착점 = (H−pad)/2 = 가시영역 중앙 + 56 = "블록 중심이
// 가시 영역 수직 중앙"이 모든 뷰포트 높이에서 성립(0281 사용자 확정 기준: 카드 블록 중앙).
// svh는 지도 div clientHeight로 역산(innerHeight는 iOS 주소창에 흔들림 — CSS svh 확정값 사용).
// safe-area는 지도 div 인라인 --sab(env)를 computed로 읽음(0279 --card·0261 env computed 선례).
// 브라우저는 env=0이라 자동으로 0.58·svh 항이 지배.
function computeMapPadBottom(mapEl: HTMLElement): number {
  const svh = mapEl.clientHeight;
  const sab = parseFloat(getComputedStyle(mapEl).getPropertyValue('--sab')) || 0;
  const sheetHalf = Math.max(0.58 * svh, 359 + sab);
  return Math.max(0, sheetHalf - 2 * MARKER_BLOCK_CENTER_OFFSET);
}
const MOBILE_MQ = '(max-width: 1023px)'; // lg(1024) 미만 = 모바일 뷰
// 0246→0247: 모바일 시트 2단 max-h (full 88svh는 시트가 지도를 가려 행 탭 시 이동 결과가 안 보여 제거).
// peek 150 = border2 + pt4 + 그래버44 + 제목24 + 여유4 + pb72 (제목까지 노출, 검색은 mt 아래라 가림) — 0256: pb 78→72 동기. 완전한 리터럴 → Tailwind JIT 스캔 OK.
const SHEET_MAX_H = {
  peek: 'max-h-[calc(150px+env(safe-area-inset-bottom))]',
  // 0254→0257: half 하한 359 = 고정부 254 + 목록 하한 105 — 실기기 Safari는 svh가 주소창·툴바만큼 축소돼
  // 58svh만으론 목록 확보가 안 됨. 하한은 아래 SHEET_LIST_MAX_H의 105와 짝(pair) — 한쪽만 바꾸면 클립 잘림.
  // (이력: 0254 190/462 과점 → 0255 143/415 → 0256 고정부 압축 143/397 → 0257 걸침 어포던스 105/359)
  half: 'max-h-[max(58svh,calc(359px+env(safe-area-inset-bottom)))]',
} as const;
// 0252: 목록 ul 명시 max-h — iOS Safari가 중첩 flex(클립 래퍼) 안에서 grow를 계산하지 않아
// ul이 한 줄(48px)로 붕괴(실기기 Web Inspector 실측) → flex 사이징 배제, 높이 = min(콘텐츠, calc).
// 58svh = SHEET_MAX_H.half와 동기. 254 = border2 + pt4 + 그래버44 + 제목24 + (mt8+검색46) + (mt8+칩38) + ul mt8 + pb72 (0256: mt12→8 셋 + pb78→72 압축).
// pb 72 = 탭바 실측(pill h58 + 하단 이격 14) — 콘텐츠 끝 = pill top 정확 일치(겹침 0).
// safe-area 항: pb가 72+env라 노치 기기에선 그만큼 가용 공간이 줄어듦(빼지 않으면 마지막 행이 클립에 가림).
// 0258→0259: ul = 시트 높이 − 182 (182 = border2 + pt4 + 고정스택168 + ul mt8 — 시트 상단에서 ul 박스 시작까지).
// ul이 시트 하단(pill 뒤)까지 내려가 행이 이어져 보임 — 걸침 신호를 스크롤 위치와 무관하게 유지.
// 스크롤 끝은 ul 내부 pb(72+env)가 마지막 행을 pill 위로 보정. floor 177 = half 하한 359 − 182
// (0257의 가시 목록 105 + pill존 72의 등가 변환 — pill 위 가시값은 0257과 동일).
const SHEET_LIST_MAX_H = 'max-h-[max(calc(58svh-182px),calc(177px+env(safe-area-inset-bottom)))]';
// 0258: 고정 스택(그래버·제목·검색·칩) 래퍼의 레벨별 클립 높이 — flex 수축 의존 제거(0253 명시 높이 원칙).
// peek 72 = 그래버44 + 제목24 + 여유4 (기존 peek 클립과 동일) / half 168 = +mt8+검색46+mt8+칩38.
const SHEET_STACK_MAX_H = { peek: 'max-h-[72px]', half: 'max-h-[168px]' } as const;


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

// 0261: 목록 정렬 스크롤 — scrollIntoView 금지(조상 순회가 0250 revert 원인), 좌표는 rect 기반(offsetParent가 시트 루트라 offsetTop 함정 — 실측).
// hiddenBottom = 스크롤포트 하단의 비가시 존(모바일 pill 뒤 72+env) — ul의 computed paddingBottom에서 읽음(env는 JS로 못 읽지만 computed엔 해석됨. 데탑 0·peek 0 자동).
// 가시 게이트: 행이 가시영역에 온전히 보이면 no-op(행 탭 무점프). 정렬: center(데탑)/top(모바일 — 0257 걸침 보존).
// 상한 클램프는 scrollTop 대입의 브라우저 표준 동작에 위임, 하한만 0. 즉시 이동(대입) — 시트 전환(320ms)·구형 iOS smooth 편차와 경합 없음.
// display:none 쪽(반대 브레이크포인트)은 rect 전부 0 → 현재 scrollTop 재대입 = no-op(분기 불요).
function alignRowInList(li: HTMLLIElement | null, align: 'top' | 'center') {
  const ul = li?.closest('ul');
  if (!li || !ul) return;
  const ulR = ul.getBoundingClientRect();
  const liR = li.getBoundingClientRect();
  const rowTop = liR.top - ulR.top + ul.scrollTop;
  const hiddenBottom = parseFloat(getComputedStyle(ul).paddingBottom) || 0;
  const visibleH = ul.clientHeight - hiddenBottom;
  if (visibleH > 0 && rowTop >= ul.scrollTop && rowTop + liR.height <= ul.scrollTop + visibleH) return;
  ul.scrollTop = Math.max(0, align === 'center' ? rowTop - (visibleH - liR.height) / 2 : rowTop);
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
        {/* 작품 배지 — 데탑 시안 실측 top12/left14. 0249: 모바일 모달은 y=0부터라 노치 대응(safe-area+38, ✕와 중심 정렬) + 1.2배(14px/8·2, 1.5→1.3→1.2 체감 조정) */}
        <div className="absolute top-[calc(env(safe-area-inset-top)+38px)] lg:top-3 left-3.5 flex">
          <span className="rounded-full bg-white/[0.18] px-2 py-[2px] text-sm lg:px-[7px] lg:text-xs font-normal text-white whitespace-nowrap">
            {spot.primaryMovie.title}{spot.extraMovieCount > 0 ? ` +${spot.extraMovieCount}` : ''}
          </span>
        </div>
        <div className="absolute left-4 right-4 bottom-[14px]">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] leading-[1.3] text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.60)]">
            {spot.name}
          </h2>
        </div>
        {/* 0249: ✕ 모바일 히트 44×44(§5 최소 타겟 — 기존 24 미달)·가장자리 16px 이격·노치 대응.
            시각 원·아이콘은 1.2배(29px/14px) — 히트와 분리(투명 버튼 + 내부 시각 원). 데탑은 lg: 원복(원 24 = 버튼 크기와 동일) */}
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute top-[calc(env(safe-area-inset-top)+28px)] right-4 w-11 h-11 lg:top-2 lg:right-2 lg:w-6 lg:h-6 flex items-center justify-center flex-shrink-0 group"
        >
          <span className="w-[29px] h-[29px] lg:w-6 lg:h-6 rounded-full bg-card/80 group-hover:bg-card flex items-center justify-center transition-colors text-fg shadow-sm">
            <X className="w-3.5 h-3.5 lg:w-3 lg:h-3" />
          </span>
        </button>
      </div>

      {/* 0260: 상세 본문 = 유일한 스크롤러. 높이는 명시 calc(부모 100% − 히어로 210, 위 h-[210px]와 짝) —
          flex grow 배제(0253 원칙: iOS/iPad Safari 중첩 flex grow 미계산 재발 방지).
          기존 이중 스크롤러(모달 루트 overflow + 스크롤할 게 없는 body overflow)에선 실기기 iOS에서
          body에서 시작한 터치가 바깥 스크롤러로 체이닝되지 않아 스크롤 불가(0260 버그).
          모바일 pb 88+env: 탭바 pill이 모달 위에 그려짐(변환 조상 스태킹 — 기존 사항) → 스크롤 끝 출처가 pill 위로 오게 보정. 데탑은 lg:pb-4 원복. */}
      <div className="h-[calc(100%-210px)] overflow-y-auto p-4 pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-4 flex flex-col gap-4">
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

        {/* 0240: 출처 표기(공공누리 출처표시) — 상세뷰에만 노출(지도·시트에선 제거). */}
        <div className="flex items-start gap-1.5">
          <Info size={12} className="mt-0.5 text-muted shrink-0" />
          <span className="text-xs text-muted">출처: 한국문화정보원 미디어콘텐츠</span>
        </div>
      </div>
    </>
  );
}

// 0277: 지도 슬롯 로딩 서피스의 표시 위상 — 지도 슬롯에만 적용(리스트·상세는 즉시 실데이터).
// show-delay: loading이 SHOW_DELAY 지속돼야 표시(웜 캐시 깜빡임 억제).
// 최소 노출: 한 번 뜨면 MIN_EXPOSURE 유지(ready 전환돼도) — 짧은 깜빡임 방지.
// error/auth는 즉시 표시(지연 없음 — 실패는 즉각 알림).
const MAP_SLOT_SHOW_DELAY_MS = 200;
const MAP_SLOT_MIN_EXPOSURE_MS = 400;

function useMapSlotPhase(status: NaverLoaderStatus): 'loading' | 'error' | 'auth' | null {
  const [loadingVisible, setLoadingVisible] = useState(false);
  const shownAtRef = useRef(0);
  const visibleRef = useRef(false);
  useEffect(() => {
    visibleRef.current = loadingVisible;
  }, [loadingVisible]);

  useEffect(() => {
    if (status === 'loading') {
      if (visibleRef.current) return; // 이미 표시 중이면 유지(재시도 등)
      const t = setTimeout(() => {
        shownAtRef.current = Date.now();
        setLoadingVisible(true);
      }, MAP_SLOT_SHOW_DELAY_MS);
      return () => clearTimeout(t);
    }
    // ready/error/auth → 로딩 오버레이 종료. 안 떠 있으면 할 일 없음(깜빡임 억제 = 애초에 미표시).
    // setState는 타이머 콜백(async)에서만 — effect 본문 동기 setState 회피(react-hooks/set-state-in-effect).
    if (!visibleRef.current) return;
    // ready면 최소 노출 잔여만큼 유지 후 숨김, error/auth면 즉시(다음 틱) 숨김 — 에러 서피스에 자리 양보.
    const remain = status === 'ready'
      ? Math.max(0, MAP_SLOT_MIN_EXPOSURE_MS - (Date.now() - shownAtRef.current))
      : 0;
    const t = setTimeout(() => setLoadingVisible(false), remain);
    return () => clearTimeout(t);
  }, [status]);

  if (status === 'error') return 'error';
  if (status === 'authError') return 'auth';
  return loadingVisible ? 'loading' : null;
}

export default function SpotFinderMapNaver({ spots }: Props) {
  const { status, slow, retry } = useNaverMapsLoader();
  const ready = status === 'ready'; // 하위 마커·스크롤·리사이즈 로직의 기존 ready 참조 무변경 유지
  const mapSlot = useMapSlotPhase(status);

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
  const mobileSelectedItemRef = useRef<HTMLLIElement | null>(null); // 0245: 모바일 시트 목록의 선택 li (0214와 동일 역할)
  const didInitialScrollRef = useRef(false); // 0214: 첫 진입 1회 가드
  const [sheetLevel, setSheetLevel] = useState<'peek' | 'half'>('half'); // 0247: 모바일 시트 2단 (full 제거 — 시트가 지도 가림)
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
    // 0279: 타일 로드 전 SDK 기본 밝은 배경이 다크 화면에서 흰 깜빡임(웜캐시 재진입 실측) → card 토큰 주입.
    // documentElement 금지: 다크 값은 [data-theme=dark] 스코프에만 발행(theme.ts buildThemeCss)
    // — 루트에서 읽으면 라이트 card. 지도 div(다크 스코프 내부)에서 읽는다. SDK는 var() 미해석이라 실값 전달.
    // 타일은 tileTransition 기본값(true)으로 이 배경 위에 페이드인. 테마 전환 재적용은 D-2 트랙(현행 dark-only).
    const mapBackground = getComputedStyle(mapDivRef.current).getPropertyValue('--card').trim();
    const map = new naver.maps.Map(mapDivRef.current, {
      center: new naver.maps.LatLng(first?.lat ?? INITIAL_CENTER.lat, first?.lng ?? INITIAL_CENTER.lng),
      zoom: INITIAL_ZOOM, // 초기 뷰 = 서울 확대 (전체 fitBounds 시작 폐지 — Effect A 마운트 발화 가드 참조)
      minZoom: 6,
      maxBounds: new naver.maps.LatLngBounds(
        new naver.maps.LatLng(KOREA_BOUNDS.south, KOREA_BOUNDS.west),
        new naver.maps.LatLng(KOREA_BOUNDS.north, KOREA_BOUNDS.east),
      ),
      // 0232: 로고·저작권을 지도 상단으로(모바일 상단 검색·칩 제거로 비워진 공간). 약관상 표기 유지 — 숨김 아님, position만.
      // 두 컨트롤은 각각 독립 배치라 같은 코너면 겹칠 수 있어 좌/우 분리
      logoControlOptions: { position: naver.maps.Position.TOP_LEFT },
      mapDataControlOptions: { position: naver.maps.Position.TOP_RIGHT },
      // 0239: 축척 바 제거 — 표기 의무 아님(v3). 로고·저작권은 위 무변경(의무).
      scaleControl: false,
      background: mapBackground, // 0279: 타일 전 배경 = card (위 mapBackground 주석 참조)
      // 0281: 초기 자동 선택(featuredSpot)은 morph 미경유·생성 center 시작이라 생성 옵션에서
      // padding을 함께 반영 — 첫 프레임부터 카드 블록 중앙 프레이밍(아래 재적용 effect와 동일 산식)
      ...(window.matchMedia(MOBILE_MQ).matches
        ? { padding: { bottom: computeMapPadBottom(mapDivRef.current) } }
        : {}),
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
  // 0277: 게이트 분리 후 리스트는 ready 전에도 렌더되나, 이 초기 스크롤은 [ready] 1회 발화 유지
  //   (선택 li ref는 그 시점 이미 존재 → 정상 동작). 폴백(=맨 위)·featured 부재 시 스킵(불필요 스크롤 방지).
  // 0245: 모바일 시트 목록도 동일 처리 — display:none 쪽(반대 브레이크포인트)은 scrollIntoView가 no-op이라 분기 불필요.
  useEffect(() => {
    if (!ready || didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    if (featuredSpot && listSpots[0]?.id !== featuredSpot.id) {
      selectedItemRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' }); // 즉시 위치, 애니메이션 없음
      mobileSelectedItemRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // 0261: 선택 변경 시 목록 정렬(0250 재구현 — 직접 scrollTop) — 데탑 center(가시 ~6.8행, 맥락)/모바일 top(가시 ~1.4행 — 0257 걸침 보존).
  // sheetLevel 의존: peek(0높이)에서 선택된 경우 half 복귀 때 재정렬(꼬리 행 클램프 어긋남 보정 포함).
  // 0277: 게이트 분리로 첫 진입에도 행이 렌더됨 → 이 effect가 마운트 시점에도 선택 행을 정렬(위 0214와 같은 선택 행 대상, center 수렴이라 중복 스크롤이어도 위치 동일).
  useEffect(() => {
    alignRowInList(selectedItemRef.current, 'center'); // 데탑 (0214 ref 재사용)
    alignRowInList(mobileSelectedItemRef.current, 'top'); // 모바일 (0245 ref 재사용)
  }, [selectedSpot, sheetLevel]);

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

  // 0237: 작품 칩 버튼 목록 — 데스크탑 좌측 칼럼·모바일 시트가 공유(selectedMovieId 단일 상태). 스크롤 컨테이너는 각자.
  // py-2 lg:py-1 = 데스크탑 렌더 동일(회귀 없음), 모바일만 터치 여유.
  function renderMovieChips() {
    return (
      <>
        <button
          type="button"
          onClick={() => setSelectedMovieId(null)}
          className={`shrink-0 rounded-full px-3 py-2 lg:py-1 text-sm font-medium border transition-colors ${selectedMovieId === null
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
            className={`shrink-0 rounded-full px-3 py-2 lg:py-1 text-sm font-medium border transition-colors ${selectedMovieId === g.id
              ? 'bg-primary text-white border-primary'
              : 'bg-card text-fg2 border-border'
              }`}
          >
            {g.title} ({g.count})
          </button>
        ))}
      </>
    );
  }

  // 0238→0262: 스팟 행 필드를 썸네일/텍스트 서브 헬퍼로 분할 — 모바일은 두 탭 영역(썸네일=지도 선택/텍스트=상세)에
  // 각각 사용, 데스크탑은 renderSpotRowFields 합성으로 렌더 결과 동일. 래퍼/핸들러는 각자.
  function renderSpotThumb(spot: SpotFinderSpot) {
    return spot.thumbnailUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={spot.thumbnailUrl} alt="" className="w-12 h-12 rounded-[10px] object-cover shrink-0" />
    ) : (
      <div className="w-12 h-12 rounded-[10px] overflow-hidden shrink-0">
        <SpotCoverPlaceholder variant="list" />
      </div>
    );
  }
  function renderSpotText(spot: SpotFinderSpot) {
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 text-sm font-semibold text-fg truncate">{spot.name}</p>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-surface2 text-fg2 text-xs px-2 py-0.5 border border-border">
            {spot.primaryMovie.title}{spot.extraMovieCount > 0 ? ` +${spot.extraMovieCount}` : ''}
          </span>
        </div>
        {spot.nearestStation && spot.transitMinutes != null && (
          <p className="mt-[3px] text-xs text-muted truncate">
            {formatTransit(spot.nearestStation, spot.transitMinutes, spot.transitMode)}
          </p>
        )}
      </div>
    );
  }
  function renderSpotRowFields(spot: SpotFinderSpot) {
    return (
      <>
        {renderSpotThumb(spot)}
        {renderSpotText(spot)}
      </>
    );
  }

  // 스팟 선택 단일 정의 — 마커·데탑 리스트·모바일 시트 목록이 공유 (규율 5).
  // 0248: 모바일 pan-only 디스패처(0224) 폐지 — 근거였던 ‹› 페이저가 0244에서 사라져 모바일도 이 확대 룰 단일 경로.
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

  // 0270: 데탑 목록 hover → 마커 강조 (순수 시각 — 선택·지도 이동 없음). React 상태 미경유(DOM 직접 토글 —
  // 빠른 훑기에 렌더 부담 0, 0261 scrollTop 직접 설정과 같은 계열 판단). 클러스터에 묶여 DOM 미부착이면 자연 no-op.
  function setMarkerHover(spot: SpotFinderSpot, on: boolean) {
    if (selectedSpotRef.current?.id === spot.id) return; // 선택 마커는 이미 최상위 강조 — 선택 스타일 우선(호버 무시)
    mapDivRef.current?.querySelector(`[data-spot-id="${spot.id}"]`)?.classList.toggle('marker-hover', on);
    markersRef.current.get(spot.id)?.setZIndex(on ? 5 : 1); // 선택 z10 미만으로만 승격 — 위계 유지
  }

  // 마커 클릭 리스너의 스테일 클로저 방지 — 매 커밋 최신 핸들러 동기화 (렌더 중 ref 쓰기 금지 규칙 준수)
  useEffect(() => {
    handleSpotSelectRef.current = handleSpotSelect; // 0248: 마커 클릭도 확대 룰 직결 (디스패처 폐지)
  });

  // 0248: 0236의 "모바일 지도 빈 곳 탭 → 선택 해제" 리스너 제거 — 목록 상시(0244)라 전환은 행 탭으로 충분, 데탑도 빈 곳 탭 해제 없음(정합).

  // 0224→0281: 모바일 지도 하단 패딩 — 시트 half 동조 계산(computeMapPadBottom)으로 시각 중심 상향
  // (줌 무영향, 네이티브 padding MapOption). resize 구독: 브라우저 창 높이 변경 시 재계산 —
  // 실기기는 svh·safe-area가 불변이라 동일값 재적용 = 무해.
  useEffect(() => {
    if (!mapInstance) return;
    const mq = window.matchMedia(MOBILE_MQ);
    const apply = () => {
      const el = mapDivRef.current;
      mapInstance.setOptions('padding', { bottom: mq.matches && el ? computeMapPadBottom(el) : 0 });
    };
    apply();
    mq.addEventListener('change', apply);
    window.addEventListener('resize', apply);
    return () => {
      mq.removeEventListener('change', apply);
      window.removeEventListener('resize', apply);
    };
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

  // 0277: 게이트 분리 — !ready로 통째 early-return 폐지. 리스트·검색·상세·시트는 spots로
  // 즉시 실데이터 렌더, 지도 준비/실패는 아래 중앙 지도 영역의 SpotFinderMapSlot 오버레이만 담당.
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
          className="hidden lg:block w-full rounded-xl px-4 py-2 text-sm border border-border bg-card text-fg placeholder:text-muted shadow-sm transition-[color,border-color,box-shadow] duration-200 ease-out hover:border-muted focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(77,158,255,0.15)]"
        />

        <div className="hidden lg:flex items-center gap-2 rounded-xl border border-border bg-card/80 backdrop-blur-sm shadow-sm px-2 py-1.5">
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
            {renderMovieChips()}
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
                {/* 0270: hover = 마커 강조만(순수 시각) — 지도 이동·선택 없음, 클릭이 유일한 선택 수단. 모바일 행엔 미부착(합성 mouseenter 배제) */}
                <button
                  type="button"
                  onClick={() => handleSpotSelect(spot)}
                  onMouseEnter={() => setMarkerHover(spot, true)}
                  onMouseLeave={() => setMarkerHover(spot, false)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${selected
                    ? 'border-transparent bg-white/[0.16]'
                    : 'border-transparent hover:bg-card'
                    }`}
                >
                  {renderSpotRowFields(spot)}
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

        {/* 지도 캔버스 — 마커·클러스터·이동은 명령형 effect가 관리 (네이버 SDK 직접 소비). 항상 마운트(0277).
            0279: bg-card = 타일 전 흰 깜빡임 1차 방어(SDK 캔버스 attach 전 구간) — 인스턴스 background 옵션과 이중.
            0281: --sab = env을 computed로 읽기 위한 발행 지점(computeMapPadBottom 소비 — JS는 env 직접 불가) */}
        <div
          ref={mapDivRef}
          className="w-full h-full bg-card"
          style={{ '--sab': 'env(safe-area-inset-bottom)' } as React.CSSProperties}
        />

        {/* 0277: 지도 슬롯 로딩/실패 서피스 — 지도 영역만 덮는 오버레이(리스트·상세는 위에 그대로 보임).
            0280: sheetLevel 전달 — 모바일 안내가 시트 스냅별 가시 영역 중앙을 추종(데탑은 무시) */}
        {mapSlot === 'loading' && <SpotFinderMapSlot variant="loading" sheetLevel={sheetLevel} slow={slow} />}
        {mapSlot === 'error' && <SpotFinderMapSlot variant="error" sheetLevel={sheetLevel} onRetry={retry} />}
        {mapSlot === 'auth' && <SpotFinderMapSlot variant="auth" sheetLevel={sheetLevel} />}
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

      {/* 0233: 모바일 하단 시트 (lg:hidden, 바닥밀착). 0244: 선택과 무관하게 항상 목록 유지(선택 카드 배타 전환 폐지) — 선택은 행 하이라이트로 표시.
          0245→0247: 그래버 탭으로 2단(peek/half) 전환 — max-height 전환(목록 50행이라 실높이가 max-h를 따라감. 콘텐츠가 짧으면 전환할 것이 없어 무변) */}
      <div className={`lg:hidden fixed inset-x-0 z-30 bottom-0 flex flex-col rounded-t-[22px] border border-border bg-card/90 backdrop-blur-sm shadow-2xl transition-[max-height] duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${SHEET_MAX_H[sheetLevel]} pt-1 px-4 pb-[calc(72px+env(safe-area-inset-bottom))]`}>
        {/* 0246→0258: 고정 스택(그래버·제목·검색·칩) 전용 클립 래퍼 — 목록(ul)은 pill 뒤까지 내려가도록 밖으로 분리.
            레벨별 명시 max-h(SHEET_STACK_MAX_H)로 peek 가림 유지(flex 수축 의존 제거). 전환은 루트와 동일 질감으로 동기. */}
        <div className={`${SHEET_STACK_MAX_H[sheetLevel]} shrink-0 flex flex-col overflow-hidden transition-[max-height] duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)]`}>
          {/* 0247: 그래버 — peek=∧(→half)/half=∨(→peek) 토글 버튼 1개. 히트 44×64(§5), 시각 chevron 18(0236 전례) */}
          <button
            type="button"
            aria-label={sheetLevel === 'peek' ? '시트 펼치기' : '시트 접기'}
            onClick={() => setSheetLevel((l) => (l === 'peek' ? 'half' : 'peek'))}
            className="self-center flex h-11 w-16 shrink-0 items-center justify-center text-muted hover:text-fg2 transition-colors"
          >
            {sheetLevel === 'peek' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {/* 제목 + 총 N곳 (제목 텍스트·스타일 = 데탑 좌측 칼럼 헤더 준용, 카운트 = listSpots.length) */}
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base font-semibold tracking-[-0.02em] text-fg break-keep">영화·드라마 촬영지 검색</h1>
            <span className="shrink-0 text-xs text-muted">총 {listSpots.length}곳</span>
          </div>
          {/* 검색창 — searchQuery/onChange 재사용(신규 상태 없음). 모바일 16px(§5 iOS 자동 확대 방지) */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="작품명·촬영지를 입력하세요"
            className="mt-2 w-full rounded-xl px-4 py-2.5 text-base border border-border bg-card text-fg placeholder:text-muted shadow-sm focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(77,158,255,0.15)]"
          />
          {/* 0237: 작품 칩 — 데스크탑 칩과 selectedMovieId 공유. 모바일은 터치 가로 스크롤(‹›화살표 없음).
              0245: shrink-0 — overflow-x-auto는 flex 자동 최소 크기가 0이라 시트가 max-h에 걸리면 이 행만 0까지 압축됨(칩 가림의 근본 원인) */}
          <div className="mt-2 shrink-0 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {renderMovieChips()}
          </div>
        </div>
        {/* 0238: 스팟 목록 — listSpots 재사용. 행 본문=handleSpotSelect(0248), [상세]=openDetail.
            0244: 선택 행 하이라이트 = 데탑 li 버튼과 동일 문법 — 0271: 테두리 제거(투명 유지 = 레이아웃 시프트 방지).
            0272: 틴트 파랑 0.11 → 흰색 저투명 0.08 — 파랑은 다크 배경에서 미독(실화면 실측 우선 판정), 흰색은 명도로 부상. 0.06·0.08 비교 후 강도 2배(0.16)로 상향 — 실화면 가시성 판정
            0252: 높이는 SHEET_LIST_MAX_H(명시 calc)로 확정 — flex grow/shrink 미사용(Safari grow 미계산 붕괴 대응, 산식은 상수 주석).
            0258: 래퍼 밖(루트 직속) — 루트는 클립하지 않아 pill 뒤까지 행이 이어져 보임(걸침 신호 상시).
            0259: mt-2 = 칩과 클립 경계 사이 고정 여백(내부 pt는 스크롤에 밀려 행이 칩에 붙음 — 박스 밖 margin은 페인트 없어 peek 잔존 무해).
            peek은 max-h-0 + pb-0 — border-box 높이는 패딩 합 이하로 못 내려가(실측 80px 잔존) 패딩까지 접고 전환 속성에 포함해 동기.
            내부 pb = 스크롤 끝에서 마지막 행을 pill 위로. */}
        <ul className={`mt-2 ${sheetLevel === 'peek' ? 'max-h-0 pb-0' : `pb-[calc(72px+env(safe-area-inset-bottom))] ${SHEET_LIST_MAX_H}`} shrink-0 flex flex-col gap-[7px] overflow-y-auto transition-[max-height,padding] duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)]`}>
          {listSpots.map((spot) => {
            const selected = selectedSpot?.id === spot.id;
            return (
              <li key={spot.id} ref={selected ? mobileSelectedItemRef : undefined}>
                {/* 0262: [상세] 버튼 제거, 형제 버튼 2개로 재배치 — 썸네일=지도 선택(48×48 ≥ §5 44), 텍스트=상세.
                    gap-3 = 기존 본문 내부 썸네일-텍스트 간격(12px) 시각 보존 + §5 인접 타겟 간격 충족.
                    텍스트 탭도 handleSpotSelect 선행 — 모달이 selectedSpot을 렌더하므로(빈 모달 방지, 구 [상세] 패턴). */}
                <div className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${selected
                  ? 'border-transparent bg-white/[0.16]'
                  : 'border-transparent'
                  }`}>
                  <button
                    type="button"
                    aria-label={`${spot.name} 지도에서 보기`}
                    onClick={() => handleSpotSelect(spot)}
                    className="shrink-0"
                  >
                    {renderSpotThumb(spot)}
                  </button>
                  <button
                    type="button"
                    onClick={() => { handleSpotSelect(spot); openDetail(spot); }}
                    className="min-w-0 flex-1 flex items-center text-left"
                  >
                    {renderSpotText(spot)}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {/* 0259: 하단 페이드 — pill 뒤 비침(걸침 신호)은 남기고 바닥으로 갈수록 시트 배경으로 잦아들게(애플 지도식).
            h = pill존(72+env) + 16(pill 상단 위 시작), pill top 지점 불투명도 ≈18%라 비침 유지·바닥 100%로 잘린 텍스트 소멸.
            끝색은 불투명 var(--card) — 시트 bg(card/90)로 끝내면 바닥에 텍스트 10%가 남음. 토큰 기반이라 라이트/다크 자동.
            DOM 순서로 목록 위, 시트 z-30 컨텍스트 안이라 탭바(z-40) 아래. pointer-events-none — 스크롤·pill 터치 통과. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(88px+env(safe-area-inset-bottom))] bg-[linear-gradient(to_bottom,transparent,var(--card))]" />
      </div>

      {/* 0224: 모바일 상세 풀스크린 모달 (?detail=id, 탭바까지 덮음). 지도 인스턴스 유지 → 뒤로가기/X로 선택·위치·줌 보존.
          0260: 루트 overflow 제거 — 스크롤러는 본문(SpotDetailContent body) 하나. 히어로·✕는 상단 고정(데탑 aside와 동작 통일).
          0263: 슬라이드 업 — 조건부 마운트라 transition 불가, @keyframes(detail-up)가 마운트 시 자동 재생. 닫힘은 즉시 언마운트(현행). */}
      {detailOpen && selectedSpot && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-bg animate-[detail-up_320ms_cubic-bezier(0.32,0.72,0,1)]" style={{ height: '100svh' }}>
          <SpotDetailContent spot={selectedSpot} onClose={() => window.history.back()} />
        </div>
      )}
    </div>
  );
}
