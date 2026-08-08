import type { ReactNode } from 'react';
import { PLANE_ICON } from './FlightLeg';

/**
 * 항공편 한 줄 — 읽기(plan-finder/[id])와 작성 폼(my-plan/new)이 공유하는 조판.
 *
 * ── 0569 산출 근거 ──────────────────────────────────────────────────────
 * 카드 면·테두리·그림자·점선·절취선을 **쓰지 않는다.** 형제 그룹 둘(고정 비용·
 * 일자별)이 선과 여백만으로 구획되는데 여기만 면을 깔면 세 그룹 중 하나만 다른
 * 재질이 된다 — 폼의 구 카드 2장이 "붕 떠 보인" 원인이 그것이었다.
 * 편 사이는 1px 가로선만. **왼쪽 세로 안내선은 쓰지 않는다** — 0567 후속에서
 * 카테고리 세로선을 실화면 판정으로 폐기했고, 같은 어휘를 여기서 되살리지 않는다.
 *
 * 공용 컴포넌트로 뽑은 이유: 4열 그리드 + 360px 접힘 규칙을 두 화면이 각각
 * 구현하면 다음에 한쪽만 바뀐다(0565→0567에서 겪은 유형). 0556이 "폼 정합은
 * 조판·용어만, 컴포넌트 공유 금지"로 정한 건 폼의 **입력 구조**와 읽기의 **표시
 * 구조**가 다른 물건이라서인데, 이 편 한 줄은 공항 칸 슬롯 하나만 빼면 같은
 * 물건이다. 슬롯 방식 선례: 0562(표 슬롯)·0528(헤더 슬롯).
 *
 * 위치가 my-plan/_components 인 이유: plan-finder/[id]/PublicFlightTable이 이미
 * 이 디렉토리에서 AIRPORT_NAME·타입을 import한다 — 역방향 의존이 생기지 않는다.
 *
 * ── 조판 ────────────────────────────────────────────────────────────────
 * 데스크톱: [48px 라벨][출발][1fr 가운데][도착]
 * 모바일(360): 라벨을 위로 올리고 아래 3열 — PublicFlightTable이 0515부터 쓰던
 *   모바일 문법 그대로. 읽기 쪽은 그룹 들여쓰기(GROUP_BODY 14 + 카테고리 16 = 30px)가
 *   더 붙으므로 폭 검산은 읽기 기준이 하한이다.
 */
export type FlightEndpoint = {
  /** 공항 코드 자리(24px) — 읽기는 텍스트, 폼은 선택 버튼 */
  code: ReactNode;
  /** 공항명 13px muted. 미선택이면 빈 문자열 */
  name: string;
  /** 일시 14px. 값이 없으면 "—"(줄 높이 유지 — 검색 전후로 레이아웃이 안 튄다) */
  time?: string;
};

export function FlightLegRow({
  label,
  origin,
  dest,
  duration,
  flightNo,
  last,
}: {
  label: string;
  origin: FlightEndpoint;
  dest: FlightEndpoint;
  /** 소요시간 — 없으면 "직항"만 */
  duration?: string;
  flightNo?: string;
  /** 마지막 편은 아래 선 없음(그룹 끝에 선이 하나 더 생기지 않게 — 0562 ItemRow와 같은 처리) */
  last?: boolean;
}) {
  return (
    <div className={`py-3${last ? '' : ' border-b border-hairline'}`}>
      {/* 모바일은 라벨이 자기 줄(col-span-3) + 아래 3열, 데스크톱은 48px 첫 열의 4열.
          마크업은 한 벌 — 두 벌로 두면 값 산출과 조판이 각각 갈린다. */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 sm:grid-cols-[48px_auto_1fr_auto] sm:gap-x-3">
        <span className="col-span-3 mb-1.5 text-[13px] text-muted sm:col-span-1 sm:mb-0">
          {label}
        </span>
        <Endpoint point={origin} />
        <div className="flex flex-col items-center min-w-[60px] sm:min-w-[72px]">
          <Middle duration={duration} flightNo={flightNo} />
        </div>
        <Endpoint point={dest} align="right" />
      </div>
    </div>
  );
}

function Endpoint({ point, align }: { point: FlightEndpoint; align?: 'right' }) {
  const right = align === 'right';
  return (
    <div className={right ? 'text-right' : ''}>
      <div className="text-[24px] font-medium leading-none tracking-[-0.02em] text-fg">
        {point.code}
      </div>
      {/* 공항명 줄은 값이 없어도 자리를 지킨다 — 미선택 상태에서 아래 일시 줄이 올라오면
          검색 후 다시 내려가며 시프트가 생긴다 */}
      <div className="mt-1 text-[13px] text-muted min-h-[20px]">{point.name}</div>
      <div className="text-sm text-fg2">{point.time ?? '—'}</div>
    </div>
  );
}

// 0563 ⑤ 계승: 선을 아이콘 양옆 두 토막으로 갈라 배경색 의존을 없앤다(구 마스크 방식은
//   반투명 카드 위에서 흰 사각형이 떴다). 카드가 사라진 지금도 같은 이유로 유효 —
//   마스크는 배경이 단색일 때만 성립한다.
function Middle({ duration, flightNo }: { duration?: string; flightNo?: string }) {
  return (
    <>
      <span className="text-[13px] text-muted whitespace-nowrap">
        {duration ? `${duration} · 직항` : '직항'}
      </span>
      <span className="my-1 w-full flex items-center gap-1">
        <span aria-hidden className="flex-1 h-px bg-hairline" />
        <span aria-hidden className="text-primary shrink-0">{PLANE_ICON}</span>
      </span>
      <span className="text-[13px] text-muted whitespace-nowrap">{flightNo ?? '—'}</span>
    </>
  );
}
