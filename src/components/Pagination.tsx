import Link from 'next/link';

type Props = {
  currentPage: number;
  allPages: number[];
  basePath: string;
  searchParams?: Record<string, string>;
};

export default function Pagination({ currentPage, allPages, basePath, searchParams }: Props) {
  if (allPages.length <= 1) return null;

  const buildHref = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    return `${basePath}?${params.toString()}`;
  };

  const visiblePages = allPages.filter((p) => {
    const maxVisible = 9;
    const half = Math.floor(maxVisible / 2);
    if (allPages.length <= maxVisible) return true;
    if (p <= 2 || p >= allPages.length - 1) return true;
    return Math.abs(p - currentPage) <= half;
  });

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      {currentPage > 1 && (
        <Link href={buildHref(currentPage - 1)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
          Prev
        </Link>
      )}

      {visiblePages.map((p, i) => {
        const prev = visiblePages[i - 1];
        if (prev !== undefined && p - prev > 1) {
          return (
            <span key={`gap-${i}`} className="px-2 text-gray-500">...</span>
          );
        }
        return (
          <Link
            key={p}
            href={buildHref(p)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              p === currentPage
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            {p}
          </Link>
        );
      })}

      {currentPage < allPages[allPages.length - 1] && (
        <Link href={buildHref(currentPage + 1)} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
          Next
        </Link>
      )}
    </div>
  );
}
