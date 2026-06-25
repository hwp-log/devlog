'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

type FilterDropdownProps<T extends string> = {
  label: string;
  options: Record<T, string>;
  value: T;
  onChange: (next: T) => void;
};

export function FilterDropdown<T extends string>({
  label,
  options,
  value,
  onChange,
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-4 py-1.5 rounded-full text-sm whitespace-nowrap bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="font-medium">{options[value]}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute left-0 top-[calc(100%+6px)] min-w-[140px] bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50"
        >
          {(Object.keys(options) as T[]).map((key) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150 ${
                value === key
                  ? 'bg-slate-100 text-slate-900 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {options[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
