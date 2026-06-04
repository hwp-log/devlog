'use client';
import { useState } from 'react';
import type { FlightOffer } from '@/lib/flights';
import { searchFlightsAction } from './actions';

interface Props {
  startDate: string;
  endDate: string;
  flight: FlightOffer | null;
  onChange: (offer: FlightOffer | null) => void;
}

function fmtTime(iso: string) {
  return iso.slice(11, 16);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function durationFromIso(departsAt: string, arrivesAt: string) {
  const m = Math.round((new Date(arrivesAt).getTime() - new Date(departsAt).getTime()) / 60000);
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

function SelectedCard({
  flight,
  onClear,
}: {
  flight: FlightOffer;
  onClear: () => void;
}) {
  const isRoundTrip = flight.tripType === 'ROUND_TRIP';
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-[10px] p-4 mb-3">
      <p className="text-xs font-semibold text-blue-500 mb-2 uppercase tracking-wide">
        선택된 항공편
      </p>
      <div className="space-y-2">
        <div>
          <p className="text-xs text-slate-500">가는편</p>
          <p className="text-sm font-medium text-[#1A1A1A]">
            {flight.outbound.airline} · {flight.outbound.flightNo}
          </p>
          <p className="text-sm text-slate-600">
            {flight.outbound.origin} → {flight.outbound.destination}
            {' · '}{fmtTime(flight.outbound.departsAt)} ~ {fmtTime(flight.outbound.arrivesAt)}
          </p>
        </div>
        {isRoundTrip && flight.return && (
          <div>
            <p className="text-xs text-slate-500">오는편</p>
            <p className="text-sm font-medium text-[#1A1A1A]">
              {flight.return.airline} · {flight.return.flightNo}
            </p>
            <p className="text-sm text-slate-600">
              {flight.return.origin} → {flight.return.destination}
              {' · '}{fmtTime(flight.return.departsAt)} ~ {fmtTime(flight.return.arrivesAt)}
            </p>
          </div>
        )}
        <p className="text-sm font-semibold text-[#1A1A1A] pt-1">
          {isRoundTrip ? '왕복 합계(예상)' : '편도 합계(예상)'} ₩{flight.totalAmount.toLocaleString()}
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
      >
        변경
      </button>
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

export function FlightSearchSection({ startDate, endDate, flight, onChange }: Props) {
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

  const dateWarning = !startDate
    ? '계획 날짜를 먼저 입력하세요'
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
        항공편
      </p>

      {flight && !showForm && (
        <SelectedCard
          flight={flight}
          onClear={() => {
            onChange(null);
            setShowForm(true);
            setStatus('idle');
            setOffers([]);
          }}
        />
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

          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={originIata}
              onChange={(e) => setOriginIata(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3))}
              placeholder="출발 (ICN)"
              maxLength={3}
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm text-center text-[#1A1A1A] uppercase focus:outline-none focus:border-blue-400"
            />
            <span className="text-slate-400">→</span>
            <input
              type="text"
              value={destIata}
              onChange={(e) => setDestIata(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3))}
              placeholder="도착 (NRT)"
              maxLength={3}
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm text-center text-[#1A1A1A] uppercase focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="mb-3 space-y-1">
            <p className="text-xs text-slate-500">
              가는편: <span className="text-slate-700">{startDate || '—'}</span>
            </p>
            {tripType === 'ROUND_TRIP' && (
              <p className="text-xs text-slate-500">
                오는편: <span className="text-slate-700">{endDate || '—'}</span>
              </p>
            )}
          </div>

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
            <p className="text-sm text-slate-400 text-center py-4">직항 결과가 없습니다.</p>
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
