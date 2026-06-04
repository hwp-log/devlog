'use client';
import { useState, useEffect } from 'react';
import type { FlightOffer } from '@/lib/flights';
import { searchFlightsAction } from './actions';
import { FlightLeg, AIRPORT_NAME, PLANE_ICON } from '../_components/FlightLeg';

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

const IATA_SELECT_CLASS =
  'border border-slate-200 rounded-lg px-2 py-1.5 text-[13px] font-semibold ' +
  'text-[#1A1A1A] bg-white focus:outline-none focus:border-blue-400 w-full';

function SkeletonCard({
  label, origin, dest, dateStr, isReturn, isRoundTrip,
  onOriginChange, onDestChange,
}: {
  label: string;
  origin: string;
  dest: string;
  dateStr: string;
  isReturn: boolean;
  isRoundTrip: boolean;
  onOriginChange?: (v: string) => void;
  onDestChange?: (v: string) => void;
}) {
  return (
    <div className={`glass-outer px-6 py-5 mb-[10px] ${isReturn ? 'opacity-60' : ''}`}>
      <p className="text-[11px] text-[#888] mb-3">{label}{dateStr ? ` · ${fmtDateFromStr(dateStr)}` : ''}</p>
      <div className="flex items-center gap-5 flex-wrap">

        <div className="w-[180px] shrink-0">
          {isReturn ? (
            <div className="h-8 flex items-center justify-center">
              <p className="text-[22px] font-bold text-slate-300 tracking-[-0.5px] leading-none">{origin || '?'}</p>
            </div>
          ) : (
            <select value={origin} onChange={(e) => onOriginChange?.(e.target.value)} className={IATA_SELECT_CLASS}>
              <option value="">공항 선택</option>
              <optgroup label="한국">
                {KR_AIRPORTS.map((iata) => (
                  <option key={iata} value={iata}>{AIRPORT_NAME[iata]} ({iata})</option>
                ))}
              </optgroup>
              <optgroup label="일본">
                {JP_AIRPORTS.map((iata) => (
                  <option key={iata} value={iata}>{AIRPORT_NAME[iata]} ({iata})</option>
                ))}
              </optgroup>
            </select>
          )}
          <p className={`text-[11px] mt-0.5 ${isReturn ? 'text-[#888] text-center' : 'invisible'}`}>
            {isReturn ? (AIRPORT_NAME[origin] ?? '') : ' '}
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center min-w-[80px]">
          <p className="text-[11px] text-[#888] mb-1">직항</p>
          <div className="w-full h-px bg-[#E0E0E0] relative">
            <span className="absolute -right-1 top-1/2 -translate-y-1/2 bg-white px-1 text-[#5C7BC9]">
              {PLANE_ICON}
            </span>
          </div>
          <p className="text-[11px] text-[#888] mt-1">—</p>
        </div>

        <div className="w-[180px] shrink-0">
          {isReturn ? (
            <div className="h-8 flex items-center justify-center">
              <p className="text-[22px] font-bold text-slate-300 tracking-[-0.5px] leading-none">{dest || '?'}</p>
            </div>
          ) : (() => {
            const destOptions = ROUTES[origin] ?? [];
            return (
              <select value={dest} onChange={(e) => onDestChange?.(e.target.value)}
                disabled={destOptions.length === 0} className={IATA_SELECT_CLASS}>
                <option value="">공항 선택</option>
                {destOptions.map((iata) => (
                  <option key={iata} value={iata}>{AIRPORT_NAME[iata]} ({iata})</option>
                ))}
              </select>
            );
          })()}
          <p className={`text-[11px] mt-0.5 ${isReturn ? 'text-[#888] text-center' : 'invisible'}`}>
            {isReturn ? (AIRPORT_NAME[dest] ?? '') : ' '}
          </p>
        </div>

        <div className="shrink-0 text-right min-w-[110px]">
          {!isReturn ? (
            <p className="text-[11px] text-[#888]">{isRoundTrip ? '왕복 합계(예상)' : '편도 합계(예상)'}</p>
          ) : (
            <p className="text-[11px] text-[#888]">상기 금액에 포함됨</p>
          )}
        </div>
      </div>
    </div>
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
          ? 'border-blue-400 bg-blue-50'
          : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-[#1A1A1A]">
            {offer.outbound.airline} · {offer.outbound.flightNo}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {offer.outbound.origin} → {offer.outbound.destination}
            {' · '}{fmtTime(offer.outbound.departsAt)} ~ {fmtTime(offer.outbound.arrivesAt)}
            {' · '}{durationFromIso(offer.outbound.departsAt, offer.outbound.arrivesAt)}
          </p>
          {offer.return && (
            <p className="text-xs text-slate-500 mt-0.5">
              오는편 {offer.return.airline} · {offer.return.flightNo}
              {' · '}{fmtTime(offer.return.departsAt)} ~ {fmtTime(offer.return.arrivesAt)}
              {' · '}{durationFromIso(offer.return.departsAt, offer.return.arrivesAt)}
            </p>
          )}
        </div>
        <p className="text-sm font-semibold text-[#1A1A1A] shrink-0 ml-2">
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
    <div className="glass-outer p-5 mb-4">
      <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">
        항공편 (예상)
      </p>

      {flight && !showForm && (
        <>
          <FlightLeg data={{ tripType: flight.tripType, totalAmount: flight.totalAmount, out: flight.outbound, ret: flight.return }} />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setShowForm(true);
              setStatus('idle');
              setOffers([]);
            }}
            className="mt-1 mb-3 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
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
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  tripType === t
                    ? 'bg-[#1A1A1A] text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t === 'ROUND_TRIP' ? '왕복' : '편도'}
              </button>
            ))}
          </div>

          <SkeletonCard
            label="가는편"
            origin={originIata}
            dest={destIata}
            dateStr={startDate}
            isReturn={false}
            isRoundTrip={tripType === 'ROUND_TRIP'}
            onOriginChange={(v) => {
              setOriginIata(v);
              if (destIata && !(ROUTES[v] ?? []).includes(destIata)) setDestIata('');
            }}
            onDestChange={(v) => setDestIata(v)}
          />
          {tripType === 'ROUND_TRIP' && (
            <SkeletonCard
              label="오는편"
              origin={destIata}
              dest={originIata}
              dateStr={endDate}
              isReturn={true}
              isRoundTrip={true}
            />
          )}

          {dateWarning && (
            <p className="text-xs text-amber-600 mb-3">{dateWarning}</p>
          )}

          <button
            type="button"
            onClick={handleSearch}
            disabled={!canSearch || status === 'searching'}
            className="w-full py-2 rounded-full text-sm font-semibold bg-[#1A1A1A] text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === 'searching' ? '검색 중...' : '항공편 검색'}
          </button>
        </>
      )}

      {showForm && status === 'done' && (
        <div className="mt-4">
          {offers.length === 0 ? (
            <>
              <p className="text-sm text-slate-400 text-center py-4">검색 결과가 없습니다.</p>
              <p className="text-xs text-red-500 text-center">출발일을 1~2일 뒤로 변경하거나, 직항이 있는 노선인지 확인해보세요.</p>
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
              <p className="text-xs text-red-500 mt-2 leading-relaxed">
                💡 검색 시점 기준 참고 가격이며, 실제 요금·좌석은 변동될 수 있습니다.
                예약은 항공사 또는 예약 서비스에 문의하시기 바랍니다.
              </p>
            </>
          )}
        </div>
      )}

      {showForm && status === 'error' && (
        <p className="text-xs text-red-500 mt-3">{errorMsg}</p>
      )}
    </div>
  );
}
