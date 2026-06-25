'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useInViewOnce } from '@/lib/use-in-view-once';

interface Props {
  children: React.ReactNode;
  index: number;
  initialPhaseRef: RefObject<boolean>;
}

export function CardReveal({ children, index, initialPhaseRef }: Props) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>({ threshold: 0.15 });
  const [delay, setDelay] = useState(0);
  const decidedRef = useRef(false);

  useEffect(() => {
    if (!inView || decidedRef.current) return;
    decidedRef.current = true;
    if (initialPhaseRef.current) {
      setDelay(0.36 + Math.min(index, 8) * 0.12);
    } else {
      setDelay(0);
    }
  }, [inView, index, initialPhaseRef]);

  return (
    <div
      ref={ref}
      className={inView ? 'appear-up' : undefined}
      style={inView ? { animationDelay: `${delay}s` } : { opacity: 0 }}
    >
      {children}
    </div>
  );
}
