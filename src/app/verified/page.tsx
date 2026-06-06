import xvideos from '@/lib/scraper/index';
import VideoGrid from '@/components/VideoGrid';
import Pagination from '@/components/Pagination';
import { cacheWrap, TTL } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getData(page: number) {
  try {
    const result = await cacheWrap(
      `verified:page=${page}`,
      () => xvideos.videos.verified({ page }),
      TTL.VERIFIED,
    );
    return { success: true as const, result };
  } catch (error) {
    return { success: false as const, error: String(error) };
  }
}

export default async function VerifiedPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const data = await getData(page);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Verified Videos</h1>
        <p className="text-sm text-gray-400 mt-1">Content from verified performers and studios</p>
      </div>

      {data.success ? (
        <>
          <VideoGrid videos={data.result.videos} />
          <Pagination currentPage={page} allPages={data.result.pagination.pages} basePath="/verified" />
        </>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">Failed to load verified videos</p>
          <p className="text-sm mt-2">{data.error}</p>
        </div>
      )}
    </div>
  );
}
