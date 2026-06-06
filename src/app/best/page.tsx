import xvideos from '@/lib/scraper/index';
import VideoGrid from '@/components/VideoGrid';
import Pagination from '@/components/Pagination';
import Link from 'next/link';
import { cacheWrap, TTL } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getData(page: number, year?: string, month?: string) {
  try {
    const result = await cacheWrap(
      `best:page=${page},year=${year ?? ''},month=${month ?? ''}`,
      () => xvideos.videos.best({
        page,
        ...(year ? { year: Number(year) } : {}),
        ...(month ? { month: Number(month) } : {}),
      }),
      TTL.BEST,
    );
    return { success: true as const, result };
  } catch (error) {
    return { success: false as const, error: String(error) };
  }
}

export default async function BestPage({ searchParams }: { searchParams: Promise<{ page?: string; year?: string; month?: string }> }) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const year = params.year;
  const month = params.month;
  const data = await getData(page, year, month);

  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleString('default', { month: 'long', year: 'numeric' }) };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Best Videos</h1>
          <p className="text-sm text-gray-400 mt-1">Top rated videos by month</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {months.slice(0, 6).map((m) => {
            const [y, mo] = m.value.split('-');
            const shortLabel = m.label.replace(/\s\d{4}$/, '').substring(0, 3) + m.label.match(/\s\d{4}$/)?.[0] || '';
            return (
              <Link
                key={m.value}
                href={`/best?year=${y}&month=${mo}`}
                className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  year === y && month === mo ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{m.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {data.success ? (
        <>
          <VideoGrid videos={data.result.videos} />
          <Pagination currentPage={page} allPages={data.result.pagination.pages} basePath="/best" searchParams={(() => { const p: Record<string, string> = {}; if (year) p.year = year; if (month) p.month = month; return p; })()} />
        </>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">Failed to load best videos</p>
          <p className="text-sm mt-2">{data.error}</p>
        </div>
      )}
    </div>
  );
}
