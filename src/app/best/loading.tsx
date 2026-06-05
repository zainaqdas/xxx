import { PageSkeleton, VideoGridSkeleton } from '@/components/LoadingSkeleton';

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
      <VideoGridSkeleton count={27} />
    </PageSkeleton>
  );
}
