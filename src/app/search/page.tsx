import xvideos from '@/lib/scraper/index';
import VideoGrid from '@/components/VideoGrid';
import Pagination from '@/components/Pagination';
import SearchBar from '@/components/SearchBar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = { page?: string; k?: string; sort?: string; durf?: string; datef?: string; quality?: string };

async function getData(page: number, k?: string, sort?: string, durf?: string, datef?: string, quality?: string) {
  try {
    const result = await xvideos.videos.search({
      page,
      k: k || '',
      sort: (sort as any) || 'relevance',
      durf: (durf as any) || 'allduration',
      datef: (datef as any) || 'all',
      quality: (quality as any) || 'all',
    });
    return { success: true as const, result };
  } catch (error) {
    return { success: false as const, error: String(error) };
  }
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const { k, sort, durf, datef, quality } = params;
  const data = k ? await getData(page, k, sort, durf, datef, quality) : null;

  const searchParamsObj: Record<string, string> = {};
  if (k) searchParamsObj.k = k;
  if (sort && sort !== 'relevance') searchParamsObj.sort = sort;
  if (durf && durf !== 'allduration') searchParamsObj.durf = durf;
  if (datef && datef !== 'all') searchParamsObj.datef = datef;
  if (quality && quality !== 'all') searchParamsObj.quality = quality;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Search</h1>
        <p className="text-sm text-gray-400 mt-1">Find videos by keyword and filters</p>
      </div>

      <div className="mb-6">
        <SearchBar initial={{ k, sort, durf, datef, quality }} />
      </div>

      {data === null ? (
        <div className="text-center py-20 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-lg">Enter a search term to find videos</p>
          <p className="text-sm mt-1">Use the filters above to narrow results</p>
        </div>
      ) : data.success ? (
        <>
          <div className="mb-4 text-sm text-gray-400">
            Found {data.result.videos.length} videos on page {page}
            {data.result.videos.length > 0 && <> • Page {page} of {data.result.pagination.pages.length}</>}
          </div>
          <VideoGrid videos={data.result.videos} />
          <Pagination currentPage={page} allPages={data.result.pagination.pages} basePath="/search" searchParams={searchParamsObj} />
        </>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">Search failed</p>
          <p className="text-sm mt-2">{data.error}</p>
        </div>
      )}
    </div>
  );
}
