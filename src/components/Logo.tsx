import Link from 'next/link';

export default function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link href="/" className="flex items-center gap-2 group" onClick={onClick}>
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-900/30 group-hover:shadow-red-500/40 transition-shadow">
        <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 100 100" fill="none">
          <line x1="28" y1="28" x2="72" y2="72" stroke="white" strokeWidth="14" strokeLinecap="round"/>
          <line x1="72" y1="28" x2="28" y2="72" stroke="url(#xGrad)" strokeWidth="14" strokeLinecap="round"/>
          <defs>
            <linearGradient id="xGrad" x1="0" y1="0" x2="100" y2="100">
              <stop offset="0%" stopColor="white"/>
              <stop offset="100%" stopColor="#fca5a5"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <span className="text-sm sm:text-xl font-extrabold tracking-tight text-white">
        xxx<span className="font-light text-gray-400 tracking-wide">Hub</span>xxx
      </span>
    </Link>
  );
}
