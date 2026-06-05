export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-pulse">
      {/* Video player skeleton */}
      <div className="aspect-video bg-gray-800 rounded-xl mb-6" />

      {/* Title skeleton */}
      <div className="mb-6">
        <div className="h-6 bg-gray-800 rounded w-3/4 mb-3" />
        <div className="flex gap-3 mb-3">
          <div className="h-4 bg-gray-800 rounded w-24" />
          <div className="h-4 bg-gray-800 rounded w-20" />
          <div className="h-4 bg-gray-800 rounded w-16" />
          <div className="h-4 bg-gray-800 rounded w-32" />
        </div>
        {/* Rating bar skeleton */}
        <div className="flex items-center gap-2">
          <div className="w-32 h-2 bg-gray-800 rounded-full" />
          <div className="h-4 bg-gray-800 rounded w-12" />
        </div>
      </div>

      {/* Tags & Categories skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <div className="h-4 bg-gray-800 rounded w-12 mb-2" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-6 w-16 bg-gray-800 rounded-full" />
            ))}
          </div>
        </div>
        <div>
          <div className="h-4 bg-gray-800 rounded w-20 mb-2" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-6 w-20 bg-gray-800 rounded-full" />
            ))}
          </div>
        </div>
      </div>

      {/* Description skeleton */}
      <div className="h-20 bg-gray-800 rounded-xl mb-6" />
    </div>
  );
}
