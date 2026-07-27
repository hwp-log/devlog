'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// 번호 페이지네이션 UI 공용 컴포넌트 — 스토리(0307)에서 추출, 플랜파인더(0416)와 공유.
// 데이터 소스(URL 재요청이냐 클라 슬라이스냐)는 소비처가 onGo에서 결정한다.
// 이 컴포넌트는 "몇 페이지가 있고 지금 몇 페이지인가"만 그린다.
interface Props {
  page: number;
  totalPages: number;
  onGo: (next: number) => void;
  disabled?: boolean; // 전환 중(스토리 isPending) 버튼 잠금. 클라 슬라이스는 미지정(즉시 전환).
}

/** 첫·현재·마지막 고정, 중간 …생략. 반환 길이 = slots(total>slots일 때). */
function buildPages(current: number, total: number, slots: number): (number | 'ellipsis')[] {
  if (total <= slots) return Array.from({ length: total }, (_, i) => i + 1);
  const inner = slots - 2; // 1·total 제외 중간 예산(…포함)
  let left = Math.max(2, current - Math.floor((inner - 1) / 2));
  const right = Math.min(total - 1, left + inner - 1);
  left = Math.max(2, right - inner + 1); // 우측 경계 보정
  const showLeft = left > 2;
  const showRight = right < total - 1;
  // …가 슬롯 1칸 차지 → 숫자 창을 한 칸씩 축소해 총 길이 유지
  const from = showLeft ? left + 1 : left;
  const to = showRight ? right - 1 : right;
  const out: (number | 'ellipsis')[] = [1];
  if (showLeft) out.push('ellipsis');
  for (let p = from; p <= to; p++) out.push(p);
  if (showRight) out.push('ellipsis');
  out.push(total);
  return out;
}

export function Pagination({ page, totalPages, onGo, disabled = false }: Props) {
  const [slots, setSlots] = useState(7); // SSR·초기값 7(서버와 일치) → 마운트 후 폭 감지

  // 반응형 slots: <lg 5칸 / lg+ 7칸. useEffect라 hydration mismatch 없음(첫 페인트=7)
  useEffect(() => {
    const update = () => setSlots(window.innerWidth >= 1024 ? 7 : 5);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (totalPages <= 1) return null;

  const pages = buildPages(page, totalPages, slots);
  const cell = 'inline-flex h-11 w-11 items-center justify-center rounded-[14px] text-sm transition-colors';

  return (
    <nav aria-label="페이지 네비게이션" className="mt-10 flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onGo(page - 1)}
        disabled={page === 1 || disabled}
        aria-label="이전 페이지"
        className={`${cell} text-fg2 hover:bg-surface2 disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <ChevronLeft size={18} />
      </button>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e${i}`} aria-hidden className={`${cell} text-muted select-none`}>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onGo(p)}
            disabled={disabled}
            aria-label={`${p}페이지`}
            aria-current={p === page ? 'page' : undefined}
            className={`${cell} ${
              p === page
                ? 'bg-primary font-medium text-white'
                : 'text-fg2 hover:bg-surface2 disabled:cursor-not-allowed'
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onGo(page + 1)}
        disabled={page === totalPages || disabled}
        aria-label="다음 페이지"
        className={`${cell} text-fg2 hover:bg-surface2 disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
