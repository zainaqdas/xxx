import Link from 'next/link';
import type { VideoSummary } from '@/lib/scraper/index';

export default function VideoCard({ video }: { video: VideoSummary }) {
  const formatViews = (count: number) => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return count.toString();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Link href={`/video/${encodeURIComponent(video.videoId)}?url=${encodeURIComponent(video.url)}`} className="group block">
      <div className="relative aspect-video bg-gray-800 rounded-xl overflow-hidden">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded font-medium">
          {formatDuration(video.durationSeconds)}
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-red-400 transition-colors">
          {video.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{video.profile.name}</span>
          <span>•</span>
          <span>{formatViews(video.watchCount)} views</span>
        </div>
      </div>
    </Link>
  );
}
