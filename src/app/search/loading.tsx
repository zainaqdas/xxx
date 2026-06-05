import { PageSkeleton, VideoGridSkeleton } from '@/components/LoadingSkeleton';

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px] h-10 bg-gray-800 rounded-lg animate-pulse" />
        <div className="h-10 w-24 bg-gray-800 rounded-lg animate-pulse" />
        <div className="h-10 w-24 bg-gray-800 rounded-lg animate-pulse" />
        <div className="h-10 w-24 bg-gray-800 rounded-lg animate-pulse" />
        <div className="h-10 w-20 bg-gray-800 rounded-lg animate-pulse" />
      </div>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-5 w-40 bg-gray-800 rounded animate-pulse" />
      </div>
      <VideoGridSkeleton count={27} />
    </PageSkeleton>
  );
}
