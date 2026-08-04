'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { getPlanCoverCandidates } from './actions';

// 0497: 대표 이미지 선택. 담은 좌표 항목의 재사용 Spot 커버를 후보로 조회(디바운스, 항목 변경 시).
//   후보 2개 이상일 때만 블록 렌더(1개는 자동 결과와 같아 실효 없음). 고르면 커버 저장, 다시 누르면 해제(null).
const DEBOUNCE_MS = 400;

type Candidate = { coverUrl: string; name: string };
type CoordItem = { name: string; lat: number; lng: number };

export function CoverPicker({
  items,
  value,
  onChange,
}: {
  items: CoordItem[];
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const seqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 좌표 항목 키 — 이 값이 바뀔 때만 재조회(제목·금액 타이핑 등과 무관).
  const key = JSON.stringify(items.map((i) => [i.name, i.lat, i.lng]));

  useEffect(() => {
    if (items.length === 0) {
      setCandidates([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++seqRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await getPlanCoverCandidates(items);
        if (seq === seqRef.current) setCandidates(res);
      } catch {
        if (seq === seqRef.current) setCandidates([]); // 미인증 등 실패는 빈 후보로 흡수
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // key로 좌표 항목 변경만 추적
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // 목표: 후보 2개 이상일 때만 블록 표시.
  if (candidates.length < 2) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#1A1A1A]">대표 이미지</label>
      <p className="text-xs text-slate-400">고르지 않으면 자동으로 정해져요.</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {candidates.map((c) => {
          const selected = value === c.coverUrl;
          return (
            <button
              key={c.coverUrl}
              type="button"
              onClick={() => onChange(selected ? null : c.coverUrl)}
              aria-pressed={selected}
              className={`relative shrink-0 w-[104px] h-[72px] rounded-[10px] overflow-hidden border-[3px] transition ${
                selected ? 'border-primary' : 'border-transparent hover:border-black/20'
              } ${value != null && !selected ? 'opacity-50' : 'opacity-100'}`}
            >
              <Image src={c.coverUrl} alt={c.name} fill sizes="104px" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-3 pb-1">
                <p className="text-xs font-semibold text-white truncate">{c.name}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
