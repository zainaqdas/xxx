import xvideos from '@/lib/scraper/index';
import VideoGrid from '@/components/VideoGrid';
import Pagination from '@/components/Pagination';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getData(page: number) {
  try {
    const result = await xvideos.videos.dashboard({ page });
    return { success: true as const, result };
  } catch (error) {
    return { success: false as const, error: String(error) };
  }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const data = await getData(page);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Trending</h1>
          <p className="text-sm text-gray-400 mt-1">Popular videos from across the platform</p>
        </div>
        <div className="flex gap-2">
          <Link href="/fresh" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">Fresh</Link>
          <Link href="/best" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">Best</Link>
          <Link href="/verified" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">Verified</Link>
        </div>
      </div>

      {data.success ? (
        <>
          <VideoGrid videos={data.result.videos} />
          <Pagination
            currentPage={page}
            allPages={data.result.pagination.pages}
            basePath="/"
            searchParams={params as Record<string, string>}
          />
        </>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">Failed to load videos</p>
          <p className="text-sm mt-2">{data.error}</p>
        </div>
      )}
    </div>
  );
}
