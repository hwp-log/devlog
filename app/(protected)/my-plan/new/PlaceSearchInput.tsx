'use client';
import { useEffect, useRef, useState } from 'react';
import { searchPlaces, type PlaceResult } from '@/lib/spot/searchPlaces';

// 플랜 항목 장소 입력 — 자유 타이핑을 검색-선택으로 교체(UI만, 저장 경로 무변경).
// 디바운스·seq 가드는 SpotMap.tsx의 검색 관용구를 이식(상수값 동일).
const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LEN = 2;

type Status = 'idle' | 'loading' | 'ok' | 'zero' | 'error';

export function PlaceSearchInput({
  value,
  onType,
  onPick,
  className,
  placeholder = '장소 이름',
}: {
  value: string;
  onType: (name: string) => void;
  onPick: (place: PlaceResult) => void;
  className?: string;
  placeholder?: string;
}) {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);

  // seq 가드: 늦게 보낸 요청이 먼저 도착해 최신 결과를 덮는 것 방지(SpotMap 0396 ①).
  const searchSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  async function runSearch(raw: string) {
    const kw = raw.trim();
    if (kw.length < MIN_SEARCH_LEN) {
      searchSeqRef.current++; // 진행 중 응답 무효화
      setResults([]);
      setStatus('idle');
      return;
    }
    const seq = ++searchSeqRef.current;
    setStatus('loading');
    const result = await searchPlaces(kw);
    if (seq !== searchSeqRef.current) return; // 스테일 응답 폐기
    if (result.status === 'ok') {
      setResults(result.places);
      setStatus('ok');
    } else {
      setResults([]);
      setStatus(result.status);
    }
  }

  // 입력 디바운스 자동검색 — 타이핑 멈춤 300ms 뒤 발사. 2자 미만은 0ms로 즉시 idle 정리.
  useEffect(() => {
    const kw = value.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = kw.length < MIN_SEARCH_LEN ? 0 : SEARCH_DEBOUNCE_MS;
    debounceRef.current = setTimeout(() => void runSearch(kw), delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // 바깥 클릭 시 목록 닫힘
  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [open]);

  function handleSelect(place: PlaceResult) {
    onPick(place); // 입력값=이름은 상위 onUpdate가 반영
    setOpen(false);
    setResults([]);
    setStatus('idle');
  }

  // (A) 결정: 결과 목록은 입력 폭(w-full)에 맞추고 넘치는 텍스트는 truncate.
  //   360px 가로 넘침 0 우선 — 목록은 고르는 자리지 주소 정독 자리가 아님.
  return (
    <div ref={wrapperRef} className="relative min-w-[8rem]">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onType(e.target.value); // 타이핑 = 선택 메타 무효화(상위에서 place: undefined)
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`w-full ${className ?? ''}`}
        autoComplete="off"
      />
      {open && status !== 'idle' && (
        <div className="absolute left-0 top-full mt-1 w-[min(20rem,calc(100vw-2rem))] max-h-[240px] overflow-y-auto rounded-[10px] border border-black/10 bg-white shadow-lg z-20">
          {status === 'loading' && (
            <p className="px-3 py-2 text-xs text-slate-400">검색 중…</p>
          )}
          {status === 'zero' && (
            <p className="px-3 py-2 text-xs text-slate-400">결과 없음 · 입력한 값 그대로 사용돼요</p>
          )}
          {status === 'error' && (
            <p className="px-3 py-2 text-xs text-red-500">검색에 실패했어요</p>
          )}
          {status === 'ok' &&
            results.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => handleSelect(place)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="w-full truncate text-sm font-medium text-[#1A1A1A]">
                  {place.name}
                </span>
                {place.address && (
                  <span className="w-full truncate text-xs text-slate-400">
                    {place.address}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
