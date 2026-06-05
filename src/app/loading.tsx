import { PageSkeleton, VideoGridSkeleton } from '@/components/LoadingSkeleton';

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex items-center gap-2 mb-6">
        <div className="h-6 w-32 bg-gray-800 rounded animate-pulse" />
        <div className="h-6 w-48 bg-gray-800 rounded animate-pulse" />
      </div>
      <VideoGridSkeleton count={25} />
    </PageSkeleton>
  );
}
