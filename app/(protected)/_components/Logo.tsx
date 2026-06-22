import Link from 'next/link';

export function Logo() {
  return (
    <Link
      href="/story"
      aria-label="Dotrip"
      className="text-lg font-bold text-[#1A1A1A]"
    >
      D
      <svg
        viewBox="0 0 20 27"
        width="16"
        height="21.5"
        aria-hidden="true"
        style={{ verticalAlign: '-4px', display: 'inline-block' }}
      >
        <ellipse cx="10" cy="25" rx="3.4" ry="1.4" fill="#0EA5E9" opacity="0.55" />
        <circle cx="10" cy="9" r="8" fill="#0EA5E9" />
        <polygon points="3,13 17,13 10,21" fill="#0EA5E9" />
        <circle cx="10" cy="9" r="3" fill="white" />
      </svg>
      trip
    </Link>
  );
}
