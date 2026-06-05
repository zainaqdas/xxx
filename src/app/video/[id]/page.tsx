import xvideos from '@/lib/scraper/index';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getDetails(url: string) {
  try {
    const result = await xvideos.videos.details({ url });
    return { success: true as const, result };
  } catch (error) {
    return { success: false as const, error: String(error) };
  }
}

function formatViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

function formatDate(iso: string): string {
  if (!iso) return 'Unknown';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default async function VideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ url?: string }>;
}) {
  const { id } = await params;
  const { url } = await searchParams;

  if (!url) {
    notFound();
  }

  const data = await getDetails(url);

  if (!data.success) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-lg text-gray-400">Failed to load video details</p>
        <p className="text-sm text-gray-500 mt-2">{data.error}</p>
        <Link href="/" className="inline-block mt-6 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white transition-colors">
          Back to Home
        </Link>
      </div>
    );
  }

  const detail = data.result;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Video Player - native HTML5 with MP4 from scraped URLs */}
      <VideoPlayer files={detail.files} embedUrl={detail.embedUrl} title={detail.title} poster={detail.thumbnailUrls[0]} videoUrl={url} />

      {/* Title & Meta */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white mb-3">{detail.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
          {detail.profile.name && (
            <a href={detail.profile.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-red-400 hover:text-red-300">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              {detail.profile.name}
            </a>
          )}
          <span>•</span>
          <span>{formatViews(detail.watchCount)} views</span>
          <span>•</span>
          <span>{detail.duration}</span>
          {detail.uploadDate && (
            <>
              <span>•</span>
              <span>{formatDate(detail.uploadDate)}</span>
            </>
          )}
        </div>

        {/* Rating Bar */}
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${detail.ratingPercent}%` }}
              />
            </div>
            <span className="text-sm text-green-400 font-medium">{detail.ratingPercent}%</span>
          </div>
          <span className="text-xs text-gray-500">{detail.voteCount} votes</span>
          {detail.videoWidth && detail.videoHeight && (
            <span className="text-xs text-gray-500">{detail.videoWidth}x{detail.videoHeight}</span>
          )}
        </div>
      </div>

      {/* Tags & Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {detail.tags.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {detail.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/search?k=${encodeURIComponent(tag)}`}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-full text-xs text-gray-300 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>
        )}
        {detail.categories.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {detail.categories.map((cat) => (
                <Link
                  key={cat}
                  href={`/search?k=${encodeURIComponent(cat)}`}
                  className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 rounded-full text-xs text-red-300 transition-colors"
                >
                  {cat}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {detail.description && (
        <div className="mb-6 p-4 bg-gray-900 rounded-xl">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Description</h3>
          <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-3">{detail.description}</p>
        </div>
      )}

      {/* Video Files */}
      {detail.files && (detail.files.low || detail.files.high || detail.files.HLS) && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Download Links</h3>
          <div className="flex flex-wrap gap-2">
            {detail.files.low && (
              <a href={detail.files.low} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors">
                Low Quality
              </a>
            )}
            {detail.files.high && (
              <a href={detail.files.high} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors">
                High Quality
              </a>
            )}
            {detail.files.HLS && (
              <a href={detail.files.HLS} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors">
                HLS Stream
              </a>
            )}
          </div>
        </div>
      )}

      {/* Thumbnails */}
      {detail.thumbnailUrls.length > 1 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">Thumbnails</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {detail.thumbnailUrls.map((thumb, i) => (
              <img key={i} src={thumb} alt={`Thumbnail ${i + 1}`} className="h-20 rounded-lg object-cover flex-shrink-0" loading="lazy" />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="inline-block px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
