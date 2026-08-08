'use client';
import { useState, useEffect } from 'react';
import type { FlightOffer } from '@/lib/flights';
import { searchFlightsAction } from './actions';
import { AIRPORT_NAME, type FlightSegmentData } from '../_components/FlightLeg';
import { FlightLegRow } from '../_components/FlightLegRow';

interface Props {
  startDate: string;
  endDate: string;
  flight: FlightOffer | null;
  onChange: (offer: FlightOffer | null) => void;
  onDateMissingChange?: (missing: { start: boolean; end: boolean }) => void;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function durationFromIso(departsAt: string, arrivesAt: string) {
  const m = Math.round((new Date(arrivesAt).getTime() - new Date(departsAt).getTime()) / 60000);
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

function fmtDateFromStr(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}.${d.getDate()} (${wd})`;
}

const KR_AIRPORTS = ['ICN', 'GMP', 'CJU', 'PUS', 'TAE', 'CJJ'] as const;
const JP_AIRPORTS = ['NRT', 'HND', 'KIX', 'FUK', 'CTS', 'NGO', 'OKA'] as const;

const ROUTES: Record<string, string[]> = {
  // 2026-06 기준 정기 직항 (한국 출발)
  ICN: ['NRT', 'HND', 'KIX', 'FUK', 'CTS', 'NGO', 'OKA'],
  GMP: ['HND', 'KIX', 'CJU', 'PUS'],
  PUS: ['NRT', 'KIX', 'FUK', 'NGO', 'GMP', 'CJU'],
  CJU: ['GMP', 'PUS', 'TAE', 'CJJ'],
  TAE: ['CJU'],
  CJJ: ['CJU'],
  // 역방향 (위 노선에서 도출 — 새 노선 없음)
  NRT: ['ICN', 'PUS'],
  HND: ['ICN', 'GMP'],
  KIX: ['ICN', 'GMP', 'PUS'],
  FUK: ['ICN', 'PUS'],
  CTS: ['ICN'],
  NGO: ['ICN', 'PUS'],
  OKA: ['ICN'],
};

// 0569: 티켓 블록 아래 전폭 행동 버튼(검색·변경 공용). 0527의 outline 위계는 유지 —
//   최종 행동인 저장(파랑 채움)과 급을 구분한다. 구 IATA_SELECT_CLASS(입력 상자)는
//   공항 칸이 AirportPicker로 바뀌며 소비처 0이 돼 폐기.
const ACTION_BTN_CLASS =
  'mt-4 w-full py-[13px] rounded-lg border border-fg text-[15px] font-semibold text-fg ' +
  'hover:bg-surface2 transition-colors';

// 0569: 선택 완료된 편 — 읽기(PublicFlightTable)와 같은 값 조판.
function SelectedLeg({ seg, label, last }: { seg: FlightSegmentData; label: string; last: boolean }) {
  const dt = (iso: string) => `${fmtDateFromStr(iso.slice(0, 10))} ${fmtTime(iso)}`;
  return (
    <FlightLegRow
      label={label}
      origin={{ code: seg.origin, name: AIRPORT_NAME[seg.origin] ?? '', time: dt(seg.departsAt) }}
      dest={{ code: seg.destination, name: AIRPORT_NAME[seg.destination] ?? '', time: dt(seg.arrivesAt) }}
      duration={durationFromIso(seg.departsAt, seg.arrivesAt)}
      flightNo={`${seg.airline} ${seg.flightNo}`}
      last={last}
    />
  );
}

// 0569: 공항 코드 자리 = 선택 버튼. 코드(24px)를 그대로 두고 **아래 1px 밑줄**로 조작 가능함을
//   표시한다 — 구 카드 안 입력 상자는 폐기(면·테두리를 쓰지 않는 게 0569 ①).
//   네이티브 select를 투명하게 겹치는 이유: 옵션 목록·키보드·모바일 피커를 브라우저에 맡겨
//   접근성을 잃지 않으면서 표시만 우리 조판으로 가져간다.
//   터치 타겟: 오버레이가 코드 줄(24px)과 공항명 줄을 덮어 44px(h-11) — CLAUDE.md §5.
//   select 글자 16px(text-base)은 iOS 포커스 자동확대 방지(§5) — 투명이라 안 보이지만
//   확대 여부는 폰트 크기로 판정된다.
function AirportPicker({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string;
  placeholder: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <span className="relative inline-block">
      <span className={`border-b border-fg/40 ${value ? 'text-fg' : 'text-hint'}`}>
        {value || placeholder}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        className="absolute inset-x-0 top-0 h-11 w-full cursor-pointer text-base opacity-0"
      >
        <option value="">공항 선택</option>
        {options.map((iata) => (
          <option key={iata} value={iata}>
            {AIRPORT_NAME[iata]} ({iata})
          </option>
        ))}
      </select>
    </span>
  );
}

function OfferCard({
  offer,
  isSelected,
  onClick,
}: {
  offer: FlightOffer;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 rounded-[10px] border transition-colors mb-2 ${
        isSelected
          ? 'border-primary bg-surface2'
          : 'border-field-border hover:bg-surface2'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-base font-medium text-fg">
            {offer.outbound.airline} · {offer.outbound.flightNo}
          </p>
          <p className="text-sm text-muted mt-0.5">
            {offer.outbound.origin} → {offer.outbound.destination}
            {' · '}{fmtTime(offer.outbound.departsAt)} ~ {fmtTime(offer.outbound.arrivesAt)}
            {' · '}{durationFromIso(offer.outbound.departsAt, offer.outbound.arrivesAt)}
          </p>
          {offer.return && (
            <p className="text-sm text-muted mt-0.5">
              오는편 {offer.return.airline} · {offer.return.flightNo}
              {' · '}{fmtTime(offer.return.departsAt)} ~ {fmtTime(offer.return.arrivesAt)}
              {' · '}{durationFromIso(offer.return.departsAt, offer.return.arrivesAt)}
            </p>
          )}
        </div>
        <p className="text-base font-semibold text-fg shrink-0 ml-2 tabular-nums">
          ₩{offer.totalAmount.toLocaleString()}
        </p>
      </div>
    </button>
  );
}

export function FlightSearchSection({ startDate, endDate, flight, onChange, onDateMissingChange }: Props) {
  const [showForm, setShowForm] = useState(!flight);
  const [tripType, setTripType] = useState<'ONE_WAY' | 'ROUND_TRIP'>('ROUND_TRIP');
  const [originIata, setOriginIata] = useState('');
  const [destIata, setDestIata] = useState('');
  const [offers, setOffers] = useState<FlightOffer[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isPastDate = !!startDate && startDate < todayStr();

  const canSearch =
    !!startDate &&
    !isPastDate &&
    (tripType === 'ONE_WAY' || !!endDate) &&
    originIata.length === 3 &&
    destIata.length === 3;

  const bothIata = showForm && originIata.length === 3 && destIata.length === 3;
  const startMissing = bothIata && !startDate;
  const endMissing   = bothIata && tripType === 'ROUND_TRIP' && !endDate;

  useEffect(() => {
    onDateMissingChange?.({ start: startMissing, end: endMissing });
  }, [startMissing, endMissing, onDateMissingChange]);

  const dateWarning = !startDate
    ? '출발일, 도착일을 입력해주세요'
    : isPastDate
    ? '지난 날짜는 검색할 수 없습니다'
    : tripType === 'ROUND_TRIP' && !endDate
    ? '왕복 검색을 위해 계획 종료일을 먼저 입력하세요'
    : null;

  async function handleSearch() {
    if (!canSearch) return;
    setStatus('searching');
    setOffers([]);
    setErrorMsg('');
    const result = await searchFlightsAction({
      tripType,
      originIata: originIata.toUpperCase(),
      destinationIata: destIata.toUpperCase(),
      departDate: startDate,
      returnDate: tripType === 'ROUND_TRIP' ? (endDate || undefined) : undefined,
    });
    if ('error' in result) {
      setStatus('error');
      setErrorMsg(result.error);
    } else {
      setOffers(result.offers);
      setStatus('done');
    }
  }

  return (
    // 0527: 카드·중복 라벨 제거 — 섹션 제목은 호출부(MyPlanNewForm SectionHeader "항공편 예상")가 담당
    <div className="mt-5 mb-4">
      {flight && !showForm && (
        <>
          {/* 0569: 선택된 항공편도 읽기와 같은 조판(FlightLegRow) — 구 FlightLeg 카드 2장 폐기.
              값은 검색 결과라 읽기와 같은 텍스트다. */}
          <SelectedLeg seg={flight.outbound} label="가는편" last={!flight.return} />
          {flight.return && <SelectedLeg seg={flight.return} label="오는편" last />}
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setShowForm(true);
              setStatus('idle');
              setOffers([]);
            }}
            className={ACTION_BTN_CLASS}
          >
            변경
          </button>
        </>
      )}

      {showForm && (
        <>
          <div className="flex gap-2 mb-3">
            {(['ROUND_TRIP', 'ONE_WAY'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTripType(t); setStatus('idle'); setOffers([]); }}
                className={`px-4 py-2 rounded-2xl text-[13px] font-semibold transition-colors ${
                  tripType === t
                    ? 'bg-fg text-bg'
                    : 'border border-field-border text-fg2 hover:bg-surface2'
                }`}
              >
                {t === 'ROUND_TRIP' ? '왕복' : '편도'}
              </button>
            ))}
          </div>

          {/* 0569: 미검색 상태 — 일시·소요·편명 자리를 비우지 않고 "—"로 유지한다.
              검색 전후 줄 높이가 같아 결과가 들어올 때 레이아웃이 안 튄다(FlightLegRow가 담당).
              출발 일시는 검색 전에도 계획 날짜로 알 수 있으므로 날짜만 먼저 채운다 —
              검색 후 같은 자리에 시각이 붙는다(정보 손실 없이 자리도 안 바뀜). */}
          <FlightLegRow
            label="가는편"
            origin={{
              code: (
                <AirportPicker
                  value={originIata}
                  placeholder="출발"
                  options={[...KR_AIRPORTS, ...JP_AIRPORTS]}
                  onChange={(v) => {
                    setOriginIata(v);
                    if (destIata && !(ROUTES[v] ?? []).includes(destIata)) setDestIata('');
                  }}
                />
              ),
              name: AIRPORT_NAME[originIata] ?? '',
              time: startDate ? fmtDateFromStr(startDate) : undefined,
            }}
            dest={{
              code: (
                <AirportPicker
                  value={destIata}
                  placeholder="도착"
                  options={ROUTES[originIata] ?? []}
                  onChange={(v) => setDestIata(v)}
                />
              ),
              name: AIRPORT_NAME[destIata] ?? '',
            }}
            last={tripType !== 'ROUND_TRIP'}
          />
          {tripType === 'ROUND_TRIP' && (
            /* 오는편은 가는편의 역방향이라 선택 대상이 아니다 — 코드는 텍스트(hint) */
            <FlightLegRow
              label="오는편"
              origin={{ code: destIata || '—', name: AIRPORT_NAME[destIata] ?? '', time: endDate ? fmtDateFromStr(endDate) : undefined }}
              dest={{ code: originIata || '—', name: AIRPORT_NAME[originIata] ?? '' }}
              last
            />
          )}

          {/* 0527: 검색 버튼은 outline(최종 행동인 저장과 위계 구분) + 안내는 옆에 14px.
              360px에선 세로 스택. */}
          {/* 0569 ⑥: 검색 버튼은 티켓 블록 아래 전폭 — 구 인라인 배치(버튼 옆 경고문)는
              카드가 있던 시절의 조판이다. 경고문은 버튼 아래로 내린다. */}
          <button
            type="button"
            onClick={handleSearch}
            disabled={!canSearch || status === 'searching'}
            className={ACTION_BTN_CLASS + ' disabled:opacity-40 disabled:cursor-not-allowed'}
          >
            {status === 'searching' ? '검색 중...' : '항공편 검색'}
          </button>
          {dateWarning && <p className="mt-2.5 text-sm text-danger">{dateWarning}</p>}
        </>
      )}

      {showForm && status === 'done' && (
        <div className="mt-4">
          {offers.length === 0 ? (
            <>
              {/* 0527 ⑦: 지시(15px/600)와 내용(14px 힌트) 2단 */}
              <p className="text-[15px] font-semibold text-muted text-center pt-4">검색 결과가 없습니다</p>
              <p className="mt-2.5 text-sm text-hint text-center">출발일을 1~2일 뒤로 변경하거나, 직항이 있는 노선인지 확인해보세요</p>
            </>
          ) : (
            <>
              {offers.map((offer, i) => (
                <OfferCard
                  key={i}
                  offer={offer}
                  isSelected={flight === offer}
                  onClick={() => { onChange(offer); setShowForm(false); }}
                />
              ))}
            </>
          )}
        </div>
      )}

      {showForm && status === 'error' && (
        <p className="text-sm text-danger mt-3">{errorMsg}</p>
      )}
    </div>
  );
}
