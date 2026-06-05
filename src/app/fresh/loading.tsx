import { PageSkeleton, VideoGridSkeleton } from '@/components/LoadingSkeleton';

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
        <div className="h-6 w-36 bg-gray-800 rounded-full animate-pulse" />
      </div>
      <VideoGridSkeleton count={27} />
    </PageSkeleton>
  );
}
