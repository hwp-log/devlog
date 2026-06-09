'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

export function TagSearchBar({ q }: { q: string }) {
  const router = useRouter();
  const [value, setValue] = useState(q);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const normalized = value.trim().replace(/\s/g, '');
    const timer = setTimeout(() => {
      const url = normalized ? `/story?q=${encodeURIComponent(normalized)}` : '/story';
      router.replace(url);
    }, 300);
    return () => clearTimeout(timer);
  }, [value, router]);

  return (
    <div className="relative flex items-center">
      <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="제목, 지역명을 입력하세요"
        className="w-70 pl-9 pr-9 py-2 text-sm text-[#1A1A1A] rounded-full border border-slate-200 bg-white/70
                   focus:outline-none focus:ring-2 focus:ring-slate-300
                   transition-[box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]
                   placeholder:text-slate-400"
      />
      {value && (
        <button
          onClick={() => setValue('')}
          className="absolute right-3 text-slate-400 hover:text-slate-600"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
