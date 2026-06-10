'use client';
import { useRouter } from 'next/navigation';
import { useState, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

export function TagSearchBar({ q, basePath }: { q: string; basePath: string }) {
  const router = useRouter();
  const [value, setValue] = useState(q);
  const isComposing = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSearch = useCallback((val: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const normalized = val.trim().replace(/\s/g, '');
      const url = normalized ? `${basePath}?q=${encodeURIComponent(normalized)}` : basePath;
      router.replace(url);
    }, 300);
  }, [router, basePath]);

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

  return (
    <div className="relative flex items-center">
      <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        placeholder="제목, 지역명을 입력하세요"
        className="w-70 pl-9 pr-9 py-2 text-sm text-[#1A1A1A] rounded-full border border-slate-200 bg-white/70
                   focus:outline-none focus:ring-2 focus:ring-slate-300
                   transition-[box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]
                   placeholder:text-slate-400"
      />
      {value && (
        <button
          onClick={() => { setValue(''); scheduleSearch(''); }}
          className="absolute right-3 text-slate-400 hover:text-slate-600"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
