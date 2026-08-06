'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { getPlanCoverCandidates } from './actions';

// 0497: 대표 이미지 선택. 담은 좌표 항목의 재사용 Spot 커버를 후보로 조회(디바운스, 항목 변경 시).
//   고르면 커버 저장, 다시 누르면 해제(null).
// 0510: 후보 1개부터 렌더 — 1개여도 "이 사진 / 자동(지역 폴백) / 해제"의 선택이 실재.
//   특히 스토리 폴백 후보(coverUrl 없는 Spot)는 자동 결과와 달라 "1개=자동과 동일" 전제(0497)가 깨짐.
const DEBOUNCE_MS = 400;

type Candidate = { coverUrl: string; name: string };
type CoordItem = { name: string; lat: number; lng: number };

export function CoverPicker({
  items,
  value,
  onChange,
  header,
}: {
  items: CoordItem[];
  value: string | null;
  onChange: (url: string | null) => void;
  // 0528: 섹션 헤더 슬롯 — 아래 null 가드 **다음에** 렌더한다. 후보 0장이면 헤더까지 함께
  //   사라져 "제목만 남은 빈 섹션"이 구조적으로 불가능해진다(0510 게이트 조건은 무변).
  //   문안은 호출부가 정한다 — 컴포넌트가 화면 문구를 떠안지 않게.
  header?: React.ReactNode;
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

  // 0510: 후보 1개부터 표시(0장만 미표시 — 지역 폴백 흐름 무변경).
  if (candidates.length === 0) return null;

  return (
    <>
      {header}
      {/* 0528: 내부 라벨·힌트는 섹션 제목·보조 문구로 승격돼 여기서는 제거(중복 방지) */}
      <div className="mt-[18px] flex gap-2 overflow-x-auto pb-1">
        {candidates.map((c) => {
          const selected = value === c.coverUrl;
          return (
            <button
              key={c.coverUrl}
              type="button"
              onClick={() => onChange(selected ? null : c.coverUrl)}
              aria-pressed={selected}
              className={`relative shrink-0 w-[104px] h-[72px] rounded-[10px] overflow-hidden border-[3px] transition ${
                selected ? 'border-primary' : 'border-transparent hover:border-fg/20'
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
    </>
  );
}
