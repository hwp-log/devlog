'use client';
import { useRouter } from 'next/navigation';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Search, X } from 'lucide-react';

export function TagSearchBar({
  q,
  basePath,
  tags = [],
  inputId,
  onNavigate,
}: {
  q: string;
  basePath: string;
  tags?: string[];
  inputId?: string;
  onNavigate?: (url: string) => void; // 있으면 검색 네비를 공용 transition으로 위임(로딩 표시). my-story는 미전달 → 기존 router.replace
}) {
  const router = useRouter();
  const [value, setValue] = useState(q);
  const [idx, setIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isComposing = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tags.length === 0) return;
    const id = setInterval(() => {
      setIdx((i) => {
        setPrevIdx(i);
        return (i + 1) % tags.length;
      });
    }, 4500);
    return () => clearInterval(id);
  }, [tags.length]);

  useEffect(() => {
    if (prevIdx === null) return;
    const t = setTimeout(() => setPrevIdx(null), 900);
    return () => clearTimeout(t);
  }, [prevIdx]);

  const scheduleSearch = useCallback((val: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const normalized = val.trim().replace(/\s/g, '').replace(/#/g, '');
      const url = normalized ? `${basePath}?q=${encodeURIComponent(normalized)}` : basePath;
      if (onNavigate) onNavigate(url);
      else router.replace(url);
    }, 300);
  }, [router, basePath, onNavigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    if (!isComposing.current) {
      scheduleSearch(val);
    }
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposing.current = false;
    scheduleSearch(e.currentTarget.value);
  };

  const showFakePlaceholder = !value && !isFocused && tags.length > 0;

  return (
    <div className="relative flex items-center">
      <Search size={15} className="absolute left-3 text-muted pointer-events-none" />
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        placeholder={tags.length > 0 ? '' : '제목, 지역명을 입력하세요'}
        aria-label="제목, 지역명 또는 인기 태그로 검색"
        className="w-full md:w-70 pl-9 pr-9 py-2 text-sm text-fg rounded-full bg-surface2 border-0 dark:border dark:border-border
                   focus:outline-none focus:border-primary hover:border-muted
                   focus:shadow-[0_0_0_3px_rgba(77,158,255,0.18)] dark:focus:shadow-[0_0_0_3px_rgba(77,158,255,0.15)]
                   transition-[box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]
                   placeholder:text-muted"
      />
      {showFakePlaceholder && (
        <span
          aria-hidden="true"
          className="absolute left-9 right-9 top-1/2 -translate-y-1/2 text-sm leading-5 h-5 text-muted pointer-events-none select-none overflow-hidden whitespace-nowrap"
        >
          {prevIdx === null ? (
            <span className="block">#{tags[idx]}</span>
          ) : (
            <>
              <span
                key={`out-${prevIdx}`}
                className="absolute inset-0"
                style={{ animation: 'ph-exit 900ms ease-out forwards' }}
              >
                #{tags[prevIdx]}
              </span>
              <span
                key={`in-${idx}`}
                className="absolute inset-0"
                style={{ animation: 'ph-enter 900ms ease-out forwards' }}
              >
                #{tags[idx]}
              </span>
            </>
          )}
        </span>
      )}
      {value && (
        <button
          onClick={() => { setValue(''); scheduleSearch(''); }}
          className="absolute right-3 text-muted hover:text-fg2"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
